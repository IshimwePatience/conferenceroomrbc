package Room.ConferenceRoomMgtsys.repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;
import Room.ConferenceRoomMgtsys.model.EmailChangeRequest;
import Room.ConferenceRoomMgtsys.model.User;

@Repository
public interface EmailChangeRequestRepository extends JpaRepository<EmailChangeRequest, UUID> {

    // Find pending requests by user
    List<EmailChangeRequest> findByUserAndStatus(User user, ApprovalStatus status);

    // Find pending requests for organization admins to approve
    @Query("SELECT e FROM EmailChangeRequest e WHERE e.user.organization.name = :organizationName AND e.status = :status")
    List<EmailChangeRequest> findByOrganizationAndStatus(@Param("organizationName") String organizationName, @Param("status") ApprovalStatus status);

    // Find all pending requests for system admins
    List<EmailChangeRequest> findByStatus(ApprovalStatus status);

    // Find request by user and new email
    Optional<EmailChangeRequest> findByUserAndNewEmail(User user, String newEmail);

    // Find expired requests
    @Query("SELECT e FROM EmailChangeRequest e WHERE e.expiresAt < :now")
    List<EmailChangeRequest> findExpiredRequests(@Param("now") LocalDateTime now);

    // Delete expired requests
    @Query("DELETE FROM EmailChangeRequest e WHERE e.expiresAt < :now")
    void deleteExpiredRequests(@Param("now") LocalDateTime now);
}
