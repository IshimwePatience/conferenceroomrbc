package Room.ConferenceRoomMgtsys.service;

import java.time.LocalDateTime;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import Room.ConferenceRoomMgtsys.enums.ApprovalStatus;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.repository.UserRepository;

@Service
public class UserApprovalCleanupService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private EmailService emailService;

    /**
     * Scheduled task that runs every hour to clean up unapproved users
     * who have been pending for more than 5 hours
     */
    @Scheduled(fixedRate = 3600000) // Run every hour (1 hour = 3600000 milliseconds)
    @Transactional
    public void cleanupUnapprovedUsers() {
        LocalDateTime fiveHoursAgo = LocalDateTime.now().minusHours(5);
        
        // Find all users that are still pending and were created more than 5 hours ago
        List<User> unapprovedUsers = userRepository.findByApprovalStatusAndCreatedAtBefore(
            ApprovalStatus.PENDING, 
            fiveHoursAgo
        );

        for (User user : unapprovedUsers) {
            try {
                // Send timeout notification email
                emailService.sendTimeoutNotificationEmail(user.getEmail(), user.getFirstName());
                
                // Delete the user from database
                userRepository.delete(user);
                
                System.out.println("Cleaned up unapproved user: " + user.getEmail() + " after 5-hour timeout");
            } catch (Exception e) {
                System.err.println("Failed to cleanup user " + user.getEmail() + ": " + e.getMessage());
            }
        }
        
        if (!unapprovedUsers.isEmpty()) {
            System.out.println("Cleaned up " + unapprovedUsers.size() + " unapproved users after timeout");
        }
    }

    /**
     * Manual cleanup method that can be called on demand
     */
    @Transactional
    public void manualCleanup() {
        cleanupUnapprovedUsers();
    }
}
