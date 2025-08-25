package Room.ConferenceRoomMgtsys.dto.auth;

public class OAuthOrganizationSelectionDto {
    private String email;
    private String organizationName;
    private String password;
    private String confirmPassword;
    private String firstName;
    private String lastName;

    // Default constructor
    public OAuthOrganizationSelectionDto() {}

    // Constructor with fields
    public OAuthOrganizationSelectionDto(String email, String organizationName, String password, String confirmPassword, String firstName, String lastName) {
        this.email = email;
        this.organizationName = organizationName;
        this.password = password;
        this.confirmPassword = confirmPassword;
        this.firstName = firstName;
        this.lastName = lastName;
    }

    // Getters and Setters
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public String getConfirmPassword() {
        return confirmPassword;
    }

    public void setConfirmPassword(String confirmPassword) {
        this.confirmPassword = confirmPassword;
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
