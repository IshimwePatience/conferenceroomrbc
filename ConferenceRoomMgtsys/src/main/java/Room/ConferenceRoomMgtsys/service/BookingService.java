package Room.ConferenceRoomMgtsys.service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.ResponseStatus;

import Room.ConferenceRoomMgtsys.dto.booking.BookingCreateDto;
import Room.ConferenceRoomMgtsys.dto.booking.BookingResponseDto;
import Room.ConferenceRoomMgtsys.dto.booking.BookingSearchDto;
import Room.ConferenceRoomMgtsys.enums.BookingStatus;
import Room.ConferenceRoomMgtsys.enums.UserRole;
import Room.ConferenceRoomMgtsys.model.Booking;
import Room.ConferenceRoomMgtsys.model.Organization;
import Room.ConferenceRoomMgtsys.model.Room;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.repository.BookingRepository;
import Room.ConferenceRoomMgtsys.repository.RoomRepository;
import Room.ConferenceRoomMgtsys.repository.UserRepository;

@Service
public class BookingService {

    private static final Logger logger = LoggerFactory.getLogger(BookingService.class);

    private final BookingRepository bookingRepository;
    private final RoomRepository roomRepository;
    private final UserRepository userRepository;
    private final EmailService emailService;

    public BookingService(BookingRepository bookingRepository,
            RoomRepository roomRepository,
            UserRepository userRepository,
            EmailService emailService) {
        this.bookingRepository = bookingRepository;
        this.roomRepository = roomRepository;
        this.userRepository = userRepository;
        this.emailService = emailService;
    }

