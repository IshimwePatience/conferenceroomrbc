package Room.ConferenceRoomMgtsys.dto.user;

public class PasswordChangeRequestDto {
    private String currentPassword;
    private String newPassword;
    private String confirmPassword;
    private String otp;

    // Default constructor
    public PasswordChangeRequestDto() {}

    // Constructor with fields
    public PasswordChangeRequestDto(String currentPassword, String newPassword, String confirmPassword, String otp) {
        this.currentPassword = currentPassword;
        this.newPassword = newPassword;
        this.confirmPassword = confirmPassword;
        this.otp = otp;
    }

    // Getters and Setters
    public String getCurrentPassword() {
        return currentPassword;
    }

    public void setCurrentPassword(String currentPassword) {
        this.currentPassword = currentPassword;
    }

    public String getNewPassword() {
        return newPassword;
    }

    public void setNewPassword(String newPassword) {
        this.newPassword = newPassword;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
    }

    public String getOtp() {
        return otp;
    }

    public void setOtp(String otp) {
        this.otp = otp;
    }
}
