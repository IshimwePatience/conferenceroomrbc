package Room.ConferenceRoomMgtsys.dto.notification;

import java.time.LocalDate;
import java.time.LocalDateTime;

public class FrontendNotificationDto {
    private String id;
    private String roomName;
    private String adminName;
    private String adminRole;
    private String organizationName;
    private LocalDateTime createdAt;
    private String type;
    // Optional fields for UI enhancements
    private LocalDate visibleDate; // when a room is made visible for a particular date

    public FrontendNotificationDto() {
    }

    public FrontendNotificationDto(String id, String roomName, String adminName, String adminRole,
            String organizationName, LocalDateTime createdAt, String type) {
        this.id = id;
        this.roomName = roomName;
        this.adminName = adminName;
        this.adminRole = adminRole;
        this.organizationName = organizationName;
        this.createdAt = createdAt;
        this.type = type;
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getRoomName() {
        return roomName;
    }

    public void setRoomName(String roomName) {
        this.roomName = roomName;
    }

    public String getAdminName() {
        return adminName;
    }

    public void setAdminName(String adminName) {
        this.adminName = adminName;
    }

    public String getAdminRole() {
        return adminRole;
    }

    public void setAdminRole(String adminRole) {
        this.adminRole = adminRole;
    }

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public LocalDate getVisibleDate() {
        return visibleDate;
    }

    public void setVisibleDate(LocalDate visibleDate) {
        this.visibleDate = visibleDate;
    }
}