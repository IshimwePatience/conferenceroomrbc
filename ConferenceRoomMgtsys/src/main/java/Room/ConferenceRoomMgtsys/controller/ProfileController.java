package Room.ConferenceRoomMgtsys.controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import Room.ConferenceRoomMgtsys.dto.user.EmailChangeRequestDto;
import Room.ConferenceRoomMgtsys.dto.user.PasswordChangeRequestDto;
import Room.ConferenceRoomMgtsys.dto.user.ProfileUpdateDto;
import Room.ConferenceRoomMgtsys.model.EmailChangeRequest;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.service.ProfileService;

@RestController
@RequestMapping("/profile")
@CrossOrigin(origins = "*")
public class ProfileController {

    @Autowired
    private ProfileService profileService;

    /**
     * Update basic profile information (names, profile picture)
     */
    @PutMapping("/update")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> updateProfile(@AuthenticationPrincipal User user, @RequestBody ProfileUpdateDto updateDto) {
        try {
            User updatedUser = profileService.updateBasicProfile(user.getId(), updateDto);
            return ResponseEntity.ok(updatedUser);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Request email change (requires admin approval)
     */
    @PostMapping("/request-email-change")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> requestEmailChange(
            @AuthenticationPrincipal User user,
            @RequestParam String newEmail,
            @RequestParam String reason) {
        try {
            EmailChangeRequest request = profileService.requestEmailChange(user.getId(), newEmail, reason);
            return ResponseEntity.ok(request);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Generate OTP for password change
     */
    @PostMapping("/generate-otp")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> generateOtp(@RequestParam String email) {
        try {
            profileService.generateOtpForPasswordChange(email);
            return ResponseEntity.ok().body("OTP sent successfully to your email");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Change password using OTP verification
     */
    @PostMapping("/change-password")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> changePassword(@RequestBody PasswordChangeRequestDto requestDto) {
        try {
            profileService.changePasswordWithOtp(requestDto);
            return ResponseEntity.ok().body("Password changed successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Get pending email change requests for admin
     */
    @GetMapping("/email-change-requests")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> getPendingEmailChangeRequests(@AuthenticationPrincipal User admin) {
        try {
            List<EmailChangeRequest> requests = profileService.getPendingEmailChangeRequests(admin);
            // Convert entities to DTOs to avoid circular reference issues
            List<EmailChangeRequestDto> dtos = requests.stream()
                .map(EmailChangeRequestDto::fromEntity)
                .toList();
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Failed to fetch email change requests: " + e.getMessage());
        }
    }

    /**
     * Get user's email change requests
     */
    @GetMapping("/my-email-change-requests")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> getMyEmailChangeRequests(@AuthenticationPrincipal User user) {
        try {
            List<EmailChangeRequest> requests = profileService.getUserEmailChangeRequests(user.getId());
            // Convert entities to DTOs to avoid circular reference issues
            List<EmailChangeRequestDto> dtos = requests.stream()
                .map(EmailChangeRequestDto::fromEntity)
                .toList();
            return ResponseEntity.ok(dtos);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Approve email change request
     */
    @PostMapping("/approve-email-change/{requestId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> approveEmailChange(
            @PathVariable UUID requestId,
            @AuthenticationPrincipal User approver) {
        try {
            profileService.approveEmailChange(requestId, approver);
            return ResponseEntity.ok().body("Email change request approved successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Reject email change request
     */
    @PostMapping("/reject-email-change/{requestId}")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> rejectEmailChange(
            @PathVariable UUID requestId,
            @RequestParam String rejectionReason,
            @AuthenticationPrincipal User rejector) {
        try {
            profileService.rejectEmailChange(requestId, rejector, rejectionReason);
            return ResponseEntity.ok().body("Email change request rejected successfully");
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Upload profile picture
     */
    @PostMapping("/upload-picture")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> uploadProfilePicture(
            @AuthenticationPrincipal User user,
            @RequestParam("file") MultipartFile file) {
        try {
            String profilePictureUrl = profileService.uploadProfilePicture(user.getId(), file);
            return ResponseEntity.ok().body(Map.of("profilePictureUrl", profilePictureUrl));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Test endpoint to verify the backend is working
     */
    @GetMapping("/test")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<?> testEndpoint(@AuthenticationPrincipal User user) {
        try {
            Map<String, Object> response = new HashMap<>();
            response.put("message", "Profile controller is working");
            response.put("userEmail", user.getEmail());
            response.put("userRole", user.getRole());
            response.put("organization", user.getOrganization() != null ? user.getOrganization().getName() : "No organization");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Test failed: " + e.getMessage());
        }
    }
}
