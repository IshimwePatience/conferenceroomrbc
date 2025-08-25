package Room.ConferenceRoomMgtsys.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import Room.ConferenceRoomMgtsys.model.Otp;
import Room.ConferenceRoomMgtsys.model.User;

@Repository
public interface OtpRepository extends JpaRepository<Otp, UUID> {

    // Find valid OTP by email and purpose
    @Query("SELECT o FROM Otp o WHERE o.email = :email AND o.purpose = :purpose AND o.isUsed = false AND o.expiresAt > :now")
    Optional<Otp> findValidOtpByEmailAndPurpose(@Param("email") String email, @Param("purpose") String purpose, @Param("now") LocalDateTime now);

    // Find OTP by email, purpose and code
    @Query("SELECT o FROM Otp o WHERE o.email = :email AND o.purpose = :purpose AND o.otpCode = :otpCode")
    Optional<Otp> findByEmailAndPurposeAndCode(@Param("email") String email, @Param("purpose") String purpose, @Param("otpCode") String otpCode);

    // Find all OTPs for a user
    List<Otp> findByUser(User user);

    // Find expired OTPs
    @Query("SELECT o FROM Otp o WHERE o.expiresAt < :now")
    List<Otp> findExpiredOtps(@Param("now") LocalDateTime now);

    // Delete expired OTPs
    @Query("DELETE FROM Otp o WHERE o.expiresAt < :now")
    void deleteExpiredOtps(@Param("now") LocalDateTime now);
}
