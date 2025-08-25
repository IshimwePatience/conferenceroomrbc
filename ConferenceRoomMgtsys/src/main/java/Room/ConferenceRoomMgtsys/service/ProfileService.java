package Room.ConferenceRoomMgtsys.service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Random;
import java.util.UUID;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Pageable;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import Room.ConferenceRoomMgtsys.dto.user.PasswordChangeRequestDto;
import Room.ConferenceRoomMgtsys.dto.user.ProfileUpdateDto;
import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;
import Room.ConferenceRoomMgtsys.enums.UserRole;
import Room.ConferenceRoomMgtsys.model.EmailChangeRequest;
import Room.ConferenceRoomMgtsys.model.Otp;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.repository.EmailChangeRequestRepository;
import Room.ConferenceRoomMgtsys.repository.OtpRepository;
import Room.ConferenceRoomMgtsys.repository.UserRepository;

@Service
public class ProfileService {

    private static final Logger logger = LoggerFactory.getLogger(ProfileService.class);

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private OtpRepository otpRepository;

    @Autowired
    private EmailChangeRequestRepository emailChangeRequestRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Value("${file.upload-dir:/tmp/uploads}/profiles")
    private String uploadPath;

    /**
     * Update basic profile information (names, profile picture)
     */
    @Transactional
    public User updateBasicProfile(UUID userId, ProfileUpdateDto updateDto) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Update basic fields
        if (updateDto.getFirstName() != null && !updateDto.getFirstName().trim().isEmpty()) {
            user.setFirstName(updateDto.getFirstName().trim());
        }
        if (updateDto.getLastName() != null && !updateDto.getLastName().trim().isEmpty()) {
            user.setLastName(updateDto.getLastName().trim());
        }
        if (updateDto.getProfilePictureUrl() != null) {
            user.setProfilePictureUrl(updateDto.getProfilePictureUrl());
        }

