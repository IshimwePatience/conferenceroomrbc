package Room.ConferenceRoomMgtsys.service;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;

import com.fasterxml.jackson.annotation.JsonProperty;

import Room.ConferenceRoomMgtsys.dto.auth.AuthResponseDto;
import Room.ConferenceRoomMgtsys.dto.auth.OAuthLoginDto;
import Room.ConferenceRoomMgtsys.dto.auth.OAuthLoginResponseDto;
import Room.ConferenceRoomMgtsys.dto.auth.OAuthOrganizationSelectionDto;
import Room.ConferenceRoomMgtsys.dto.auth.TwoFactorSetupResponseDto;
import Room.ConferenceRoomMgtsys.dto.auth.UserProfileDto;
import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;
import Room.ConferenceRoomMgtsys.enums.AuthProvider;
import Room.ConferenceRoomMgtsys.enums.UserRole;
import Room.ConferenceRoomMgtsys.jwt.JwtUtil;
import Room.ConferenceRoomMgtsys.model.Organization;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.repository.OrganizationRepository;
import Room.ConferenceRoomMgtsys.repository.UserRepository;
import jakarta.transaction.Transactional;

@Service
public class AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private EmailService emailService;

    @Autowired
    private OrganizationRepository organizationRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${app.oauth.google.client-id:}")
    private String googleClientId;

    @Value("${app.oauth.google.client-secret:}")
    private String googleClientSecret;

    @Value("${app.oauth.google.redirect-uri:${app.frontend.url}/auth/callback}")
    private String googleRedirectUri;

    @Value("${app.frontend.url:}")
    private String frontendUrl;

    private final RestTemplate restTemplate = new RestTemplate();

    // Google OAuth URLs
    private static final String GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
    private static final String GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

    // === OAUTH LOGIN PROCESSING ===
    @Transactional
    public ResponseEntity<OAuthLoginResponseDto> processOAuthLogin(OAuthLoginDto request) {
        try {
            OAuthUserInfo oauthUserInfo = null;

            // Process based on provider
            switch (request.getProvider().toUpperCase()) {
                case "GOOGLE":
                    oauthUserInfo = processGoogleLogin(request.getAuthorizationCode());
                    break;
                default:
                    return createOAuthErrorResponse("Unsupported OAuth provider: " + request.getProvider());
            }

            if (oauthUserInfo == null) {
                return createOAuthErrorResponse("Failed to authenticate with OAuth provider");
            }

            // Check if user already exists in database
            Optional<User> existingUser = userRepository.findByEmail(oauthUserInfo.getEmail());
            
            if (existingUser.isPresent()) {
                User user = existingUser.get();
                
                // Update last login for existing user
                user.setLastLoginAt(LocalDateTime.now());
                user.setFailedLoginAttempts(0);
                userRepository.save(user);
                
                // --- TEMPORARY: Log user status for debugging ---
                System.out.println("Existing user OAuth login - Email: " + user.getEmail() +
                        ", IsActive: " + user.getIsActive() +
                        ", ApprovalStatus: " + user.getApprovalStatus() +
                        ", Organization: " + (user.getOrganization() != null ? user.getOrganization().getName() : "null"));
                // --- END TEMPORARY LOGGING ---
                
                // If user exists, continue with normal login flow (no organization selection needed)
                // User already has an account, so proceed to check approval status
            } else {
                // User doesn't exist, show organization selection page
                OAuthLoginResponseDto response = new OAuthLoginResponseDto();
                response.setSuccess(false);
                response.setMessage("Please select your organization to complete your account setup.");
                response.setOrganizationSelectionRequired(true);
                response.setUser(createUserProfileFromOAuth(oauthUserInfo));
                return ResponseEntity.ok(response);
            }
            
            // User exists, continue with normal flow
            User user = existingUser.get();

            // Check if user is approved (pending approval) - NEW USER SCENARIO
            if (user.getApprovalStatus() == ApprovalStatus.PENDING) {
                return createOAuthErrorResponse(
                        "Your account registration is pending admin approval. " +
                        "Please wait for an administrator to review and approve your account. " +
                        "You will receive an email notification once approved. " +
                        "If no action is taken within 5 hours, your account will be automatically deleted.");
            }

            // Check if account is locked
            if (user.getAccountLockedUntil() != null && user.getAccountLockedUntil().isAfter(LocalDateTime.now())) {
                return createOAuthErrorResponse("Account is temporarily locked. Please try again later.");
            }

            // Check if user is active (deactivated by admin) - EXISTING USER SCENARIO
            if (!user.getIsActive()) {
                return createOAuthErrorResponse(
                        "Your account has been deactivated by an administrator. " +
                        "Please contact your system administrator to reactivate your account.");
            }
            // Check if user is rejected
            if (user.getApprovalStatus() == ApprovalStatus.REJECTED) {
                return createOAuthErrorResponse(
                        "Your account registration has been rejected. Please contact your administrator for more information.");
            }

            // Generate tokens
            String accessToken = jwtUtil.generateToken(user.getEmail(), user.getRole().toString());
            String refreshToken = jwtUtil.generateRefreshToken(user.getEmail());

            // Update last login
            user.setLastLoginAt(LocalDateTime.now());
            user.setFailedLoginAttempts(0); // Reset failed attempts on successful login
            userRepository.save(user);

            // Create response
            OAuthLoginResponseDto response = new OAuthLoginResponseDto();
            response.setSuccess(true);
            response.setMessage("OAuth login successful");
            response.setToken(accessToken);
            response.setRefreshToken(refreshToken);
            response.setUser(createUserProfile(user));
            response.setOrganizationName(user.getOrganization() != null ? user.getOrganization().getName() : null);
            response.setOrganizationRole(user.getRole().toString());
            response.setMultipleOrganizations(false);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("OAuth processing error: " + e.getMessage());
            e.printStackTrace();
            return createOAuthErrorResponse("OAuth login failed: " + e.getMessage());
        }
    }

    // === TOKEN REFRESH ===
    public ResponseEntity<AuthResponseDto> refreshToken(String refreshToken) {
        try {
            if (!jwtUtil.validateRefreshToken(refreshToken)) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createAuthErrorResponse("Invalid refresh token"));
            }

            String email = jwtUtil.getEmailFromRefreshToken(refreshToken);
            User user = userRepository.findByEmail(email).orElse(null);

            if (user == null || !user.getIsApproved() || !user.getIsActive()) {
                return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                        .body(createAuthErrorResponse("User not found, not approved, or inactive"));
            }

            // Generate new tokens
            String newAccessToken = jwtUtil.generateToken(user.getEmail(), user.getRole().toString());
            String newRefreshToken = jwtUtil.generateRefreshToken(user.getEmail());

            AuthResponseDto response = new AuthResponseDto(
                    newAccessToken,
                    newRefreshToken,
                    86400000L, // 1 day
                    createUserProfile(user),
                    false,
                    AuthProvider.LOCAL);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(createAuthErrorResponse("Token refresh failed: " + e.getMessage()));
        }
    }

    // === 2FA SETUP ===
    public ResponseEntity<TwoFactorSetupResponseDto> setup2FA() {
        try {
            // Generate secret for TOTP
            String secret = generateBase32Secret();

            // Generate QR code URL (for Google Authenticator, etc.)
            String qrCodeUrl = generateQRCodeUrl(secret);

            // Generate backup codes
            List<String> backupCodes = generateBackupCodes();

            TwoFactorSetupResponseDto response = new TwoFactorSetupResponseDto(
                    qrCodeUrl,
                    secret,
                    backupCodes);

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            System.err.println("2FA setup error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build();
        }
    }

    // === GOOGLE OAUTH PROCESSING ===
    private OAuthUserInfo processGoogleLogin(String authorizationCode) {
        try {
            // Step 1: Exchange authorization code for access token
            GoogleTokenResponse tokenResponse = exchangeGoogleCodeForToken(authorizationCode);

            if (tokenResponse == null || tokenResponse.getAccessToken() == null) {
                System.err.println("Failed to get access token from Google");
                return null;
            }

            // Step 2: Get user info from Google
            return getGoogleUserInfo(tokenResponse.getAccessToken());

        } catch (Exception e) {
            System.err.println("Google OAuth error: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    // === EXCHANGE GOOGLE CODE FOR TOKEN ===
    private GoogleTokenResponse exchangeGoogleCodeForToken(String authorizationCode) {
        try {
            // Prepare request headers
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_FORM_URLENCODED);

            // Prepare request body
            MultiValueMap<String, String> params = new LinkedMultiValueMap<>();
            params.add("client_id", googleClientId);
            params.add("client_secret", googleClientSecret);
            params.add("code", authorizationCode);
            params.add("grant_type", "authorization_code");
            params.add("redirect_uri", googleRedirectUri);

            HttpEntity<MultiValueMap<String, String>> request = new HttpEntity<>(params, headers);

            // Make request to Google
            ResponseEntity<GoogleTokenResponse> response = restTemplate.postForEntity(
                    GOOGLE_TOKEN_URL,
                    request,
                    GoogleTokenResponse.class);

            if (response.getStatusCode() == HttpStatus.OK) {
                return response.getBody();
            } else {
                System.err.println("Google token exchange failed with status: " + response.getStatusCode());
                return null;
            }

        } catch (Exception e) {
            System.err.println("Error exchanging Google code for token: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    // === GET GOOGLE USER INFO ===
    private OAuthUserInfo getGoogleUserInfo(String accessToken) {
        try {
            // Prepare request headers
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(accessToken);
            headers.setContentType(MediaType.APPLICATION_JSON);

            HttpEntity<String> request = new HttpEntity<>(headers);

            // Make request to Google UserInfo API
            ResponseEntity<GoogleUserInfo> response = restTemplate.exchange(
                    GOOGLE_USERINFO_URL,
                    HttpMethod.GET,
                    request,
                    GoogleUserInfo.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                GoogleUserInfo userInfo = response.getBody();

                // Additional null check to prevent potential null pointer access
                if (userInfo != null) {
                    return new OAuthUserInfo(
                            userInfo.getId(),
                            userInfo.getGivenName() != null ? userInfo.getGivenName() : "",
                            userInfo.getFamilyName() != null ? userInfo.getFamilyName() : "",
                            userInfo.getEmail());
                }
            }

            System.err.println("Google userinfo request failed with status: " + response.getStatusCode());
            return null;

        } catch (Exception e) {
            System.err.println("Error getting Google user info: " + e.getMessage());
            e.printStackTrace();
            return null;
        }
    }

    // === CREATE USER PROFILE FROM OAUTH INFO ===
    private UserProfileDto createUserProfileFromOAuth(OAuthUserInfo oauthUserInfo) {
        UserProfileDto profile = new UserProfileDto();
        profile.setEmail(oauthUserInfo.getEmail());
        profile.setFirstName(oauthUserInfo.getFirstName());
        profile.setLastName(oauthUserInfo.getLastName());
        return profile;
    }

    // === CREATE NEW OAUTH USER ===
    @Transactional
    private User createNewOAuthUser(OAuthUserInfo oauthUserInfo, String provider) {
        // Create new user from OAuth info
        User newUser = new User();
        newUser.setFirstName(oauthUserInfo.getFirstName());
        newUser.setLastName(oauthUserInfo.getLastName());
        newUser.setEmail(oauthUserInfo.getEmail());
        newUser.setRole(UserRole.USER);
        newUser.setApprovalStatus(ApprovalStatus.PENDING);
        newUser.setIsApproved(false);
        newUser.setIsActive(false); // Set to false until approved
        newUser.setIsEmailVerified(true); // OAuth emails are considered verified
        newUser.setEmailVerifiedAt(LocalDateTime.now());
        newUser.setIsTwoFactorEnabled(false);
        newUser.setFailedLoginAttempts(0);

        // No password needed for OAuth users initially
        newUser.setPasswordHash("");

        User savedUser = userRepository.save(newUser);

        // Send welcome email for new OAuth users
        try {
            emailService.sendWelcomeEmail(savedUser);
        } catch (Exception e) {
            System.err.println("Failed to send welcome email: " + e.getMessage());
        }

        return savedUser;
    }

    // === HELPER METHODS ===
    private String generateBase32Secret() {
        SecureRandom random = new SecureRandom();
        byte[] bytes = new byte[20];
        random.nextBytes(bytes);
        return Base64.getEncoder().encodeToString(bytes);
    }

    private String generateQRCodeUrl(String secret) {
        String appName = "Conference Room System";
        String userEmail = "user@example.com"; // This should come from current user
        return String.format(
                "otpauth://totp/%s:%s?secret=%s&issuer=%s",
                appName, userEmail, secret, appName);
    }

    private List<String> generateBackupCodes() {
        List<String> codes = new ArrayList<>();
        SecureRandom random = new SecureRandom();

        for (int i = 0; i < 10; i++) {
            codes.add(String.format("%08d", random.nextInt(100000000)));
        }

        return codes;
    }

    private UserProfileDto createUserProfile(User user) {
        UserProfileDto profile = new UserProfileDto();
        profile.setId(user.getId());
        profile.setFirstName(user.getFirstName());
        profile.setLastName(user.getLastName());
        profile.setEmail(user.getEmail());
        profile.setRole(user.getRole().toString());
        profile.setOrganizationName(user.getOrganization() != null ? user.getOrganization().getName() : null);
        profile.setProfilePictureUrl(user.getProfilePictureUrl());
        profile.setLastLogin(user.getLastLoginAt() != null ? user.getLastLoginAt().toString() : null);
        profile.setActive(user.getIsActive());
        profile.setEmailVerified(user.getIsEmailVerified());
        profile.setTwoFactorEnabled(user.getIsTwoFactorEnabled());
        return profile;
    }

    private ResponseEntity<OAuthLoginResponseDto> createOAuthErrorResponse(String message) {
        OAuthLoginResponseDto response = new OAuthLoginResponseDto();
        response.setSuccess(false);
        response.setMessage(message);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }

    private AuthResponseDto createAuthErrorResponse(String message) {
        AuthResponseDto response = new AuthResponseDto();
        response.setRequiresTwoFactor(false);
        response.setSuccess(false);
        response.setMessage(message);
        return response;
    }

    // === GOOGLE API RESPONSE CLASSES ===
    public static class GoogleTokenResponse {
        @JsonProperty("access_token")
        private String accessToken;

        @JsonProperty("expires_in")
        private Long expiresIn;

        @JsonProperty("refresh_token")
        private String refreshToken;

        @JsonProperty("scope")
        private String scope;

        @JsonProperty("token_type")
        private String tokenType;

        // Getters and setters
        public String getAccessToken() {
            return accessToken;
        }

        public void setAccessToken(String accessToken) {
            this.accessToken = accessToken;
        }

        public Long getExpiresIn() {
            return expiresIn;
        }

        public void setExpiresIn(Long expiresIn) {
            this.expiresIn = expiresIn;
        }

        public String getRefreshToken() {
            return refreshToken;
        }

        public void setRefreshToken(String refreshToken) {
            this.refreshToken = refreshToken;
        }

        public String getScope() {
            return scope;
        }

        public void setScope(String scope) {
            this.scope = scope;
        }

        public String getTokenType() {
            return tokenType;
        }

        public void setTokenType(String tokenType) {
            this.tokenType = tokenType;
        }
    }

    public static class GoogleUserInfo {
        @JsonProperty("id")
        private String id;

        @JsonProperty("email")
        private String email;

        @JsonProperty("verified_email")
        private Boolean verifiedEmail;

        @JsonProperty("name")
        private String name;

        @JsonProperty("given_name")
        private String givenName;

        @JsonProperty("family_name")
        private String familyName;

        @JsonProperty("picture")
        private String picture;

        @JsonProperty("locale")
        private String locale;

        // Getters and setters
        public String getId() {
            return id;
        }

        public void setId(String id) {
            this.id = id;
        }

        public String getEmail() {
            return email;
        }

        public void setEmail(String email) {
            this.email = email;
        }

        public Boolean getVerifiedEmail() {
            return verifiedEmail;
        }

        public void setVerifiedEmail(Boolean verifiedEmail) {
            this.verifiedEmail = verifiedEmail;
        }

        public String getName() {
            return name;
        }

        public void setName(String name) {
            this.name = name;
        }

        public String getGivenName() {
            return givenName;
        }

        public void setGivenName(String givenName) {
            this.givenName = givenName;
        }

        public String getFamilyName() {
            return familyName;
        }

        public void setFamilyName(String familyName) {
            this.familyName = familyName;
        }

        public String getPicture() {
            return picture;
        }

        public void setPicture(String picture) {
            this.picture = picture;
        }

        public String getLocale() {
            return locale;
        }

        public void setLocale(String locale) {
            this.locale = locale;
        }
    }

    // === OAUTH USER INFO CLASS ===
    public static class OAuthUserInfo {
        private String providerId;
        private String firstName;
        private String lastName;
        private String email;

        public OAuthUserInfo(String providerId, String firstName, String lastName, String email) {
            this.providerId = providerId;
            this.firstName = firstName;
            this.lastName = lastName;
            this.email = email;
        }

        public String getProviderId() {
            return providerId;
        }

        public String getFirstName() {
            return firstName;
        }

        public String getLastName() {
            return lastName;
        }

        public String getEmail() {
            return email;
        }
    }

    // === OAUTH ORGANIZATION SELECTION ===
    @Transactional
    public ResponseEntity<OAuthLoginResponseDto> selectOAuthOrganization(OAuthOrganizationSelectionDto request) {
        try {
            // Validate password
            if (request.getPassword() == null || request.getPassword().trim().isEmpty()) {
                return createOAuthErrorResponse("Password is required");
            }

            if (!request.getPassword().equals(request.getConfirmPassword())) {
                return createOAuthErrorResponse("Passwords do not match");
            }

            if (request.getPassword().length() < 6) {
                return createOAuthErrorResponse("Password must be at least 6 characters long");
            }

            // Check if user already exists
            Optional<User> existingUser = userRepository.findByEmail(request.getEmail());
            if (existingUser.isPresent()) {
                return createOAuthErrorResponse("User with this email already exists");
            }

            // Find the organization
            Organization organization = organizationRepository.findByName(request.getOrganizationName())
                    .orElseThrow(() -> new RuntimeException("Organization not found"));

            // Create new user with OAuth info and selected organization
            User newUser = new User();
            newUser.setEmail(request.getEmail());
            newUser.setFirstName(request.getFirstName());
            newUser.setLastName(request.getLastName());
            newUser.setOrganization(organization);
            newUser.setRole(UserRole.USER);
            newUser.setApprovalStatus(ApprovalStatus.PENDING);
            newUser.setIsApproved(false);
            newUser.setIsActive(false);
            newUser.setIsEmailVerified(true);
            newUser.setEmailVerifiedAt(LocalDateTime.now());
            newUser.setIsTwoFactorEnabled(false);
            newUser.setFailedLoginAttempts(0);
            
            // Set password
            newUser.setPasswordHash(passwordEncoder.encode(request.getPassword()));

            User savedUser = userRepository.save(newUser);

            // Send welcome email
            try {
                emailService.sendWelcomeEmail(savedUser);
            } catch (Exception e) {
                System.err.println("Failed to send welcome email: " + e.getMessage());
            }

            // Create response indicating approval is needed
            OAuthLoginResponseDto response = new OAuthLoginResponseDto();
            response.setSuccess(false);
            response.setMessage("Account created successfully. Your account is now pending admin approval. You will receive an email notification once approved.");
            response.setOrganizationSelectionRequired(false);
            response.setUser(createUserProfile(savedUser));

            return ResponseEntity.ok(response);

        } catch (Exception e) {
            return createOAuthErrorResponse("Failed to create account: " + e.getMessage());
        }
    }
}