package Room.ConferenceRoomMgtsys.dto.user;

import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;

public class UserStatusResponseDto {
    private ApprovalStatus approvalStatus;
    private Boolean isActive;
    private Boolean isApproved;
    private String email;
    private String firstName;
    private String lastName;

    // Default constructor
    public UserStatusResponseDto() {}

    // Constructor with all fields
    public UserStatusResponseDto(ApprovalStatus approvalStatus, Boolean isActive, Boolean isApproved, 
                                String email, String firstName, String lastName) {
        this.approvalStatus = approvalStatus;
        this.isActive = isActive;
        this.isApproved = isApproved;
        this.email = email;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    // Getters and Setters
    public ApprovalStatus getApprovalStatus() {
        return approvalStatus;
    }

    public void setApprovalStatus(ApprovalStatus approvalStatus) {
        this.approvalStatus = approvalStatus;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public Boolean getIsApproved() {
        return isApproved;
    }

    public void setIsApproved(Boolean isApproved) {
        this.isApproved = isApproved;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getFirstName() {
        return firstName;
    }

    public void setFirstName(String firstName) {
        this.firstName = firstName;
    }

    public String getLastName() {
        return lastName;
    }

    public void setLastName(String lastName) {
        this.lastName = lastName;
    }
}
