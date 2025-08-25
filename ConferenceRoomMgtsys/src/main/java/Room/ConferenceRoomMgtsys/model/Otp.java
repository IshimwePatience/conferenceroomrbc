package Room.ConferenceRoomMgtsys.model;

import java.time.LocalDateTime;

import Room.ConferenceRoomMgtsys.model.base.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

@Entity
@Table(name = "otps")
public class Otp extends BaseEntity {

    @Column(name = "email", nullable = false)
    private String email;

    @Column(name = "otp_code", nullable = false)
    private String otpCode;

    @Column(name = "purpose", nullable = false)
    private String purpose;

    @Column(name = "expires_at", nullable = false)
    private LocalDateTime expiresAt;

    @Column(name = "is_used", nullable = false)
    private Boolean isUsed = false;

    @Column(name = "used_at")
    private LocalDateTime usedAt;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private User user;

    // Default constructor
    public Otp() {}

    // Constructor with fields
    public Otp(String email, String otpCode, String purpose, LocalDateTime expiresAt, User user) {
        this.email = email;
        this.otpCode = otpCode;
        this.purpose = purpose;
        this.expiresAt = expiresAt;
        this.user = user;
    }

    // Getters and Setters
    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getOtpCode() {
        return otpCode;
    }

    public void setOtpCode(String otpCode) {
        this.otpCode = otpCode;
    }

    public String getPurpose() {
        return purpose;
    }

    public void setPurpose(String purpose) {
        this.purpose = purpose;
    }

    public LocalDateTime getExpiresAt() {
        return expiresAt;
    }

    public void setExpiresAt(LocalDateTime expiresAt) {
        this.expiresAt = expiresAt;
    }

    public Boolean getIsUsed() {
        return isUsed;
    }

    public void setIsUsed(Boolean isUsed) {
        this.isUsed = isUsed;
    }

    public LocalDateTime getUsedAt() {
        return usedAt;
    }

    public void setUsedAt(LocalDateTime usedAt) {
        this.usedAt = usedAt;
    }

    public User getUser() {
        return user;
    }

    public void setUser(User user) {
        this.user = user;
    }

    // Helper method to check if OTP is expired
    public boolean isExpired() {
        return LocalDateTime.now().isAfter(this.expiresAt);
    }

    // Helper method to check if OTP is valid (not used and not expired)
    public boolean isValid() {
        return !this.isUsed && !this.isExpired();
    }
}