    @Transactional
    public BookingResponseDto createBooking(BookingCreateDto createDto, User user) {
        // Prevent booking in the past
        LocalDateTime now = LocalDateTime.now();
        if (createDto.getStartTime() == null || createDto.getEndTime() == null) {
            throw new IllegalArgumentException("Start time and end time are required.");
        }
        if (createDto.getStartTime().isBefore(now) || createDto.getEndTime().isBefore(now)) {
            throw new IllegalArgumentException("Cannot book a room for a past date or time.");
        }
        if (createDto.getEndTime().isBefore(createDto.getStartTime())) {
            throw new IllegalArgumentException("End time must be after start time.");
        }
        // Enforce min/max duration only
        long minutes = java.time.Duration.between(createDto.getStartTime(), createDto.getEndTime()).toMinutes();
        if (minutes < 30) {
            throw new IllegalArgumentException("Minimum booking duration is 30 minutes.");
        }
        if (minutes > 8 * 60) {
            throw new IllegalArgumentException("Maximum booking duration is 8 hours.");
        }
        
        // Prevent booking too close to current time (less than 5 minutes)
        if (createDto.getStartTime().isBefore(now.plusMinutes(5))) {
            throw new IllegalArgumentException("Cannot book a room less than 5 minutes from now. Please choose a later time.");
        }

        // Advance booking window: up to 4 weeks
        if (createDto.getStartTime().isAfter(now.plusWeeks(4))) {
            throw new IllegalArgumentException("Bookings can only be made up to 4 weeks in advance.");
        }

        // Validate room exists
        Room room = roomRepository.findById(createDto.getRoomId())
                .orElseThrow(() -> new IllegalArgumentException("Room not found"));

        // Enforce weekdays only and business hours (07:00 - 17:00)
        java.time.DayOfWeek startDay = createDto.getStartTime().getDayOfWeek();
        java.time.DayOfWeek endDay = createDto.getEndTime().getDayOfWeek();
        if (startDay == java.time.DayOfWeek.SATURDAY || startDay == java.time.DayOfWeek.SUNDAY
                || endDay == java.time.DayOfWeek.SATURDAY || endDay == java.time.DayOfWeek.SUNDAY) {
            throw new IllegalArgumentException("Bookings are allowed only on weekdays (Mon-Fri).");
        }
        java.time.LocalTime businessStart = java.time.LocalTime.of(7, 0);
        java.time.LocalTime businessEnd = java.time.LocalTime.of(17, 0);
        if (createDto.getStartTime().toLocalTime().isBefore(businessStart)
                || createDto.getEndTime().toLocalTime().isAfter(businessEnd)) {
            throw new IllegalArgumentException("Bookings must be within business hours (07:00-17:00).");
        }

        // Check for overlapping conflicts with more robust validation
        List<Booking> conflicts = bookingRepository.findConflictingBookings(
                room,
                createDto.getStartTime(),
                createDto.getEndTime());

        if (!conflicts.isEmpty()) {
            // Check for user's own overlapping bookings first
            List<Booking> userConflicts = conflicts.stream()
                    .filter(conflict -> conflict.getUser().getId().equals(user.getId()))
                    .toList();
            
            if (!userConflicts.isEmpty()) {
                throw new IllegalArgumentException("You have already booked this room for an overlapping time period.");
            }
            
            // Check for other users' conflicts
            Booking conflictingBooking = conflicts.get(0);
            throw new ConflictingBookingException(
                    conflictingBooking.getStartTime().toString(),
                    conflictingBooking.getEndTime().toString(),
                    conflictingBooking.getUser().getFirstName() + " " + conflictingBooking.getUser().getLastName(),
                    conflictingBooking.getUser().getEmail(),
                    conflictingBooking.getRoom().getOrganization().getName());
        }
        
        // Check for exact duplicate bookings (same user, room, time, purpose)
        List<Booking> exactDuplicates = bookingRepository.findExactDuplicateBookings(
                user, room, createDto.getStartTime(), createDto.getEndTime(), createDto.getPurpose());
        
        if (!exactDuplicates.isEmpty()) {
            throw new IllegalArgumentException("You have already created an identical booking for this room, time, and purpose. Please check your existing bookings.");
        }
        
        // Check for recent duplicate attempts (within last 5 minutes) to prevent rapid clicking
        LocalDateTime fiveMinutesAgo = LocalDateTime.now().minusMinutes(5);
        List<Booking> recentAttempts = bookingRepository.findRecentDuplicateAttempts(user, room, fiveMinutesAgo);
        
        if (!recentAttempts.isEmpty()) {
            throw new IllegalArgumentException("You have recently attempted to book this room. Please wait a few minutes before trying again or check your existing bookings.");
        }
        
        // Additional validation: Check for any active bookings by the same user in the same time range
        List<Booking> userActiveBookings = bookingRepository.findByUser(user);
        
        for (Booking existingBooking : userActiveBookings) {
            // Only check active bookings (PENDING or APPROVED) that are not cancelled
            if (existingBooking.getIsActive() && 
                (existingBooking.getStatus() == BookingStatus.PENDING || existingBooking.getStatus() == BookingStatus.APPROVED) &&
                existingBooking.getRoom().getId().equals(room.getId()) && 
                isTimeOverlapping(
                    createDto.getStartTime(), 
                    createDto.getEndTime(),
                    existingBooking.getStartTime(), 
                    existingBooking.getEndTime()
                )) {
                throw new IllegalArgumentException("You already have an active booking for this room that overlaps with the requested time.");
            }
        }

        // Create booking with PENDING status (approval needed)
        Booking booking = new Booking();
        booking.setUser(user);
        booking.setRoom(room);
        booking.setStartTime(createDto.getStartTime());
        booking.setEndTime(createDto.getEndTime());
        booking.setPurpose(createDto.getPurpose());
        booking.setNotes(createDto.getNotes());
        booking.setAttendeeCount(createDto.getAttendeeCount());
        booking.setStatus(BookingStatus.PENDING); // Bookings require approval
        booking.setIsActive(true); // Explicitly set isActive to true for new bookings

        // Save and return booking DTO
        Booking savedBooking = bookingRepository.save(booking);
        logger.info("Booking created and saved: ID={}, Purpose={}, StartTime={}, EndTime={}, Status={}, IsActive={}",
                savedBooking.getId(), savedBooking.getPurpose(), savedBooking.getStartTime(), savedBooking.getEndTime(),
                savedBooking.getStatus(), savedBooking.getIsActive());

        // Email notifications
        // 1. Notify user
        emailService.sendSimpleEmail(user.getEmail(), "Booking Request Sent",
                "Your booking request has been sent and is pending approval.");
        // 2. Notify org admins
        List<User> orgAdmins = userRepository.findByOrganizationAndRole(room.getOrganization(), UserRole.ADMIN);
        for (User admin : orgAdmins) {
            emailService.sendSimpleEmail(admin.getEmail(), "Booking Pending Approval",
                    "A new booking is pending your approval for room: " + room.getName());
        }
        // 3. Notify system admins
        List<User> sysAdmins = userRepository
                .findByRole(UserRole.SYSTEM_ADMIN, org.springframework.data.domain.Pageable.unpaged()).getContent();
        for (User sysAdmin : sysAdmins) {
            emailService.sendSimpleEmail(sysAdmin.getEmail(), "Booking Pending Approval",
                    "A new booking is pending approval for room: " + room.getName());
        }

        return convertToDto(savedBooking);
    }

