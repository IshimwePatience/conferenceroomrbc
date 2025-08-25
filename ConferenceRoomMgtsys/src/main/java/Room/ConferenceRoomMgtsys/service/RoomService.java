package Room.ConferenceRoomMgtsys.service;

import Room.ConferenceRoomMgtsys.dto.room.RoomCreateDto;
import Room.ConferenceRoomMgtsys.dto.room.RoomAccessUpdateDto;
import Room.ConferenceRoomMgtsys.dto.room.RoomResponseDto;
import Room.ConferenceRoomMgtsys.dto.room.RoomSearchDto;
import Room.ConferenceRoomMgtsys.dto.room.RoomAvailabilityDto;
import Room.ConferenceRoomMgtsys.model.Room;
import Room.ConferenceRoomMgtsys.model.Organization;
import Room.ConferenceRoomMgtsys.repository.RoomRepository;
import Room.ConferenceRoomMgtsys.repository.OrganizationRepository;
import Room.ConferenceRoomMgtsys.repository.BookingRepository;
import Room.ConferenceRoomMgtsys.repository.AvailabilityRepository;
import Room.ConferenceRoomMgtsys.repository.RoomCommunicationRepository;
import Room.ConferenceRoomMgtsys.repository.DayVisibilityRepository;
import Room.ConferenceRoomMgtsys.enums.RoomAccessLevel;
import Room.ConferenceRoomMgtsys.enums.UserRole;
import Room.ConferenceRoomMgtsys.model.User;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.ArrayList;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import jakarta.annotation.PostConstruct;
import Room.ConferenceRoomMgtsys.model.Availability;
import Room.ConferenceRoomMgtsys.model.RoomCommunication;
import Room.ConferenceRoomMgtsys.model.Booking;
import Room.ConferenceRoomMgtsys.dto.room.RoomStatusBulkUpdateDto;

@Service
public class RoomService {

    private static final Logger logger = LoggerFactory.getLogger(RoomService.class);

    private final RoomRepository roomRepository;
    private final OrganizationRepository organizationRepository;
    private final BookingRepository bookingRepository;
    private final AvailabilityRepository availabilityRepository;
    private final RoomCommunicationRepository roomCommunicationRepository;
    private final ObjectMapper objectMapper;
    private final DayVisibilityRepository dayVisibilityRepository;

    @Value("${file.upload-dir}")
    private String baseUploadDir;

    private Path roomsDir;

    public RoomService(RoomRepository roomRepository,
            OrganizationRepository organizationRepository,
            BookingRepository bookingRepository,
            AvailabilityRepository availabilityRepository,
            RoomCommunicationRepository roomCommunicationRepository,
            ObjectMapper objectMapper,
            DayVisibilityRepository dayVisibilityRepository) {
        this.roomRepository = roomRepository;
        this.organizationRepository = organizationRepository;
        this.bookingRepository = bookingRepository;
        this.availabilityRepository = availabilityRepository;
        this.roomCommunicationRepository = roomCommunicationRepository;
        this.objectMapper = objectMapper;
        this.dayVisibilityRepository = dayVisibilityRepository;
    }

    @PostConstruct
    public void init() {
        this.roomsDir = Paths.get(baseUploadDir).resolve("rooms");
        try {
            Files.createDirectories(roomsDir);
        } catch (IOException e) {
            throw new RuntimeException("Could not create directory for room images", e);
        }
    }

