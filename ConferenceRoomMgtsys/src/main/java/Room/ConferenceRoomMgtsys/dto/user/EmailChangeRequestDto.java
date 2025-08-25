package Room.ConferenceRoomMgtsys.dto.user;

import java.time.LocalDateTime;
import java.util.UUID;

import com.fasterxml.jackson.annotation.JsonInclude;

import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;
import Room.ConferenceRoomMgtsys.model.EmailChangeRequest;

@JsonInclude(JsonInclude.Include.NON_NULL)
public class EmailChangeRequestDto {
    private UUID id;
    private String currentEmail;
    private String newEmail;
    private String reason;
    private ApprovalStatus status;
    private LocalDateTime createdAt;
    private LocalDateTime expiresAt;
    
    // User information (flattened to avoid circular reference)
    private UUID userId;
    private String userFirstName;
    private String userLastName;
    private String userEmail;
    
    // Approval information
    private UUID approvedById;
    private String approvedByFirstName;
    private String approvedByLastName;
    private LocalDateTime approvedAt;
    
    // Rejection information
    private UUID rejectedById;
    private String rejectedByFirstName;
    private String rejectedByLastName;
    private LocalDateTime rejectedAt;
    private String rejectionReason;

    public EmailChangeRequestDto() {}

    public static EmailChangeRequestDto fromEntity(EmailChangeRequest entity) {
        EmailChangeRequestDto dto = new EmailChangeRequestDto();
        dto.setId(entity.getId());
        dto.setCurrentEmail(entity.getCurrentEmail());
        dto.setNewEmail(entity.getNewEmail());
        dto.setReason(entity.getReason());
        dto.setStatus(entity.getStatus());
        dto.setCreatedAt(entity.getCreatedAt());
        dto.setExpiresAt(entity.getExpiresAt());
        
        // Set user information
        if (entity.getUser() != null) {
            dto.setUserId(entity.getUser().getId());
            dto.setUserFirstName(entity.getUser().getFirstName());
            dto.setUserLastName(entity.getUser().getLastName());
            dto.setUserEmail(entity.getUser().getEmail());
        }
        
        // Set approval information
        if (entity.getApprovedBy() != null) {
            dto.setApprovedById(entity.getApprovedBy().getId());
            dto.setApprovedByFirstName(entity.getApprovedBy().getFirstName());
            dto.setApprovedByLastName(entity.getApprovedBy().getLastName());
            dto.setApprovedAt(entity.getApprovedAt());
        }
        
        // Set rejection information
        if (entity.getRejectedBy() != null) {
            dto.setRejectedById(entity.getRejectedBy().getId());
            dto.setRejectedByFirstName(entity.getRejectedBy().getFirstName());
            dto.setRejectedByLastName(entity.getRejectedBy().getLastName());
            dto.setRejectedAt(entity.getRejectedAt());
            dto.setRejectionReason(entity.getRejectionReason());
        }
        
        return dto;
    }

    // Getters and Setters
    public UUID getId() {
        return id;
    }

    public void setId(UUID id) {
        this.id = id;
    }

    public String getCurrentEmail() {
        return currentEmail;
    }

    public void setCurrentEmail(String currentEmail) {
        this.currentEmail = currentEmail;
    }

    public String getNewEmail() {
        return newEmail;
    }

    public void setNewEmail(String newEmail) {
        this.newEmail = newEmail;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public ApprovalStatus getStatus() {
        return status;
    }

    public void setStatus(ApprovalStatus status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public UUID getUserId() {
        return userId;
    }

    public void setUserId(UUID userId) {
        this.userId = userId;
    }

    public String getUserFirstName() {
        return userFirstName;
    }

    public void setUserFirstName(String userFirstName) {
        this.userFirstName = userFirstName;
    }

    public String getUserLastName() {
        return userLastName;
    }

    public void setUserLastName(String userLastName) {
        this.userLastName = userLastName;
    }

    public String getUserEmail() {
        return userEmail;
    }

    public void setUserEmail(String userEmail) {
        this.userEmail = userEmail;
    }

    public UUID getApprovedById() {
        return approvedById;
    }

    public void setApprovedById(UUID approvedById) {
        this.approvedById = approvedById;
    }

    public String getApprovedByFirstName() {
        return approvedByFirstName;
    }

    public void setApprovedByFirstName(String approvedByFirstName) {
        this.approvedByFirstName = approvedByFirstName;
    }

    public String getApprovedByLastName() {
        return approvedByLastName;
    }

    public void setApprovedByLastName(String approvedByLastName) {
        this.approvedByLastName = approvedByLastName;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public UUID getRejectedById() {
        return rejectedById;
    }

    public void setRejectedById(UUID rejectedById) {
        this.rejectedById = rejectedById;
    }

    public String getRejectedByFirstName() {
        return rejectedByFirstName;
    }

    public void setRejectedByFirstName(String rejectedByFirstName) {
        this.rejectedByFirstName = rejectedByFirstName;
    }

    public String getRejectedByLastName() {
        return rejectedByLastName;
    }

    public void setRejectedByLastName(String rejectedByLastName) {
        this.rejectedByLastName = rejectedByLastName;
    }

    public LocalDateTime getRejectedAt() {
        return rejectedAt;
    }

    public void setRejectedAt(LocalDateTime rejectedAt) {
        this.rejectedAt = rejectedAt;
    }

    public String getRejectionReason() {
        return rejectionReason;
    }

    public void setRejectionReason(String rejectionReason) {
        this.rejectionReason = rejectionReason;
    }
}