    /**
     * Create recurring bookings based on fields in BookingCreateDto
     * Supported patterns: WEEKLY, DAILY, CUSTOM (comma-separated days, e.g., TUESDAY,THURSDAY)
     */
    @Transactional
    public List<BookingResponseDto> createRecurringBookings(BookingCreateDto createDto, User user) {
        if (!createDto.isRecurring()) {
            return java.util.List.of(createBooking(createDto, user));
        }
        if (createDto.getRecurrenceEndDate() == null) {
            throw new IllegalArgumentException("recurrenceEndDate is required for recurring bookings.");
        }

        java.time.LocalDateTime cursor = createDto.getStartTime();
        java.time.LocalDateTime endCursor = createDto.getRecurrenceEndDate();
        String pattern = createDto.getRecurrencePattern() == null ? "WEEKLY" : createDto.getRecurrencePattern().trim().toUpperCase();

        java.util.Set<java.time.DayOfWeek> customDays = new java.util.HashSet<>();
        if (pattern.startsWith("CUSTOM")) {
            // Expect format: CUSTOM:TUESDAY,THURSDAY
            int idx = pattern.indexOf(':');
            if (idx > 0 && idx + 1 < pattern.length()) {
                String days = pattern.substring(idx + 1);
                for (String d : days.split(",")) {
                    try {
                        customDays.add(java.time.DayOfWeek.valueOf(d.trim()));
                    } catch (Exception ignored) {}
                }
            }
            if (customDays.isEmpty()) {
                throw new IllegalArgumentException("CUSTOM recurrence requires at least one weekday.");
            }
        }

        java.util.List<BookingResponseDto> results = new java.util.ArrayList<>();
        while (!cursor.isAfter(endCursor)) {
            boolean include = false;
            switch (pattern) {
                case "DAILY" -> include = cursor.getDayOfWeek().getValue() <= 5; // Mon-Fri
                case "WEEKLY" -> include = true;
                default -> {
                    if (pattern.startsWith("CUSTOM")) {
                        include = customDays.contains(cursor.getDayOfWeek());
                    } else {
                        include = true;
                    }
                }
            }
            if (include) {
                BookingCreateDto single = new BookingCreateDto();
                single.setRoomId(createDto.getRoomId());
                single.setStartTime(cursor);
                single.setEndTime(cursor.plusMinutes(java.time.Duration.between(createDto.getStartTime(), createDto.getEndTime()).toMinutes()));
                single.setPurpose(createDto.getPurpose());
                single.setNotes(createDto.getNotes());
                single.setAttendeeCount(createDto.getAttendeeCount());
                try {
                    results.add(createBooking(single, user));
                } catch (RuntimeException ex) {
                    // Skip conflicted instances, continue others
                }
            }
            // Advance cursor
            if ("DAILY".equals(pattern) || pattern.startsWith("CUSTOM")) {
                cursor = cursor.plusDays(1);
            } else { // WEEKLY default
                cursor = cursor.plusWeeks(1);
            }
        }
        return results;
    }

    @Transactional
    public void adminCancelBooking(UUID bookingId, User currentUser) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        // Admin can cancel any booking in their organization or any if system admin
        if (currentUser.getRole() != UserRole.SYSTEM_ADMIN
                && (booking.getRoom() == null
                    || booking.getRoom().getOrganization() == null
                    || !booking.getRoom().getOrganization().equals(currentUser.getOrganization()))) {
            throw new IllegalArgumentException("You can only cancel bookings from your organization");
        }