    @Transactional
    public RoomResponseDto createRoom(RoomCreateDto createDto, Organization organization, List<MultipartFile> images) {
        // Validate organization
        if (organization == null) {
            throw new IllegalArgumentException("Organization is required");
        }

        // Check if room name already exists in organization
        if (roomRepository.findByOrganizationAndName(organization, createDto.getName()).isPresent()) {
            throw new IllegalArgumentException("Room with this name already exists in organization");
        }

        // Create room with PUBLIC access level
        Room room = new Room();
        room.setName(createDto.getName());
        room.setDescription(createDto.getDescription());
        room.setOrganization(organization);
        room.setCapacity(createDto.getCapacity());
        room.setLocation(createDto.getLocation());
        room.setFloor(createDto.getFloor());
        room.setAmenities(createDto.getAmenities());
        room.setEquipment(createDto.getEquipment());
        room.setAccessLevel(RoomAccessLevel.PUBLIC); // Set to PUBLIC for any user access
        room.setAllowedOrganizations(null); // No need for allowed organizations since it's PUBLIC

        // Handle image uploads
        if (images != null && !images.isEmpty()) {
            List<String> imageUrls = new ArrayList<>();
            for (MultipartFile image : images) {
                if (!image.isEmpty()) {
                    try {
                        // Create organization-specific directory within the rooms directory
                        Path orgDir = this.roomsDir.resolve(organization.getId().toString());
                        if (!Files.exists(orgDir)) {
                            Files.createDirectories(orgDir);
                        }

                        // Generate unique filename
                        String filename = UUID.randomUUID().toString() + "_" + image.getOriginalFilename();
                        Path filePath = orgDir.resolve(filename);

                        // Save the file
                        Files.copy(image.getInputStream(), filePath);

                        // Add the relative URL to the list
                        imageUrls.add("uploads/rooms/" + organization.getId() + "/" + filename);
                    } catch (IOException e) {
                        logger.error("Failed to upload image: {}", e.getMessage(), e);
                        throw new RuntimeException("Failed to upload image: " + e.getMessage());
                    }
                }
            }
            try {
                room.setImages(objectMapper.writeValueAsString(imageUrls));
            } catch (IOException e) {
                logger.error("Failed to serialize image URLs: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to serialize image URLs: " + e.getMessage());
            }
        }

        Room savedRoom = roomRepository.save(room);
        return convertToDto(savedRoom);
    }

    @Transactional
    public RoomResponseDto updateRoomAccess(RoomAccessUpdateDto updateDto, Organization organization) {
        // Find room by ID
        Room room = roomRepository.findById(updateDto.getRoomId())
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        // Update access level
        room.setAccessLevel(updateDto.getAccessLevel());

        // Update allowed organizations if ORG_ONLY
        if (updateDto.getAccessLevel() == RoomAccessLevel.ORG_ONLY) {
            Set<String> allowedOrgIds = updateDto.getAllowedOrganizationIds();
            if (allowedOrgIds != null && !allowedOrgIds.isEmpty()) {
                Set<Organization> organizations = new HashSet<>();
                for (String orgId : allowedOrgIds) {
                    Organization org = organizationRepository.findById(UUID.fromString(orgId))
                            .orElseThrow(() -> new IllegalArgumentException("Organization not found: " + orgId));
                    organizations.add(org);
                }
                room.setAllowedOrganizations(organizations);
            } else {
                room.setAllowedOrganizations(null);
            }
        } else {
            room.setAllowedOrganizations(null);
        }

        Room savedRoom = roomRepository.save(room);
        return convertToDto(savedRoom);
    }

    @Transactional(readOnly = true)
    public Page<RoomResponseDto> searchRooms(RoomSearchDto searchDto, Pageable pageable) {
        Page<Room> rooms = roomRepository.searchByNameDescriptionOrLocation(searchDto.getSearchTerm(), pageable);
        return rooms.map(this::convertToDto);
    }

    @Transactional(readOnly = true)
    public Page<RoomResponseDto> searchRoomsByOrganization(RoomSearchDto searchDto, Organization organization,
            Pageable pageable) {
        Page<Room> rooms = roomRepository.searchByOrganizationAndNameDescriptionOrLocation(organization,
                searchDto.getSearchTerm(), pageable);
        return rooms.map(this::convertToDto);
    }

    @Transactional(readOnly = true)
    public List<RoomResponseDto> getAvailableRooms(Organization organization,
            LocalDateTime startTime,
            LocalDateTime endTime) {
        // Close-of-day rule: after 17:00 local server time, do not show rooms for today
        try {
            java.time.LocalDate today = java.time.LocalDate.now();
            java.time.LocalTime nowTime = java.time.LocalTime.now();
            if (startTime != null && startTime.toLocalDate().isEqual(today)
                && nowTime.isAfter(java.time.LocalTime.of(17, 0))) {
                return java.util.List.of();
            }
        } catch (Exception ignored) { }

        List<Room> rooms = roomRepository.findAvailableRooms(organization, startTime, endTime);
        // Apply day-visibility whitelist for that date.
        try {
            java.time.LocalDate date = startTime.toLocalDate();
            List<Room> filtered = new java.util.ArrayList<>(rooms);
            List<Room> allowedRooms = null;
            if (organization != null) {
                var vis = dayVisibilityRepository.findVisibleByOrganizationAndDate(organization, date);
                // Default deny when there are no visibility entries
                if (vis == null || vis.isEmpty()) {
                    return java.util.List.of();
                }
                java.util.Set<java.util.UUID> allowedIds = vis.stream().map(v -> v.getRoom().getId()).collect(java.util.stream.Collectors.toSet());
                allowedRooms = rooms.stream().filter(r -> allowedIds.contains(r.getId())).toList();
            }
            if (allowedRooms != null) {
                filtered = new java.util.ArrayList<>(allowedRooms);
            }
            return filtered.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // Fallback if anything goes wrong
            return rooms.stream()
                    .map(this::convertToDto)
                    .collect(Collectors.toList());
        }
    }

