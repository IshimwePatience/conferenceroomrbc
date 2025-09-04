package Room.ConferenceRoomMgtsys.service;

import Room.ConferenceRoomMgtsys.dto.notification.NotificationResponseDto;
import Room.ConferenceRoomMgtsys.dto.notification.FrontendNotificationDto;
import Room.ConferenceRoomMgtsys.model.Notification;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.model.Room;
import Room.ConferenceRoomMgtsys.repository.NotificationRepository;
import Room.ConferenceRoomMgtsys.repository.RoomRepository;
import Room.ConferenceRoomMgtsys.repository.UserRepository;
import Room.ConferenceRoomMgtsys.enums.NotificationType;
import jakarta.transaction.Transactional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class NotificationService {
    private final NotificationRepository notificationRepository;
    private final WebSocketNotificationService webSocketNotificationService;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository,
            WebSocketNotificationService webSocketNotificationService, RoomRepository roomRepository,
            UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.webSocketNotificationService = webSocketNotificationService;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public Notification createNotification(User user, NotificationType type, String title, String message,
            String bookingId, String roomId, String actionUrl) {
        Notification notification = new Notification();
        notification.setUser(user);
        notification.setType(type);
        notification.setTitle(title);
        notification.setMessage(message);
        notification.setBookingId(bookingId);
        notification.setRoomId(roomId);
        notification.setActionUrl(actionUrl);

        Notification savedNotification = notificationRepository.save(notification);
        webSocketNotificationService.sendNotification(user, savedNotification);
        return savedNotification;
    }

    /**
     * Create a notification for when a room becomes available
     * This will be called when an admin makes a room available
     */
    @Transactional
    public void createRoomAvailableNotification(Room room, User adminUser) {
        // Get all active users across all organizations to notify them about the new
        // room
        List<User> allActiveUsers = userRepository.findByIsActive(true);

        System.out.println(
                "Creating notifications for room: " + room.getName() + " by admin: " + adminUser.getEmail());
        System.out.println("Found " + allActiveUsers.size() + " active users to notify");

        String title = "New Room Available";
        java.time.LocalDate todayKigali = java.time.LocalDate.now(java.time.ZoneId.of("Africa/Kigali"));
        String message = String.format(
                "Room '%s' is now available for booking on %s. Added by %s (%s) from %s",
                room.getName(),
                todayKigali.toString(),
                adminUser.getFirstName() + " " + adminUser.getLastName(),
                adminUser.getRole(),
                room.getOrganization() != null ? room.getOrganization().getName() : "Unknown Organization");
        String actionUrl = "/rooms/" + room.getId();

        // Create notifications for all active users (except the admin who made the room
        // available)
        int notificationCount = 0;
        for (User user : allActiveUsers) {
            if (!user.getId().equals(adminUser.getId())) {
                createNotification(user, NotificationType.ROOM_AVAILABLE, title, message, null, room.getId().toString(),
                        actionUrl);
                notificationCount++;
            }
        }
        System.out.println("Created " + notificationCount + " notifications for room: " + room.getName());
    }

    /**
     * Create a notification for when a room becomes visible for a specific date
     * This will be called when an admin makes a room visible for a particular date
     */
    @Transactional
    public void createRoomVisibilityNotification(Room room, User adminUser, java.time.LocalDate date) {
        // Get all active users across all organizations to notify them about the new
        // room visibility
        List<User> allActiveUsers = userRepository.findByIsActive(true);

        String title = "Room Now Visible";
        String message = String.format(
                "Room '%s' is now visible and available for booking on %s. Added by %s (%s) from %s",
                room.getName(),
                date.toString(),
                adminUser.getFirstName() + " " + adminUser.getLastName(),
                adminUser.getRole(),
                room.getOrganization() != null ? room.getOrganization().getName() : "Unknown Organization");
        String actionUrl = "/rooms/" + room.getId();

        // Create notifications for all active users (except the admin who made the room
        // visible)
        int notificationCount = 0;
        for (User user : allActiveUsers) {
            if (!user.getId().equals(adminUser.getId())) {
                createNotification(user, NotificationType.ROOM_AVAILABLE, title, message, null, room.getId().toString(),
                        actionUrl);
                notificationCount++;
            }
        }
        System.out.println("Created " + notificationCount + " visibility notifications for room: " + room.getName()
                + " for date: " + date);
    }

    /**
     * Get frontend notifications for the notification bell
     * Returns notifications in the format expected by the frontend
     * Notifications disappear after 24 hours ONLY if they've been read
     */
    public List<FrontendNotificationDto> getFrontendNotifications(User user) {
        // Get all notifications for the user (using a large page size to get all)
        Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 1000); // Get up to 1000 notifications
        Page<Notification> notificationPage = notificationRepository.findByUser(user, pageable);
        List<Notification> allNotifications = notificationPage.getContent();

        System.out.println("Found " + allNotifications.size() + " total notifications for user: " + user.getEmail());

        // For debugging, let's show all notifications first
        for (Notification n : allNotifications) {
            System.out.println("Notification: ID=" + n.getId() + ", Type=" + n.getType() + ", IsRead=" + n.getIsRead()
                    + ", CreatedAt=" + n.getCreatedAt());
        }

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Africa/Kigali"));
        LocalDateTime twentyFourHoursAgo = now.minusHours(24);

        // Filter notifications based on read status and time
        List<Notification> filteredNotifications = allNotifications.stream()
                .filter(n -> {
                    System.out.println("Checking notification: Type=" + n.getType() + ", IsRead=" + n.getIsRead());
                    return n.getType() == NotificationType.ROOM_AVAILABLE;
                })
                .filter(n -> {
                    // If notification is unread, show it regardless of time
                    if (!n.getIsRead()) {
                        System.out.println("Including unread notification: " + n.getId());
                        return true;
                    }
                    // If notification is read, only show if it was read within last 24 hours
                    if (n.getReadAt() != null && n.getReadAt().isAfter(twentyFourHoursAgo)) {
                        System.out.println("Including recently read notification: " + n.getId());
                        return true;
                    }
                    // Hide read notifications older than 24 hours
                    System.out.println("Excluding old read notification: " + n.getId());
                    return false;
                })
                .collect(Collectors.toList());

        System.out.println("Filtering for ROOM_AVAILABLE notifications...");
        System.out.println("Returning " + filteredNotifications.size() + " ROOM_AVAILABLE notifications");

        List<FrontendNotificationDto> result = filteredNotifications.stream()
                .map(this::convertToFrontendDto)
                .collect(Collectors.toList());

        System.out.println("Converted to " + result.size() + " FrontendNotificationDto objects");
        for (FrontendNotificationDto dto : result) {
            System.out.println("DTO: " + dto.getRoomName() + " by " + dto.getAdminName() + " (" + dto.getAdminRole()
                    + ") from " + dto.getOrganizationName());
        }

        return result;
    }

    @Transactional
    public Notification markAsRead(UUID notificationId) {
        Notification notification = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new RuntimeException("Notification not found"));
        notification.setIsRead(true);
        notification.setReadAt(LocalDateTime.now(ZoneId.of("Africa/Kigali")));

        Notification savedNotification = notificationRepository.save(notification);
        webSocketNotificationService.sendNotification(notification.getUser(), savedNotification);
        return savedNotification;
    }

    @Transactional
    public void markAllNotificationsAsRead(User user) {
        List<Notification> unreadNotifications = notificationRepository.findUnreadNotificationsByUser(user);

        System.out.println(
                "Marking " + unreadNotifications.size() + " notifications as read for user: " + user.getEmail());

        LocalDateTime now = LocalDateTime.now(ZoneId.of("Africa/Kigali"));
        for (Notification notification : unreadNotifications) {
            notification.setIsRead(true);
            notification.setReadAt(now);
            notificationRepository.save(notification);
        }

        System.out.println("Successfully marked all notifications as read for user: " + user.getEmail());
    }

    /**
     * Clean up old read notifications (older than 24 hours)
     * This can be called periodically or manually
     */
    @Transactional
    public void cleanupOldReadNotifications() {
        LocalDateTime cutoffTime = LocalDateTime.now(ZoneId.of("Africa/Kigali")).minusHours(24);
        Pageable pageable = org.springframework.data.domain.PageRequest.of(0, 1000);

        Page<Notification> oldReadNotifications = notificationRepository.findOldReadNotifications(cutoffTime, pageable);

        System.out.println("Found " + oldReadNotifications.getTotalElements() + " old read notifications to cleanup");

        for (Notification notification : oldReadNotifications.getContent()) {
            notificationRepository.delete(notification);
        }

        System.out.println(
                "Successfully cleaned up " + oldReadNotifications.getTotalElements() + " old read notifications");
    }

    public Page<NotificationResponseDto> getUserNotifications(User user, Pageable pageable) {
        return notificationRepository.findByUser(user, pageable)
                .map(this::convertToDto);
    }

    public List<NotificationResponseDto> getUnreadNotifications(User user) {
        return notificationRepository.findByUserAndIsRead(user, false)
                .stream()
                .map(this::convertToDto)
                .toList();
    }

    public int getUnreadCount(User user) {
        return notificationRepository.findUnreadNotificationsByUser(user).size();
    }

    private FrontendNotificationDto convertToFrontendDto(Notification notification) {
        // Get room details
        Room room = null;
        if (notification.getRoomId() != null) {
            try {
                room = roomRepository.findById(UUID.fromString(notification.getRoomId())).orElse(null);
            } catch (Exception e) {
                // Handle invalid UUID
            }
        }

        // Extract admin information from the notification message
        String adminName = "Admin";
        String adminRole = "ADMIN";
        String organizationName = "Unknown Organization";

        // Parse the message to extract admin information
        String message = notification.getMessage();
        if (message != null && message.contains("Added by")) {
            try {
                // Extract admin name and role from message
                // Format: "Room 'X' is now available for booking. Added by John Doe (ADMIN)
                // from Organization Name"
                int addedByIndex = message.indexOf("Added by");
                if (addedByIndex != -1) {
                    String afterAddedBy = message.substring(addedByIndex + 9); // "Added by " is 9 characters
                    int fromIndex = afterAddedBy.indexOf(" from ");
                    if (fromIndex != -1) {
                        String adminInfo = afterAddedBy.substring(0, fromIndex);
                        organizationName = afterAddedBy.substring(fromIndex + 6); // " from " is 6 characters

                        // Extract admin name and role from "John Doe (ADMIN)"
                        int roleStart = adminInfo.lastIndexOf(" (");
                        int roleEnd = adminInfo.lastIndexOf(")");
                        if (roleStart != -1 && roleEnd != -1) {
                            adminName = adminInfo.substring(0, roleStart);
                            adminRole = adminInfo.substring(roleStart + 2, roleEnd);
                        } else {
                            adminName = adminInfo;
                        }
                    }
                }
            } catch (Exception e) {
                System.out.println("Error parsing admin info from message: " + e.getMessage());
            }
        }

        // Fallback to room organization if parsing failed
        if (room != null && room.getOrganization() != null && organizationName.equals("Unknown Organization")) {
            organizationName = room.getOrganization().getName();
        }

        FrontendNotificationDto dto = new FrontendNotificationDto(
                notification.getId().toString(),
                room != null ? room.getName() : "Unknown Room",
                adminName,
                adminRole,
                organizationName,
                notification.getCreatedAt(),
                notification.getType().name());

        // Try to parse a visible date from the message when present
        try {
            String msg = notification.getMessage();
            if (msg != null && msg.contains("available for booking on")) {
                // Expecting: ... available for booking on YYYY-MM-DD
                int idx = msg.indexOf("available for booking on");
                String after = msg.substring(idx + "available for booking on".length()).trim();
                String dateStr = after.split("[ .]")[0];
                dto.setVisibleDate(java.time.LocalDate.parse(dateStr));
            }
            // Generic fallback: find the first YYYY-MM-DD in the message
            if (dto.getVisibleDate() == null && msg != null) {
                java.util.regex.Matcher m = java.util.regex.Pattern.compile("(\\d{4}-\\d{2}-\\d{2})").matcher(msg);
                if (m.find()) {
                    dto.setVisibleDate(java.time.LocalDate.parse(m.group(1)));
                }
            }
        } catch (Exception ignored) {}

        return dto;
    }

    private NotificationResponseDto convertToDto(Notification notification) {
        NotificationResponseDto dto = new NotificationResponseDto();
        dto.setId(notification.getId());
        dto.setType(notification.getType().name());
        dto.setTitle(notification.getTitle());
        dto.setMessage(notification.getMessage());
        dto.setIsRead(notification.getIsRead());
        dto.setReadTime(notification.getReadAt() != null ? notification.getReadAt().toString() : null);
        dto.setReadTime(notification.getReadAt() != null ? notification.getReadAt().toString() : null);
        dto.setRoomName(notification.getRoomId()); // You might want to fetch actual room name from Room entity
        dto.setBookingDetails(notification.getBookingId()); // You might want to fetch actual booking details
        dto.setActionText(notification.getActionUrl() != null ? "View Details" : null);
        return dto;
    }
}