        if (booking.getStatus() == BookingStatus.CANCELLED || booking.getStatus() == BookingStatus.COMPLETED) {
            return; // idempotent
        }
        booking.setStatus(BookingStatus.CANCELLED);
        bookingRepository.save(booking);

        try {
            emailService.sendSimpleEmail(
                booking.getUser().getEmail(),
                "Booking Cancelled by Admin",
                "Your booking for room: " + booking.getRoom().getName() + " was cancelled by an administrator.");
        } catch (Exception e) {
            logger.warn("Failed to send admin-cancel email: {}", e.getMessage());
        }
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getOrganizationBookingsForDay(User currentUser, java.time.LocalDate date) {
        if (currentUser.getRole() != UserRole.SYSTEM_ADMIN && currentUser.getOrganization() == null) {
            throw new IllegalArgumentException("Admin is not associated with an organization.");
        }
        Organization org = currentUser.getRole() == UserRole.SYSTEM_ADMIN ? null : currentUser.getOrganization();
        java.time.LocalDateTime dayStart = date.atTime(7, 0);
        java.time.LocalDateTime dayEnd = date.atTime(17, 0);

        List<Booking> bookings;
        if (currentUser.getRole() == UserRole.SYSTEM_ADMIN) {
            // For system admin, return all orgs' bookings in that window
            bookings = bookingRepository.findAll().stream()
                .filter(b -> b.getStartTime().isBefore(dayEnd) && b.getEndTime().isAfter(dayStart)
                    && b.getStatus() != BookingStatus.CANCELLED && b.getStatus() != BookingStatus.REJECTED)
                .toList();
        } else {
            bookings = bookingRepository.findBookingsByOrganizationOnDay(org, dayStart, dayEnd);
        }
        return bookings.stream().map(this::convertToDto).toList();
    }

    @Transactional
    public BookingResponseDto cancelBooking(UUID bookingId, User user) {
        // Find booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        // Validate user owns the booking
        if (!booking.getUser().equals(user)) {
            throw new IllegalArgumentException("You can only cancel your own bookings");
        }

        // Check if booking is not already cancelled or completed
        if (booking.getStatus() == BookingStatus.CANCELLED ||
                booking.getStatus() == BookingStatus.COMPLETED) {
            throw new IllegalArgumentException("This booking cannot be cancelled");
        }

        // Only allow cancellation of pending bookings
        if (booking.getStatus() != BookingStatus.PENDING) {
            throw new IllegalArgumentException("Only pending bookings can be cancelled");
        }

        // Set status to CANCELLED
        booking.setStatus(BookingStatus.CANCELLED);

        // Save booking
        Booking savedBooking = bookingRepository.save(booking);

        // Send cancellation email notification to user
        try {
            emailService.sendBookingCancellation(savedBooking);
        } catch (Exception e) {
            logger.error("Failed to send booking cancellation email", e);
        }

        // Notify admins about the cancellation
        try {
            // Notify organization admin
            if (savedBooking.getRoom().getOrganization() != null) {
                List<User> orgAdmins = userRepository.findByOrganizationAndRole(savedBooking.getRoom().getOrganization(), UserRole.ADMIN);
                for (User admin : orgAdmins) {
                    emailService.sendSimpleEmail(admin.getEmail(), "Booking Cancelled",
                            "A booking has been cancelled for room: " + savedBooking.getRoom().getName() + 
                            " by user: " + savedBooking.getUser().getEmail());
                }
            }

            // Notify system admins
            Page<User> sysAdminsPage = userRepository.findByRole(UserRole.SYSTEM_ADMIN, PageRequest.of(0, 100));
            for (User sysAdmin : sysAdminsPage.getContent()) {
                emailService.sendSimpleEmail(sysAdmin.getEmail(), "Booking Cancelled",
                        "A booking has been cancelled for room: " + savedBooking.getRoom().getName() + 
                        " by user: " + savedBooking.getUser().getEmail());
            }
        } catch (Exception e) {
            logger.error("Failed to send admin cancellation notification", e);
        }

        return convertToDto(savedBooking);
    }

