package Room.ConferenceRoomMgtsys.dto.room;

import Room.ConferenceRoomMgtsys.dto.base.BaseResponseDto;
import java.util.List;
import java.util.UUID;

public class RoomAvailabilityDto extends BaseResponseDto {
    private String name;
    private String description;
    private UUID organizationId;
    private String organizationName;
    private Integer capacity;
    private String location;
    private String floor;
    private boolean isActive;
    private String amenities;
    private String equipment;
    private String images;
    private boolean isAvailable;
    private List<TimeSlotDto> timeSlots;
    private List<BookingDetailDto> todaysBookings;

    public RoomAvailabilityDto() {}

    // Getters and Setters
    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public UUID getOrganizationId() {
        return organizationId;
    }

    public void setOrganizationId(UUID organizationId) {
        this.organizationId = organizationId;
    }

    public String getOrganizationName() {
        return organizationName;
    }

    public void setOrganizationName(String organizationName) {
        this.organizationName = organizationName;
    }

    public Integer getCapacity() {
        return capacity;
    }

    public void setCapacity(Integer capacity) {
        this.capacity = capacity;
    }

    public String getLocation() {
        return location;
    }

    public void setLocation(String location) {
        this.location = location;
    }

    public String getFloor() {
        return floor;
    }

    public void setFloor(String floor) {
        this.floor = floor;
    }

    public boolean isActive() {
        return isActive;
    }

    public void setActive(boolean active) {
        isActive = active;
    }

    public String getAmenities() {
        return amenities;
    }

    public void setAmenities(String amenities) {
        this.amenities = amenities;
    }

    public String getEquipment() {
        return equipment;
    }

    public void setEquipment(String equipment) {
        this.equipment = equipment;
    }

    public String getImages() {
        return images;
    }

    public void setImages(String images) {
        this.images = images;
    }

    public boolean isAvailable() {
        return isAvailable;
    }

    public void setAvailable(boolean available) {
        isAvailable = available;
    }

    public List<TimeSlotDto> getTimeSlots() {
        return timeSlots;
    }

    public void setTimeSlots(List<TimeSlotDto> timeSlots) {
        this.timeSlots = timeSlots;
    }

    public List<BookingDetailDto> getTodaysBookings() {
        return todaysBookings;
    }

    public void setTodaysBookings(List<BookingDetailDto> todaysBookings) {
        this.todaysBookings = todaysBookings;
    }

    // Inner DTOs
    public static class TimeSlotDto {
        private String startTime;
        private String endTime;
        private boolean isAvailable;
        private String status; // "AVAILABLE", "BOOKED", "PENDING"

        public TimeSlotDto() {}

        public String getStartTime() {
            return startTime;
        }

        public void setStartTime(String startTime) {
            this.startTime = startTime;
        }

        public String getEndTime() {
            return endTime;
        }

        public void setEndTime(String endTime) {
            this.endTime = endTime;
        }

        public boolean isAvailable() {
            return isAvailable;
        }

        public void setAvailable(boolean available) {
            isAvailable = available;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }
    }

    public static class BookingDetailDto {
        private String userName;
        private String userEmail;
        private String userProfilePicture; // Add profile picture field
        private String startTime;
        private String endTime;
        private String purpose;
        private String status;
        private Integer attendeeCount;

        public BookingDetailDto() {}

        public String getUserName() {
            return userName;
        }

        public void setUserName(String userName) {
            this.userName = userName;
        }

        public String getUserEmail() {
            return userEmail;
        }

        public void setUserEmail(String userEmail) {
            this.userEmail = userEmail;
        }

        public String getStartTime() {
            return startTime;
        }

        public void setStartTime(String startTime) {
            this.startTime = startTime;
        }

        public String getEndTime() {
            return endTime;
        }

        public void setEndTime(String endTime) {
            this.endTime = endTime;
        }

        public String getPurpose() {
            return purpose;
        }

        public void setPurpose(String purpose) {
            this.purpose = purpose;
        }

        public String getStatus() {
            return status;
        }

        public void setStatus(String status) {
            this.status = status;
        }

        public Integer getAttendeeCount() {
            return attendeeCount;
        }

        public void setAttendeeCount(Integer attendeeCount) {
            this.attendeeCount = attendeeCount;
        }

        public String getUserProfilePicture() {
            return userProfilePicture;
        }

        public void setUserProfilePicture(String userProfilePicture) {
            this.userProfilePicture = userProfilePicture;
        }
    }
}