    // METHOD FOR BOOKING CONTROLLER - Returns Room entity
    @Transactional(readOnly = true)
    public Room getRoomById(UUID roomId) {
        return roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));
    }

    // NEW METHOD FOR ROOM CONTROLLER - Returns DTO
    @Transactional(readOnly = true)
    public RoomResponseDto getRoomDtoById(UUID roomId) {
        Room room = getRoomById(roomId);
        return convertToDto(room);
    }

    @Transactional(readOnly = true)
    public List<RoomResponseDto> getAllRoomsForUserRole(User currentUser) {
        List<Room> rooms;
        if (currentUser.getRole() == UserRole.SYSTEM_ADMIN) {
            logger.info("Fetching all rooms for SYSTEM_ADMIN.");
            rooms = roomRepository.findAll();
        } else if (currentUser.getRole() == UserRole.ADMIN) {
            if (currentUser.getOrganization() == null) {
                logger.warn("Admin user not associated with an organization when trying to fetch rooms.");
                throw new RuntimeException("Admin is not associated with an organization.");
            }
            logger.info("Fetching rooms for ADMIN's organization ID: {}", currentUser.getOrganization().getId());
            rooms = roomRepository.findAllByOrganization(currentUser.getOrganization());
        } else { // Regular USER role
            logger.info("Fetching all rooms for regular USER across all organizations.");
            rooms = roomRepository.findAll(); // Allow regular users to see all rooms
        }

        logger.info("Found {} rooms.", rooms.size());
        return rooms.stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public List<RoomAvailabilityDto> getRoomsWithAvailabilityDetails(User currentUser, LocalDateTime date) {
        List<Room> rooms;
        if (currentUser.getRole() == UserRole.SYSTEM_ADMIN) {
            rooms = roomRepository.findAll();
        } else if (currentUser.getRole() == UserRole.ADMIN) {
            if (currentUser.getOrganization() == null) {
                throw new RuntimeException("Admin is not associated with an organization.");
            }
            rooms = roomRepository.findAllByOrganization(currentUser.getOrganization());
        } else {
            rooms = roomRepository.findAll(); // Allow regular users to see all rooms
        }

        // Apply day-visibility whitelist for that date (same logic as getAvailableRooms)
        try {
            java.time.LocalDate selectedDate = date.toLocalDate();
            List<Room> filtered = new java.util.ArrayList<>(rooms);
            
            // For regular users, apply organization-based visibility filtering
            if (currentUser.getRole() == UserRole.USER) {
                // If user has no organization assigned → default deny
                if (currentUser.getOrganization() == null) {
                    return java.util.List.of();
                }

                var vis = dayVisibilityRepository
                        .findVisibleByOrganizationAndDate(currentUser.getOrganization(), selectedDate);

                // If there are no visibility entries for this org/date → default deny
                if (vis == null || vis.isEmpty()) {
                    return java.util.List.of();
                }

                java.util.Set<java.util.UUID> allowedIds = vis.stream()
                        .map(v -> v.getRoom().getId())
                        .collect(java.util.stream.Collectors.toSet());
                List<Room> allowedRooms = rooms.stream()
                        .filter(r -> allowedIds.contains(r.getId()))
                        .toList();
                filtered = new java.util.ArrayList<>(allowedRooms);
            }
            
            return filtered.stream()
                    .map(room -> convertToAvailabilityDto(room, date))
                    .collect(Collectors.toList());
        } catch (Exception e) {
            // Fallback if anything goes wrong
            return rooms.stream()
                    .map(room -> convertToAvailabilityDto(room, date))
                    .collect(Collectors.toList());
        }
    }

    private RoomAvailabilityDto convertToAvailabilityDto(Room room, LocalDateTime date) {
        RoomAvailabilityDto dto = new RoomAvailabilityDto();
        dto.setId(room.getId());
        dto.setName(room.getName());
        dto.setDescription(room.getDescription());
        dto.setOrganizationId(room.getOrganization().getId());
        dto.setOrganizationName(room.getOrganization().getName());
        dto.setCapacity(room.getCapacity());
        dto.setLocation(room.getLocation());
        dto.setFloor(room.getFloor());
        dto.setActive(room.getIsActive());
        dto.setAmenities(room.getAmenities());
        dto.setEquipment(room.getEquipment());
        dto.setImages(room.getImages());

        // Generate time slots for the day (7 AM to 5 PM)
        List<RoomAvailabilityDto.TimeSlotDto> timeSlots = generateTimeSlots(room, date);
        dto.setTimeSlots(timeSlots);

        // Get today's bookings for this room
        List<RoomAvailabilityDto.BookingDetailDto> todaysBookings = getTodaysBookings(room, date);
        dto.setTodaysBookings(todaysBookings);

        // Check if room has any available time slots
        boolean hasAvailableSlots = timeSlots.stream().anyMatch(RoomAvailabilityDto.TimeSlotDto::isAvailable);
        dto.setAvailable(hasAvailableSlots);

        return dto;
    }

    private List<RoomAvailabilityDto.TimeSlotDto> generateTimeSlots(Room room, LocalDateTime date) {
        List<RoomAvailabilityDto.TimeSlotDto> timeSlots = new ArrayList<>();
        
        // Generate 1-hour slots from 7 AM to 5 PM
        for (int hour = 7; hour < 17; hour++) {
            LocalDateTime slotStart = date.toLocalDate().atTime(hour, 0);
            LocalDateTime slotEnd = date.toLocalDate().atTime(hour + 1, 0);
            
            RoomAvailabilityDto.TimeSlotDto timeSlot = new RoomAvailabilityDto.TimeSlotDto();
            timeSlot.setStartTime(slotStart.toString());
            timeSlot.setEndTime(slotEnd.toString());
            
            // Check if this time slot is available
            boolean isAvailable = isTimeSlotAvailable(room, slotStart, slotEnd);
            timeSlot.setAvailable(isAvailable);
            timeSlot.setStatus(isAvailable ? "AVAILABLE" : "BOOKED");
            
            timeSlots.add(timeSlot);
        }
        
        return timeSlots;
    }

    private boolean isTimeSlotAvailable(Room room, LocalDateTime startTime, LocalDateTime endTime) {
        // Check if there are any approved bookings that overlap with this time slot
        List<Booking> overlappingBookings = bookingRepository.findOverlappingBookings(
            room, startTime, endTime);
        
        return overlappingBookings.isEmpty();
    }

    private List<RoomAvailabilityDto.BookingDetailDto> getTodaysBookings(Room room, LocalDateTime date) {
        LocalDateTime dayStart = date.toLocalDate().atTime(0, 0);
        LocalDateTime dayEnd = date.toLocalDate().atTime(23, 59, 59);
        
        List<Booking> todaysBookings = bookingRepository.findByRoomAndStartTimeBetween(room, dayStart, dayEnd);
        
        return todaysBookings.stream()
                .map(this::convertBookingToDetailDto)
                .collect(Collectors.toList());
    }

    private RoomAvailabilityDto.BookingDetailDto convertBookingToDetailDto(Booking booking) {
        RoomAvailabilityDto.BookingDetailDto dto = new RoomAvailabilityDto.BookingDetailDto();
        dto.setUserName(booking.getUser().getFirstName() + " " + booking.getUser().getLastName());
        dto.setUserEmail(booking.getUser().getEmail());
        dto.setUserProfilePicture(booking.getUser().getProfilePictureUrl()); // Add profile picture
        dto.setStartTime(booking.getStartTime().toString());
        dto.setEndTime(booking.getEndTime().toString());
        dto.setPurpose(booking.getPurpose());
        dto.setStatus(booking.getStatus().toString());
        dto.setAttendeeCount(booking.getAttendeeCount());
        return dto;
    }

    @Transactional
    public void deleteRoom(UUID roomId) {
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        // Delete all communications associated with the room
        List<RoomCommunication> communications = roomCommunicationRepository.findByBooking_Room(room);
        if (communications != null && !communications.isEmpty()) {
            roomCommunicationRepository.deleteAll(communications);
        }

        // Delete all bookings associated with the room
        List<Booking> bookings = bookingRepository.findByRoom(room);
        if (bookings != null && !bookings.isEmpty()) {
            bookingRepository.deleteAll(bookings);
        }

        // Delete all availability associated with the room
        List<Availability> availabilities = availabilityRepository.findByRoom(room);
        if (availabilities != null && !availabilities.isEmpty()) {
            availabilityRepository.deleteAll(availabilities);
        }

        roomRepository.delete(room);
    }

    @Transactional
    public void bulkUpdateRoomStatus(RoomStatusBulkUpdateDto dto, User currentUser) {
        if (dto == null || dto.getRoomIds() == null || dto.getRoomIds().isEmpty()) {
            throw new IllegalArgumentException("No room IDs provided");
        }
        boolean activate = dto.getIsActive() != null && dto.getIsActive();
        for (UUID roomId : dto.getRoomIds()) {
            Room room = roomRepository.findById(roomId)
                    .orElseThrow(() -> new IllegalArgumentException("Room not found: " + roomId));
            if (currentUser.getRole() != UserRole.SYSTEM_ADMIN &&
                (room.getOrganization() == null || !room.getOrganization().equals(currentUser.getOrganization()))) {
                throw new IllegalArgumentException("Cannot modify rooms outside your organization");
            }
            room.setIsActive(activate);
            roomRepository.save(room);
        }
    }

    @Transactional
    public RoomResponseDto updateRoom(UUID roomId, RoomCreateDto updateDto, Organization organization,
            List<MultipartFile> newImages) {
        if (organization == null) {
            logger.error("Organization is null in updateRoom for roomId: {}", roomId);
            throw new IllegalArgumentException("Organization must not be null when updating a room.");
        }
        Room room = roomRepository.findById(roomId)
                .orElseThrow(() -> new IllegalArgumentException("Room not found with ID: " + roomId));

        // Basic fields update
        room.setName(updateDto.getName());
        room.setDescription(updateDto.getDescription());
        room.setCapacity(updateDto.getCapacity());
        room.setLocation(updateDto.getLocation());
        room.setFloor(updateDto.getFloor());
        room.setAmenities(updateDto.getAmenities());
        room.setEquipment(updateDto.getEquipment());

        // Handle images update
        if (newImages != null && !newImages.isEmpty()) {
            // Delete old images first
            if (room.getImages() != null && !room.getImages().isEmpty()) {
                try {
                    List<String> oldImageUrls = objectMapper.readValue(room.getImages(),
                            new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
                            });
                    for (String imageUrl : oldImageUrls) {
                        if (imageUrl != null && imageUrl.startsWith("uploads/")) {
                            try {
                                // Construct the full path correctly
                                Path imagePath = Paths.get(baseUploadDir).resolve(imageUrl.substring(8)); // Remove
                                                                                                          // "uploads/"
                                                                                                          // prefix
                                if (Files.exists(imagePath)) {
                                    try {
                                        Files.delete(imagePath);
                                        logger.info("Deleted old image file: {}", imagePath);
                                    } catch (Exception e) {
                                        logger.warn("Failed to delete old image file {}: {}", imagePath,
                                                e.getMessage());
                                    }
                                } else {
                                    logger.warn("Old image file not found for deletion: {}", imagePath);
                                }
                            } catch (Exception e) {
                                logger.warn("Exception while handling old image file {}: {}", imageUrl, e.getMessage());
                            }
                        }
                    }
                } catch (IOException e) {
                    logger.error("Failed to parse old images for room {}: {}", roomId, e.getMessage());
                }
            }

            // Upload new images
            List<String> newImageUrls = new ArrayList<>();
            for (MultipartFile image : newImages) {
                if (!image.isEmpty()) {
                    try {
                        Path orgDir = this.roomsDir.resolve(organization.getId().toString());
                        if (!Files.exists(orgDir)) {
                            Files.createDirectories(orgDir);
                        }
                        String filename = UUID.randomUUID().toString() + "_" + image.getOriginalFilename();
                        Path filePath = orgDir.resolve(filename);
                        Files.copy(image.getInputStream(), filePath);
                        newImageUrls.add("uploads/rooms/" + organization.getId() + "/" + filename);
                    } catch (IOException e) {
                        logger.error("Failed to upload new image: {}", e.getMessage(), e);
                        throw new RuntimeException("Failed to upload new image: " + e.getMessage());
                    }
                }
            }
            try {
                room.setImages(objectMapper.writeValueAsString(newImageUrls));
            } catch (IOException e) {
                logger.error("Failed to serialize new image URLs: {}", e.getMessage(), e);
                throw new RuntimeException("Failed to serialize new image URLs: " + e.getMessage());
            }
        } else if (newImages != null && newImages.isEmpty()) {
            // If newImages is provided but empty, it means no images are to be associated
            // So delete all existing images
            if (room.getImages() != null && !room.getImages().isEmpty()) {
                try {
                    List<String> oldImageUrls = objectMapper.readValue(room.getImages(),
                            new com.fasterxml.jackson.core.type.TypeReference<List<String>>() {
                            });
                    for (String imageUrl : oldImageUrls) {
                        if (imageUrl != null && imageUrl.startsWith("uploads/")) {
                            try {
                                Path imagePath = Paths.get(baseUploadDir).resolve(imageUrl.substring(8));
                                if (Files.exists(imagePath)) {
                                    try {
                                        Files.delete(imagePath);
                                        logger.info("Deleted old image file (no new images provided): {}", imagePath);
                                    } catch (Exception e) {
                                        logger.warn("Failed to delete old image file {}: {}", imagePath,
                                                e.getMessage());
                                    }
                                }
                            } catch (Exception e) {
                                logger.warn("Exception while handling old image file {}: {}", imageUrl, e.getMessage());
                            }
                        }
                    }
                } catch (IOException e) {
                    logger.error("Failed to parse old images when no new images provided for room {}: {}", roomId,
                            e.getMessage());
                }
            }
            room.setImages("[]"); // Set to empty JSON array
        }

        Room updatedRoom = roomRepository.save(room);
        return convertToDto(updatedRoom);
    }

    private RoomResponseDto convertToDto(Room room) {
        RoomResponseDto dto = new RoomResponseDto();
        dto.setId(room.getId());
        dto.setName(room.getName());
        dto.setDescription(room.getDescription());
        dto.setOrganizationId(room.getOrganization().getId());
        dto.setOrganizationName(room.getOrganization().getName());
        dto.setCapacity(room.getCapacity());
        dto.setLocation(room.getLocation());
        dto.setFloor(room.getFloor());
        dto.setAccessLevel(room.getAccessLevel());

        // Set additional fields for RoomResponseDto
        dto.setActive(room.getIsActive() != null ? room.getIsActive() : true);
        dto.setAvailable(dto.isActive()); // Set based on active status
        dto.setTotalBookingsToday(0); // Default to 0, implement actual count if needed

        // Set optional fields if they exist in your Room entity
        // Note: These might be null if your Room entity doesn't have these fields yet
        try {
            if (room.getAmenities() != null) {
                dto.setAmenities(room.getAmenities());
            }
        } catch (Exception e) {
            // Field doesn't exist in Room entity yet
            dto.setAmenities("");
        }

        try {
            if (room.getEquipment() != null) {
                dto.setEquipment(room.getEquipment());
            }
        } catch (Exception e) {
            dto.setEquipment("");
        }

        // Correctly set images as a JSON string
        try {
            if (room.getImages() != null && !room.getImages().isEmpty()) {
                // If images are stored as a comma-separated string, convert it to JSON array
                // string
                // This handles legacy data or incorrect previous storage
                if (!room.getImages().startsWith("[")) {
                    List<String> imageUrls = List.of(room.getImages().split(","));
                    dto.setImages(objectMapper.writeValueAsString(imageUrls));
                } else {
                    dto.setImages(room.getImages()); // Already a JSON array string
                }
            } else {
                dto.setImages("[]"); // Default to empty JSON array if no images
            }
        } catch (Exception e) {
            logger.error("Error parsing images from room entity: {}", e.getMessage(), e);
            dto.setImages("[]"); // Default to empty JSON array on error
        }

        dto.setCreatedAt(room.getCreatedAt());
        dto.setUpdatedAt(room.getUpdatedAt());
        return dto;
    }
}