    @Transactional
    public BookingResponseDto updateBooking(UUID bookingId, BookingCreateDto updateDto, User user) {
        // Find booking
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        // Validate user owns the booking
        if (!booking.getUser().equals(user)) {
            throw new IllegalArgumentException("You can only update your own bookings");
        }

        // Check if booking is not already cancelled or completed
        if (booking.getStatus() == BookingStatus.CANCELLED ||
                booking.getStatus() == BookingStatus.COMPLETED) {
            throw new IllegalArgumentException("This booking cannot be updated");
        }

        // Update booking details
        booking.setPurpose(updateDto.getPurpose());
        booking.setNotes(updateDto.getNotes());
        booking.setAttendeeCount(updateDto.getAttendeeCount());

        // Save booking
        Booking savedBooking = bookingRepository.save(booking);

        return convertToDto(savedBooking);
    }

    @Transactional(readOnly = true)
    public Page<BookingResponseDto> searchBookings(BookingSearchDto searchDto, Pageable pageable) {
        // Get bookings based on search criteria
        Page<Booking> bookings = bookingRepository.searchByPurposeOrNotes(searchDto.getSearchTerm(), pageable);

        // Convert to DTOs
        return bookings.map(this::convertToDto);
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getUpcomingBookingsByUser(User user, LocalDateTime currentTime) {
        List<Booking> bookings = bookingRepository.findUpcomingBookingsByUser(user, currentTime);
        return bookings.stream()
                .filter(booking -> booking.getIsActive()) // Only return active bookings
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getUpcomingBookingsByRoom(Room room, LocalDateTime currentTime) {
        List<Booking> bookings = bookingRepository.findUpcomingBookingsByRoom(room, currentTime);
        return bookings.stream()
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getTodaysBookingsByRoom(Room room, LocalDateTime date) {
        List<Booking> bookings = bookingRepository.findTodaysBookingsByRoom(room, date);
        return bookings.stream()
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getPendingBookingsByOrganization(Organization organization) {
        List<Booking> bookings = bookingRepository.findPendingBookingsByOrganization(organization);
        return bookings.stream()
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getAllUpcomingBookings(LocalDateTime currentTime) {
        List<Booking> bookings = bookingRepository.findUpcomingBookingsGlobal(currentTime);
        return bookings.stream()
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getBookingHistoryByUser(User user) {
        List<Booking> bookings = bookingRepository.findByUser(user);
        return bookings.stream()
                .filter(booking -> !booking.getIsActive() || booking.getStatus() == BookingStatus.COMPLETED)
                .map(this::convertToDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getOngoingBookingsGlobal(LocalDateTime currentTime) {
        List<Booking> bookings = bookingRepository.findOngoingApprovedBookings(currentTime);
        return bookings.stream()
                .map(this::convertToDto)
                .toList();
    }

    private String calculateDuration(LocalDateTime startTime, LocalDateTime endTime) {
        long durationMinutes = java.time.temporal.ChronoUnit.MINUTES.between(startTime, endTime);
        return String.format("%dh %dm", durationMinutes / 60, durationMinutes % 60);
    }
    
    /**
     * Check if two time ranges overlap
     * Two time ranges overlap if: start1 < end2 AND start2 < end1
     */
    private boolean isTimeOverlapping(LocalDateTime start1, LocalDateTime end1, LocalDateTime start2, LocalDateTime end2) {
        return start1.isBefore(end2) && start2.isBefore(end1);
    }

    private BookingResponseDto convertToDto(Booking booking) {
        BookingResponseDto dto = new BookingResponseDto();
        dto.setId(booking.getId()); // BaseResponseDto expects UUID

        logger.info("Converting booking to DTO: ID={}, Purpose={}, StartTime={}, EndTime={}, Status={}, IsActive={}",
                booking.getId(), booking.getPurpose(), booking.getStartTime(), booking.getEndTime(),
                booking.getStatus(), booking.getIsActive());

        // Set user details
        dto.setUserName(booking.getUser().getFirstName() + " " + booking.getUser().getLastName());
        dto.setUserEmail(booking.getUser().getEmail());

        // Set room details
        dto.setRoomId(booking.getRoom().getId());
        dto.setRoomName(booking.getRoom().getName());
        dto.setRoomImages(booking.getRoom().getImages()); // Add room images
        dto.setOrganizationName(booking.getRoom().getOrganization().getName());

        // Set organization IDs for frontend approval logic
        if (booking.getUser() != null && booking.getUser().getOrganization() != null) {
            dto.setOrganizationId(booking.getUser().getOrganization().getId());
        }
        if (booking.getRoom() != null && booking.getRoom().getOrganization() != null) {
            dto.setRoomOrganizationId(booking.getRoom().getOrganization().getId());
        }

        // Set booking details
        dto.setBookingDate(booking.getStartTime().toLocalDate().toString());
        dto.setStartTime(booking.getStartTime().toString());
        dto.setEndTime(booking.getEndTime().toString());
        dto.setDuration(calculateDuration(booking.getStartTime(), booking.getEndTime()));
        dto.setStatus(booking.getStatus().toString());
        dto.setPurpose(booking.getPurpose());
        dto.setNotes(booking.getNotes());
        dto.setAttendeeCount(booking.getAttendeeCount());
        dto.setIsActive(booking.getIsActive());

        // Set approval details if available
        if (booking.getApprovedBy() != null) {
            dto.setApprovedByName(booking.getApprovedBy().getFirstName() + " " + booking.getApprovedBy().getLastName());
            dto.setApprovedTime(booking.getApprovedAt().toString());
        }

        // Set rejection reason if available
        if (booking.getRejectionReason() != null) {
            dto.setRejectionReason(booking.getRejectionReason());
        }

        // Set recurring info
        dto.setRecurringInfo(booking.getIsRecurring() ? "Recurring" : "One-time meeting");

        return dto;
    }

    @Transactional(readOnly = true)
    public List<BookingResponseDto> getAllBookingsForUserRole(User currentUser) {
        List<Booking> bookings;
        if (currentUser.getRole() == UserRole.SYSTEM_ADMIN) {
            bookings = bookingRepository.findAll(); // Get all bookings for system admin
        } else if (currentUser.getRole() == UserRole.ADMIN) {
            if (currentUser.getOrganization() == null) {
                throw new RuntimeException("Admin is not associated with an organization.");
            }
            // Fetch all bookings for rooms owned by the admin's organization
            bookings = bookingRepository.findByRoom_Organization(currentUser.getOrganization());
        } else {
            bookings = bookingRepository.findByUser(currentUser); // Get only user's own bookings
        }
        // Deduplicate by booking ID
        return bookings.stream()
                .collect(java.util.stream.Collectors.toMap(Booking::getId, b -> b, (b1, b2) -> b1))
                .values().stream()
                .map(this::convertToDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void approveBooking(UUID bookingId, User currentUser) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (currentUser.getRole() != UserRole.SYSTEM_ADMIN &&
                !booking.getRoom().getOrganization().equals(currentUser.getOrganization())) {
            throw new IllegalArgumentException("You can only approve bookings in your own organization");
        }

        booking.setStatus(BookingStatus.APPROVED);
        bookingRepository.save(booking);
        // Notify user
        emailService.sendSimpleEmail(booking.getUser().getEmail(), "Booking Approved",
                "Your booking for room: " + booking.getRoom().getName() + " has been approved.");
    }

    @Transactional
    public void rejectBooking(UUID bookingId, User currentUser) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking not found"));

        if (currentUser.getRole() != UserRole.SYSTEM_ADMIN &&
                !booking.getRoom().getOrganization().equals(currentUser.getOrganization())) {
            throw new IllegalArgumentException("You can only reject bookings in your own organization");
        }

        booking.setStatus(BookingStatus.REJECTED);
        bookingRepository.save(booking);
        // Notify user
        emailService.sendSimpleEmail(booking.getUser().getEmail(), "Booking Rejected",
                "Your booking for room: " + booking.getRoom().getName() + " has been rejected.");
    }

    /**
     * Automatically reject all pending bookings whose start time has passed.
     * Runs every 10 seconds for better responsiveness.
     */
    @Scheduled(fixedRate = 10000) // every 10 seconds
    public void autoRejectExpiredPendingBookings() {
        LocalDateTime now = LocalDateTime.now();
        List<Booking> expiredPending = bookingRepository.findByStatusAndStartTimeBefore(BookingStatus.PENDING, now);
        for (Booking booking : expiredPending) {
            booking.setStatus(BookingStatus.REJECTED);
            bookingRepository.save(booking);
            // Optionally, notify the user
            emailService.sendSimpleEmail(
                    booking.getUser().getEmail(),
                    "Booking Automatically Rejected",
                    "Your booking for room: " + booking.getRoom().getName()
                            + " was automatically rejected because it was not approved before the meeting start time.");
        }
    }
    
    /**
     * Automatically reject pending bookings that are very close to starting (within 2 minutes).
     * This provides faster rejection for urgent cases.
     */
    @Scheduled(fixedRate = 5000) // every 5 seconds
    public void autoRejectImminentPendingBookings() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime imminentThreshold = now.plusMinutes(2);
        List<Booking> imminentPending = bookingRepository.findByStatusAndStartTimeBefore(BookingStatus.PENDING, imminentThreshold);
        for (Booking booking : imminentPending) {
            if (booking.getStartTime().isBefore(now.plusMinutes(2))) {
                booking.setStatus(BookingStatus.REJECTED);
                bookingRepository.save(booking);
                // Notify the user immediately
                emailService.sendSimpleEmail(
                        booking.getUser().getEmail(),
                        "Booking Automatically Rejected - Too Close to Start Time",
                        "Your booking for room: " + booking.getRoom().getName()
                                + " was automatically rejected because it was not approved and is too close to the start time.");
            }
        }
    }
    
    /**
     * Clean up duplicate pending bookings for the same room and time.
     * Runs every 30 seconds to prevent booking spam.
     */
    @Scheduled(fixedRate = 30000) // every 30 seconds
    public void cleanupDuplicatePendingBookings() {
        try {
            // Find and reject duplicate pending bookings for the same room and time
            List<Booking> allPending = bookingRepository.findByStatus(BookingStatus.PENDING);
            Map<String, List<Booking>> duplicatesByKey = new HashMap<>();
            
            for (Booking booking : allPending) {
                String key = booking.getRoom().getId() + "_" + booking.getStartTime() + "_" + booking.getEndTime() + "_" + booking.getPurpose();
                duplicatesByKey.computeIfAbsent(key, k -> new ArrayList<>()).add(booking);
            }
            
            int cleanedCount = 0;
            for (List<Booking> duplicates : duplicatesByKey.values()) {
                if (duplicates.size() > 1) {
                    // Keep the first one, reject the rest
                    for (int i = 1; i < duplicates.size(); i++) {
                        Booking duplicate = duplicates.get(i);
                        duplicate.setStatus(BookingStatus.REJECTED);
                        duplicate.setRejectionReason("Duplicate booking - automatically cleaned up");
                        bookingRepository.save(duplicate);
                        cleanedCount++;
                        
                        // Notify user about duplicate cleanup
                        emailService.sendSimpleEmail(duplicate.getUser().getEmail(), 
                            "Duplicate Booking Removed", 
                            "Your duplicate booking for room " + duplicate.getRoom().getName() + 
                            " has been automatically removed to prevent conflicts.");
                    }
                }
            }
            
            if (cleanedCount > 0) {
                logger.info("Cleaned up {} duplicate pending bookings", cleanedCount);
            }
        } catch (Exception e) {
            logger.error("Error during duplicate booking cleanup", e);
        }
    }
}

// Custom exception for booking conflicts
@ResponseStatus(HttpStatus.CONFLICT)
class ConflictingBookingException extends RuntimeException {
    public final String startTime;
    public final String endTime;
    public final String userName;
    public final String userEmail;
    public final String organizationName;

    public ConflictingBookingException(String startTime, String endTime, String userName, String userEmail,
            String organizationName) {
        super("Room is already booked from " + startTime + " to " + endTime);
        this.startTime = startTime;
        this.endTime = endTime;
        this.userName = userName;
        this.userEmail = userEmail;
        this.organizationName = organizationName;
    }
}
