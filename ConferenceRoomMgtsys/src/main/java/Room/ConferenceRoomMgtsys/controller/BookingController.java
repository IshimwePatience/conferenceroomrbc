package Room.ConferenceRoomMgtsys.controller;

import Room.ConferenceRoomMgtsys.dto.booking.BookingCreateDto;
import Room.ConferenceRoomMgtsys.dto.booking.BookingResponseDto;
import Room.ConferenceRoomMgtsys.model.User;
import Room.ConferenceRoomMgtsys.service.BookingService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/booking")
@CrossOrigin(origins = { "http://localhost:5173",  "http://10.8.150.139:8090","https://conferenceroomsystem.vercel.app", "http://197.243.104.5"  })
public class BookingController {

    @Autowired
    private BookingService bookingService;

    @PostMapping("/create")
    public ResponseEntity<?> createBooking(@RequestBody BookingCreateDto createDto,
            @AuthenticationPrincipal User currentUser) {
        try {
            BookingResponseDto newBooking = bookingService.createBooking(createDto, currentUser);
            return new ResponseEntity<>(newBooking, HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    /**
     * Create recurring or multi-day bookings in one request
     * POST /booking/create/recurring
     */
    @PostMapping("/create/recurring")
    public ResponseEntity<?> createRecurring(@RequestBody BookingCreateDto createDto,
                                             @AuthenticationPrincipal User currentUser) {
        try {
            return new ResponseEntity<>(bookingService.createRecurringBookings(createDto, currentUser), HttpStatus.CREATED);
        } catch (RuntimeException e) {
            return new ResponseEntity<>(e.getMessage(), HttpStatus.BAD_REQUEST);
        }
    }

    @GetMapping
    public ResponseEntity<?> getUserBookings(@AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(bookingService.getAllBookingsForUserRole(currentUser));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/upcoming")
    public ResponseEntity<?> getUpcomingBookingsForUser(@AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(bookingService.getUpcomingBookingsByUser(currentUser, LocalDateTime.now()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/all/upcoming")
    public ResponseEntity<?> getAllUpcomingBookings() {
        try {
            return ResponseEntity.ok(bookingService.getAllUpcomingBookings(LocalDateTime.now()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/organization/pending")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> getPendingBookingsForOrganization(@AuthenticationPrincipal User currentUser) {
        try {
            if (currentUser.getRole() == Room.ConferenceRoomMgtsys.enums.UserRole.ADMIN
                    && currentUser.getOrganization() == null) {
                return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                        .body("Admin user not associated with an organization.");
            }
            return ResponseEntity.ok(bookingService.getPendingBookingsByOrganization(currentUser.getOrganization()));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{bookingId}/approve")
    public ResponseEntity<?> approveBooking(@PathVariable UUID bookingId, @AuthenticationPrincipal User currentUser) {
        try {
            bookingService.approveBooking(bookingId, currentUser);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{bookingId}/reject")
    public ResponseEntity<?> rejectBooking(@PathVariable UUID bookingId, @AuthenticationPrincipal User currentUser) {
        try {
            bookingService.rejectBooking(bookingId, currentUser);
            return ResponseEntity.ok().build();
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/{bookingId}/cancel")
    public ResponseEntity<?> cancelBooking(@PathVariable UUID bookingId, @AuthenticationPrincipal User currentUser) {
        try {
            bookingService.cancelBooking(bookingId, currentUser);
            return ResponseEntity.ok().body("Booking cancelled successfully.");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/ongoing")
    public List<BookingResponseDto> getOngoingBookings() {
        return bookingService.getOngoingBookingsGlobal(LocalDateTime.now());
    }

    /**
     * Get all bookings for the current admin's organization for a specific day
     * GET /booking/organization/day?date=2024-01-01
     */
    @GetMapping("/organization/day")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> getOrganizationBookingsForDay(@RequestParam LocalDate date,
                                                           @AuthenticationPrincipal User currentUser) {
        try {
            return ResponseEntity.ok(bookingService.getOrganizationBookingsForDay(currentUser, date));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    /**
     * Admin override cancel: Admins can cancel any booking at any time
     * POST /booking/{bookingId}/admin-cancel
     */
    @PostMapping("/{bookingId}/admin-cancel")
    @PreAuthorize("hasRole('ADMIN') or hasRole('SYSTEM_ADMIN')")
    public ResponseEntity<?> adminCancel(@PathVariable UUID bookingId, @AuthenticationPrincipal User currentUser) {
        try {
            bookingService.adminCancelBooking(bookingId, currentUser);
            return ResponseEntity.ok().body("Booking cancelled by admin.");
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}