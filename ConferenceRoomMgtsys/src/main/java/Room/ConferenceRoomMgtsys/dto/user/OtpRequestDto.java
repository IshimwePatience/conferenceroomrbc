package Room.ConferenceRoomMgtsys.dto.user;

public class OtpRequestDto {
    private String email;
    private String purpose; // "PASSWORD_CHANGE", "EMAIL_CHANGE", etc.

    // Default constructor
    public OtpRequestDto() {}

    // Constructor with fields
    public OtpRequestDto(String email, String purpose) {
        this.email = email;
        this.purpose = purpose;
    }

    // Getters and Setters
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }
}