        return userRepository.save(user);
    }

    /**
     * Request email change (requires admin approval)
     */
    @Transactional
    public EmailChangeRequest requestEmailChange(UUID userId, String newEmail, String reason) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Check if new email already exists
        if (userRepository.findByEmail(newEmail).isPresent()) {
            throw new IllegalArgumentException("Email already exists");
        }

        // Check if user already has a pending email change request
        List<EmailChangeRequest> pendingRequests = emailChangeRequestRepository.findByUserAndStatus(user, ApprovalStatus.PENDING);
        if (!pendingRequests.isEmpty()) {
            throw new IllegalArgumentException("You already have a pending email change request");
        }

        // Create email change request
        EmailChangeRequest request = new EmailChangeRequest(user, user.getEmail(), newEmail, reason);
        EmailChangeRequest savedRequest = emailChangeRequestRepository.save(request);

        // Notify appropriate admins based on user role
        notifyAdminsForEmailChange(user, savedRequest);

        return savedRequest;
    }

    /**
     * Approve email change request
     */
    @Transactional
    public void approveEmailChange(UUID requestId, User approver) {
        EmailChangeRequest request = emailChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Email change request not found"));

        if (request.getStatus() != ApprovalStatus.PENDING) {
            throw new IllegalArgumentException("Request is not pending");
        }

        // Check if approver has permission
        if (!canApproveEmailChange(request.getUser(), approver)) {
            throw new IllegalArgumentException("You don't have permission to approve this request");
        }

        // Update request status
        request.setStatus(ApprovalStatus.APPROVED);
        request.setApprovedBy(approver);
        request.setApprovedAt(LocalDateTime.now());
        emailChangeRequestRepository.save(request);

        // Update user's email
        User user = request.getUser();
        user.setEmail(request.getNewEmail());
        userRepository.save(user);

        // Send notification emails
        emailService.sendEmailChangeApprovalEmail(user.getEmail(), user.getFirstName());
        emailService.sendEmailChangeNotification(user, request.getCurrentEmail(), request.getNewEmail(), List.of(approver));
    }

    /**
     * Reject email change request
     */
    @Transactional
    public void rejectEmailChange(UUID requestId, User rejector, String rejectionReason) {
        EmailChangeRequest request = emailChangeRequestRepository.findById(requestId)
                .orElseThrow(() -> new IllegalArgumentException("Email change request not found"));

        if (request.getStatus() != ApprovalStatus.PENDING) {
            throw new IllegalArgumentException("Request is not pending");
        }

        // Check if rejector has permission
        if (!canApproveEmailChange(request.getUser(), rejector)) {
            throw new IllegalArgumentException("You don't have permission to reject this request");
        }

        // Update request status
        request.setStatus(ApprovalStatus.REJECTED);
        request.setRejectedBy(rejector);
        request.setRejectedAt(LocalDateTime.now());
        request.setRejectionReason(rejectionReason);
        emailChangeRequestRepository.save(request);

        // Send notification emails
        emailService.sendEmailChangeRejectionEmail(request.getUser().getEmail(), request.getUser().getFirstName(), rejectionReason);
    }

    /**
     * Generate and send OTP for password change
     */
    @Transactional
    public void generateOtpForPasswordChange(String email) {
        User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Generate 6-digit OTP
        String otpCode = generateOtpCode();
        
        // Create OTP record
        Otp otp = new Otp(email, otpCode, "PASSWORD_CHANGE", LocalDateTime.now().plusMinutes(10), user);
        otpRepository.save(otp);

        // Send OTP email
        emailService.sendOtpEmail(email, user.getFirstName(), otpCode, "password change");
    }

    /**
     * Change password using OTP verification
     */
    @Transactional
    public void changePasswordWithOtp(PasswordChangeRequestDto requestDto) {
        // Verify OTP
        Otp otp = otpRepository.findByEmailAndPurposeAndCode(
                requestDto.getCurrentPassword(), // Using currentPassword field for email
                "PASSWORD_CHANGE", 
                requestDto.getOtp()
        ).orElseThrow(() -> new IllegalArgumentException("Invalid or expired OTP"));

        if (!otp.isValid()) {
            throw new IllegalArgumentException("OTP is invalid or expired");
        }

        User user = userRepository.findByEmail(otp.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Validate new password
        if (requestDto.getNewPassword() == null || requestDto.getNewPassword().length() < 6) {
            throw new IllegalArgumentException("New password must be at least 6 characters long");
        }

        if (!requestDto.getNewPassword().equals(requestDto.getConfirmPassword())) {
            throw new IllegalArgumentException("New password and confirmation do not match");
        }

        // Update password
        user.setPasswordHash(passwordEncoder.encode(requestDto.getNewPassword()));
        userRepository.save(user);

        // Mark OTP as used
        otp.setIsUsed(true);
        otp.setUsedAt(LocalDateTime.now());
        otpRepository.save(otp);

        // Send confirmation email
        emailService.sendPasswordChangeConfirmationEmail(user.getEmail(), user.getFirstName());
    }

    /**
     * Get pending email change requests for admin
     */
    @Transactional(readOnly = true)
    public List<EmailChangeRequest> getPendingEmailChangeRequests(User admin) {
        try {
            if (admin.getRole() == UserRole.SYSTEM_ADMIN) {
                return emailChangeRequestRepository.findByStatus(ApprovalStatus.PENDING);
            } else if (admin.getRole() == UserRole.ADMIN && admin.getOrganization() != null) {
                String orgName = admin.getOrganization().getName();
                logger.info("Fetching email change requests for organization: {}", orgName);
                
                try {
                    // Try the optimized query first
                    return emailChangeRequestRepository.findByOrganizationAndStatus(orgName, ApprovalStatus.PENDING);
                } catch (Exception e) {
                    logger.warn("Optimized query failed, falling back to manual filtering: {}", e.getMessage());
                    // Fallback: get all pending requests and filter by organization
                    List<EmailChangeRequest> allPending = emailChangeRequestRepository.findByStatus(ApprovalStatus.PENDING);
                    return allPending.stream()
                        .filter(request -> request.getUser() != null && 
                                         request.getUser().getOrganization() != null &&
                                         orgName.equals(request.getUser().getOrganization().getName()))
                        .toList();
                }
            }
            return List.of();
        } catch (Exception e) {
            logger.error("Error fetching pending email change requests for admin: {}", admin.getEmail(), e);
            throw e;
        }
    }

    /**
     * Get user's email change requests
     */
    @Transactional(readOnly = true)
    public List<EmailChangeRequest> getUserEmailChangeRequests(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return emailChangeRequestRepository.findByUserAndStatus(user, ApprovalStatus.PENDING);
    }

    /**
     * Check if user can approve email change request
     */
    private boolean canApproveEmailChange(User requestUser, User approver) {
        // System admin can approve any request
        if (approver.getRole() == UserRole.SYSTEM_ADMIN) {
            return true;
        }

        // Organization admin can approve requests from their organization
        if (approver.getRole() == UserRole.ADMIN && 
            requestUser.getOrganization() != null && 
            approver.getOrganization() != null &&
            requestUser.getOrganization().getId().equals(approver.getOrganization().getId())) {
            return true;
        }

        return false;
    }

    /**
     * Generate 6-digit OTP code
     */
    private String generateOtpCode() {
        Random random = new Random();
        int otp = 100000 + random.nextInt(900000); // 6-digit number
        return String.valueOf(otp);
    }

    /**
     * Notify appropriate admins for email change request
     */
    private void notifyAdminsForEmailChange(User user, EmailChangeRequest request) {
        try {
            if (user.getRole() == UserRole.ADMIN) {
                // Admin needs system admin approval
                List<User> systemAdmins = userRepository.findByRole(UserRole.SYSTEM_ADMIN, Pageable.unpaged()).getContent();
                for (User sysAdmin : systemAdmins) {
                    emailService.sendEmailChangeRequestNotification(sysAdmin.getEmail(), user, request);
                }
            } else if (user.getRole() == UserRole.USER) {
                // User needs either system admin or organization admin approval
                List<User> systemAdmins = userRepository.findByRole(UserRole.SYSTEM_ADMIN, Pageable.unpaged()).getContent();
                for (User sysAdmin : systemAdmins) {
                    emailService.sendEmailChangeRequestNotification(sysAdmin.getEmail(), user, request);
                }

                if (user.getOrganization() != null) {
                    List<User> orgAdmins = userRepository.findByOrganizationAndRole(user.getOrganization(), UserRole.ADMIN);
                    for (User orgAdmin : orgAdmins) {
                        emailService.sendEmailChangeRequestNotification(orgAdmin.getEmail(), user, request);
                    }
                }
            }
        } catch (Exception e) {
            logger.error("Failed to send email change notifications", e);
        }
    }

    /**
     * Upload profile picture
     */
    @Transactional
    public String uploadProfilePicture(UUID userId, MultipartFile file) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        // Validate file
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Please select a file to upload");
        }

        // Check file type
        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith("image/")) {
            throw new IllegalArgumentException("Only image files are allowed");
        }

        // Check file size (max 5MB)
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("File size must be less than 5MB");
        }

        try {
            // Create upload directory if it doesn't exist
            Path uploadDir = Paths.get(uploadPath);
            if (!Files.exists(uploadDir)) {
                Files.createDirectories(uploadDir);
            }

            // Generate unique filename
            String originalFilename = file.getOriginalFilename();
            String fileExtension = originalFilename != null ? 
                originalFilename.substring(originalFilename.lastIndexOf(".")) : ".jpg";
            String filename = userId + "_" + System.currentTimeMillis() + fileExtension;

            // Save file
            Path filePath = uploadDir.resolve(filename);
            Files.copy(file.getInputStream(), filePath);

            // Generate URL for the uploaded file
            String profilePictureUrl = "/uploads/profiles/" + filename;

            // Update user's profile picture URL
            user.setProfilePictureUrl(profilePictureUrl);
            userRepository.save(user);

            return profilePictureUrl;
        } catch (IOException e) {
            logger.error("Failed to upload profile picture", e);
            throw new IllegalArgumentException("Failed to upload file: " + e.getMessage());
        }
    }
}
