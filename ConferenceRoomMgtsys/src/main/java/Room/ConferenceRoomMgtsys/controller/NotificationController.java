package Room.ConferenceRoomMgtsys.controller;

import java.util.List;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import Room.ConferenceRoomMgtsys.dto.notification.NotificationResponseDto;
import Room.ConferenceRoomMgtsys.dto.notification.FrontendNotificationDto;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.service.NotificationService;

@RestController
@RequestMapping(value = "/notification")
@CrossOrigin(origins = { "http://localhost:5173", "http://10.8.150.139:8090",
        "https://conferenceroomsystem.vercel.app", "http://197.243.104.5"  })
public class NotificationController {

    @Autowired
    private NotificationService notificationService;

    /**
     * Get user's notifications with pagination
     * GET /notification/user
     */
    @GetMapping(value = "/user", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Page<NotificationResponseDto>> getUserNotifications(
            @AuthenticationPrincipal User user,
            Pageable pageable) {
        try {
            Page<NotificationResponseDto> notifications = notificationService.getUserNotifications(user, pageable);
            return new ResponseEntity<>(notifications, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(Page.empty(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get unread notifications for current user
     * GET /notification/unread
     */
    @GetMapping(value = "/unread", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<NotificationResponseDto>> getUnreadNotifications(
            @AuthenticationPrincipal User user) {
        try {
            List<NotificationResponseDto> notifications = notificationService.getUnreadNotifications(user);
            return new ResponseEntity<>(notifications, HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>(List.of(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get frontend notifications for the notification bell
     * GET /notifications
     */
    @GetMapping(value = "/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<List<FrontendNotificationDto>> getFrontendNotifications(@AuthenticationPrincipal User user) {
        try {
            System.out.println("=== NOTIFICATION DEBUG START ===");
            System.out.println("Fetching notifications for user: " + user.getEmail());
            System.out.println("User ID: " + user.getId());
            System.out.println("User Role: " + user.getRole());

            List<FrontendNotificationDto> notifications = notificationService.getFrontendNotifications(user);
            System.out.println("Found " + notifications.size() + " notifications for user: " + user.getEmail());
            System.out.println("=== NOTIFICATION DEBUG END ===");
            return new ResponseEntity<>(notifications, HttpStatus.OK);
        } catch (Exception e) {
            System.out.println("=== NOTIFICATION ERROR ===");
            System.out.println("Error fetching notifications: " + e.getMessage());
            e.printStackTrace();
            System.out.println("=== NOTIFICATION ERROR END ===");
            return new ResponseEntity<>(List.of(), HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Get unread notification count for current user
     * GET /notification/unread/count
     */
    @GetMapping(value = "/unread/count", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> getUnreadCount(@AuthenticationPrincipal User user) {
        try {
            int unreadCount = notificationService.getUnreadCount(user);
            return new ResponseEntity<>(new UnreadCountResponse(unreadCount), HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to fetch unread count: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Create a test notification (for testing purposes)
     * POST /notification/test
     */
    @PostMapping(value = "/test", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createTestNotification(@AuthenticationPrincipal User user) {
        try {
            System.out.println("Creating test notification for user: " + user.getEmail());
            // Create a test notification for the current user
            notificationService.createNotification(user,
                    Room.ConferenceRoomMgtsys.enums.NotificationType.ROOM_AVAILABLE,
                    "Test Room Available",
                    "Test room 'Conference Room A' is now available for booking",
                    null,
                    "test-room-id",
                    "/rooms/test-room-id");
            System.out.println("Test notification created successfully");
            return new ResponseEntity<>("Test notification created", HttpStatus.OK);
        } catch (Exception e) {
            System.out.println("Failed to create test notification: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>("Failed to create test notification: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Create a test notification for all users (for testing purposes)
     * POST /notification/test-all
     */
    @PostMapping(value = "/test-all", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> createTestNotificationForAll(@AuthenticationPrincipal User user) {
        try {
            System.out.println("Creating test notification for all users by: " + user.getEmail());
            // Create a test room
            Room.ConferenceRoomMgtsys.model.Room testRoom = new Room.ConferenceRoomMgtsys.model.Room();
            testRoom.setName("Test Conference Room");
            testRoom.setId(java.util.UUID.randomUUID());

            // Create notification for all users
            notificationService.createRoomAvailableNotification(testRoom, user);
            System.out.println("Test notification for all users created successfully");
            return new ResponseEntity<>("Test notification for all users created", HttpStatus.OK);
        } catch (Exception e) {
            System.out.println("Failed to create test notification for all users: " + e.getMessage());
            e.printStackTrace();
            return new ResponseEntity<>("Failed to create test notification for all users: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Simple test endpoint to check if API is working
     * GET /notification/ping
     */
    @GetMapping(value = "/ping", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> ping() {
        System.out.println("=== PING TEST ===");
        System.out.println("Notification API is working!");
        System.out.println("=== PING END ===");
        return new ResponseEntity<>("Notification API is working!", HttpStatus.OK);
    }

    /**
     * Mark notification as read
     * PUT /notification/{notificationId}/mark-read
     */
    @PutMapping(value = "/{notificationId}/mark-read", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> markAsRead(@PathVariable UUID notificationId,
            @AuthenticationPrincipal User user) {
        try {
            System.out.println("Marking notification " + notificationId + " as read for user: " + user.getEmail());
            notificationService.markAsRead(notificationId);
            return new ResponseEntity<>("Notification marked as read", HttpStatus.OK);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.NOT_FOUND);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to mark notification as read: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Mark all notifications as read for the current user
     * PUT /notification/mark-all-read
     */
    @PutMapping(value = "/mark-all-read", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> markAllAsRead(@AuthenticationPrincipal User user) {
        try {
            System.out.println("Marking all notifications as read for user: " + user.getEmail());
            notificationService.markAllNotificationsAsRead(user);
            return new ResponseEntity<>("All notifications marked as read", HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to mark all notifications as read: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Clean up old read notifications (admin only)
     * POST /notification/cleanup
     */
    @PostMapping(value = "/cleanup", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<?> cleanupOldNotifications(@AuthenticationPrincipal User user) {
        try {
            // Only allow admins to cleanup
            if (user.getRole() != Room.ConferenceRoomMgtsys.enums.UserRole.ADMIN &&
                    user.getRole() != Room.ConferenceRoomMgtsys.enums.UserRole.SYSTEM_ADMIN) {
                return new ResponseEntity<>("Unauthorized", HttpStatus.FORBIDDEN);
            }

            System.out.println("Cleaning up old read notifications by admin: " + user.getEmail());
            notificationService.cleanupOldReadNotifications();
            return new ResponseEntity<>("Old read notifications cleaned up", HttpStatus.OK);
        } catch (Exception e) {
            return new ResponseEntity<>("Failed to cleanup notifications: " + e.getMessage(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    /**
     * Inner class for unread count response
     */
    public static class UnreadCountResponse {
        private int unreadCount;

        public UnreadCountResponse(int unreadCount) {
            this.unreadCount = unreadCount;
        }

        public int getUnreadCount() {
            return unreadCount;
        }

        public void setUnreadCount(int unreadCount) {
            this.unreadCount = unreadCount;
        }
    }
}