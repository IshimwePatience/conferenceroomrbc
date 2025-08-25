package Room.ConferenceRoomMgtsys.service;

import java.io.File;
import java.time.format.DateTimeFormatter;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

import Room.ConferenceRoomMgtsys.model.Booking;
import Room.ConferenceRoomMgtsys.model.EmailChangeRequest;
import Room.ConferenceRoomMgtsys.model.Room;
import Room.ConferenceRoomMgtsys.model.User;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    @Value("${spring.mail.username}")
    private String fromEmail;

    @Value("${app.name:Conference Room Management System}")
    private String appName;

    // Basic email sending
    public void sendSimpleEmail(String toEmail, String subject, String body) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(fromEmail);
        message.setTo(toEmail);
        message.setSubject(subject);
        message.setText(body);
        mailSender.send(message);
    }

    // HTML email sending
    public void sendHtmlEmail(String toEmail, String subject, String htmlBody) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true, "UTF-8");

        helper.setFrom(fromEmail);
        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(htmlBody, true);

        mailSender.send(message);
    }

    // Email with attachment
    public void sendEmailWithAttachment(String toEmail, String subject, String body, String attachmentPath)
            throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        MimeMessageHelper helper = new MimeMessageHelper(message, true);

        helper.setFrom(fromEmail);
        helper.setTo(toEmail);
        helper.setSubject(subject);
        helper.setText(body);

        FileSystemResource file = new FileSystemResource(new File(attachmentPath));
        helper.addAttachment(file.getFilename(), file);

        mailSender.send(message);
    }

    // Booking confirmation email
    public void sendBookingConfirmation(Booking booking) {
        try {
            String subject = "Booking Confirmation - " + booking.getRoom().getName();
            String htmlBody = buildBookingConfirmationEmail(booking);
            sendHtmlEmail(booking.getUser().getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send booking confirmation email: " + e.getMessage());
        }
    }

    // Booking cancellation email
    public void sendBookingCancellation(Booking booking) {
        try {
            String subject = "Booking Cancelled - " + booking.getRoom().getName();
            String htmlBody = buildBookingCancellationEmail(booking);
            sendHtmlEmail(booking.getUser().getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send booking cancellation email: " + e.getMessage());
        }
    }

    // Booking reminder email
    public void sendBookingReminder(Booking booking) {
        try {
            String subject = "Reminder: Your booking is starting soon - " + booking.getRoom().getName();
            String htmlBody = buildBookingReminderEmail(booking);
            sendHtmlEmail(booking.getUser().getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send booking reminder email: " + e.getMessage());
        }
    }

    // User approval notification
    public void sendUserApprovalNotification(User user, boolean approved) {
        try {
            String subject = approved ? "Account Approved" : "Account Rejected";
            String htmlBody = buildUserApprovalEmail(user, approved);
            sendHtmlEmail(user.getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send user approval email: " + e.getMessage());
        }
    }

    // Welcome email for new users
    public void sendWelcomeEmail(User user) {
        try {
            String subject = "Welcome to " + appName;
            String htmlBody = buildWelcomeEmail(user);
            sendHtmlEmail(user.getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send welcome email: " + e.getMessage());
        }
    }

    // Password reset email
    public void sendPasswordResetEmail(User user, String resetToken) {
        try {
            String subject = "Password Reset Code";
            String htmlBody = buildPasswordResetEmail(user, resetToken);
            sendHtmlEmail(user.getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send password reset email: " + e.getMessage());
        }
    }

    // Room announcement email
    public void sendRoomAnnouncement(User user, Room room, String announcement) {
        try {
            String subject = "Room Announcement - " + room.getName();
            String htmlBody = buildRoomAnnouncementEmail(user, room, announcement);
            sendHtmlEmail(user.getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send room announcement email: " + e.getMessage());
        }
    }

    // Email verification code for login
    public void sendVerificationCode(User user, String verificationCode) {
        try {
            String subject = "Your Verification Code - " + appName;
            String htmlBody = buildVerificationCodeEmail(user, verificationCode);
            sendHtmlEmail(user.getEmail(), subject, htmlBody);
        } catch (MessagingException e) {
            System.err.println("Failed to send verification code email: " + e.getMessage());
        }
    }

    // Generate 6-digit verification code
    public String generateVerificationCode() {
        return String.format("%06d", (int) (Math.random() * 1000000));
    }

    // Email change approval notification
    public void sendEmailChangeApprovalEmail(String email, String firstName) {
        try {
            String subject = "Email Change Approved";
            String htmlBody = buildEmailChangeApprovalEmail(firstName);
            sendHtmlEmail(email, subject, htmlBody);
        } catch (Exception e) {
            System.err.println("Failed to send email change approval email: " + e.getMessage());
        }
    }

    // Email change rejection notification
    public void sendEmailChangeRejectionEmail(String email, String firstName, String rejectionReason) {
        try {
            String subject = "Email Change Request Rejected";
            String htmlBody = buildEmailChangeRejectionEmail(firstName, rejectionReason);
            sendHtmlEmail(email, subject, htmlBody);
        } catch (Exception e) {
            System.err.println("Failed to send email change rejection email: " + e.getMessage());
        }
    }

    // OTP email for password change
    public void sendOtpEmail(String email, String firstName, String otpCode, String purpose) {
        try {
            String subject = "OTP for " + purpose;
            String htmlBody = buildOtpEmail(firstName, otpCode, purpose);
            sendHtmlEmail(email, subject, htmlBody);
        } catch (Exception e) {
            System.err.println("Failed to send OTP email: " + e.getMessage());
        }
    }

    // Password change confirmation
    public void sendPasswordChangeConfirmationEmail(String email, String firstName) {
        try {
            String subject = "Password Changed Successfully";
            String htmlBody = buildPasswordChangeConfirmationEmail(firstName);
            sendHtmlEmail(email, subject, htmlBody);
        } catch (Exception e) {
            System.err.println("Failed to send password change confirmation email: " + e.getMessage());
        }
    }

    // Email change request notification for admins
    public void sendEmailChangeRequestNotification(String adminEmail, User user, EmailChangeRequest request) {
        try {
            String subject = "Email Change Request - Action Required";
            String htmlBody = buildEmailChangeRequestNotificationEmail(adminEmail, user, request);
            sendHtmlEmail(adminEmail, subject, htmlBody);
        } catch (Exception e) {
            System.err.println("Failed to send email change request notification: " + e.getMessage());
        }
    }

    // Email change notification
    public void sendEmailChangeNotification(User user, String oldEmail, String newEmail, List<User> admins) {
        String subject = "Email Change Notification - Conference Room Management System";
        String body = "A user has changed their email address.\n\n" +
                "User Name: " + user.getFirstName() + " " + user.getLastName() + "\n" +
                "Old Email: " + oldEmail + "\n" +
                "New Email: " + newEmail + "\n\n" +
                "This change has been automatically applied. Please review if necessary.";

        // Notify all admins
        for (User admin : admins) {
            if (admin.getEmail() != null) {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(admin.getEmail());
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
            }
        }
    }

    // Email template builders
    private String buildBookingConfirmationEmail(Booking booking) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' HH:mm");

        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Booking Confirmed!</h2>
                        <p>Dear %s,</p>
                        <p>Your room booking has been confirmed. Here are the details:</p>

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #2c3e50;">Booking Details</h3>
                            <p><strong>Room:</strong> %s</p>
                            <p><strong>Date & Time:</strong> %s</p>
                            <p><strong>Duration:</strong> %s</p>
                            <p><strong>Purpose:</strong> %s</p>
                            <p><strong>Booking ID:</strong> %s</p>
                        </div>

                        <p>Please arrive on time and ensure the room is left clean for the next user.</p>
                        <p>If you need to cancel or modify this booking, please contact your administrator.</p>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                booking.getUser().getFirstName(),
                booking.getRoom().getName(),
                booking.getStartTime().format(formatter),
                calculateDuration(booking),
                booking.getPurpose() != null ? booking.getPurpose() : "Not specified",
                booking.getId(),
                appName);
    }

    private String buildBookingCancellationEmail(Booking booking) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' HH:mm");

        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #e74c3c;">Booking Cancelled</h2>
                        <p>Dear %s,</p>
                        <p>Your room booking has been cancelled. Here were the details:</p>

                        <div style="background: #f8f9fa; padding: 20px; border-radius: 5px; margin: 20px 0;">
                            <h3 style="margin-top: 0; color: #2c3e50;">Cancelled Booking</h3>
                            <p><strong>Room:</strong> %s</p>
                            <p><strong>Date & Time:</strong> %s</p>
                            <p><strong>Booking ID:</strong> %s</p>
                        </div>

                        <p>You can make a new booking anytime through the system.</p>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                booking.getUser().getFirstName(),
                booking.getRoom().getName(),
                booking.getStartTime().format(formatter),
                booking.getId(),
                appName);
    }

    private String buildBookingReminderEmail(Booking booking) {
        DateTimeFormatter formatter = DateTimeFormatter.ofPattern("MMM dd, yyyy 'at' HH:mm");

        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f39c12;">Booking Reminder</h2>
                        <p>Dear %s,</p>
                        <p>This is a reminder that your room booking is starting soon:</p>

                        <div style="background: #fff3cd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <h3 style="margin-top: 0; color: #2c3e50;">Upcoming Booking</h3>
                            <p><strong>Room:</strong> %s</p>
                            <p><strong>Date & Time:</strong> %s</p>
                            <p><strong>Location:</strong> %s</p>
                        </div>

                        <p>Please arrive on time. Thank you!</p>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                booking.getUser().getFirstName(),
                booking.getRoom().getName(),
                booking.getStartTime().format(formatter),
                booking.getRoom().getLocation() != null ? booking.getRoom().getLocation() : "Check room details",
                appName);
    }

    private String buildUserApprovalEmail(User user, boolean approved) {
        String status = approved ? "approved" : "rejected";
        String color = approved ? "#27ae60" : "#e74c3c";
        String message = approved ? "Your account has been approved! You can now log in and start using the system."
                : "Unfortunately, your account registration has been rejected. Please contact your administrator for more information.";

        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: %s;">Account %s</h2>
                        <p>Dear %s,</p>
                        <p>%s</p>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                color,
                status.substring(0, 1).toUpperCase() + status.substring(1),
                user.getFirstName(),
                message,
                appName);
    }

    private String buildWelcomeEmail(User user) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Account Registration Successful - Pending Approval</h2>
                        <p>Dear %s,</p>
                        <p>Thank you for registering with our Conference Room Management System!</p>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <h3 style="margin-top: 0; color: #2c3e50;">What happens next?</h3>
                            <ul style="margin: 10px 0; padding-left: 20px;">
                                <li>An administrator will review your registration within <strong>5 hours</strong></li>
                                <li>You will receive an email notification once your account is approved</li>
                                <li>Once approved, you can log in and start booking conference rooms</li>
                            </ul>
                        </div>

                        <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <p style="margin: 0; color: #721c24;"><strong>Important:</strong> If no administrator reviews your account within 5 hours, it will be automatically deleted and you'll need to register again.</p>
                        </div>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                user.getFirstName(),
                appName);
    }

    private String buildPasswordResetEmail(User user, String resetToken) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Password Reset Code</h2>
                        <p>Dear %s,</p>
                        <p>You have requested to reset your password. Please use the following code to reset your password:</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #3498db; padding: 20px; border-radius: 10px; display: inline-block;">
                                <h1 style="margin: 0; color: #2c3e50; font-size: 36px; letter-spacing: 8px; font-family: 'Courier New', monospace;">%s</h1>
                            </div>
                        </div>

                        <p style="text-align: center; color: #e74c3c; font-weight: bold;">This code expires in 10 minutes.</p>

                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <p style="margin: 0;"><strong>Security Note:</strong> If you didn't request this code, please ignore this email and consider changing your password.</p>
                        </div>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                user.getFirstName(),
                resetToken,
                appName);
    }

    private String buildRoomAnnouncementEmail(User user, Room room, String announcement) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Room Announcement</h2>
                        <p>Dear %s,</p>

                        <div style="background: #e8f4fd; padding: 20px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #3498db;">
                            <h3 style="margin-top: 0; color: #2c3e50;">%s</h3>
                            <p>%s</p>
                        </div>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                user.getFirstName(),
                room.getName(),
                announcement,
                appName);
    }

    private String buildVerificationCodeEmail(User user, String verificationCode) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">Login Verification Code</h2>
                        <p>Dear %s,</p>
                        <p>You are attempting to log in to your account. Please use the verification code below:</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #3498db; padding: 20px; border-radius: 10px; display: inline-block;">
                                <h1 style="margin: 0; color: #2c3e50; font-size: 36px; letter-spacing: 8px; font-family: 'Courier New', monospace;">%s</h1>
                            </div>
                        </div>

                        <p style="text-align: center; color: #e74c3c; font-weight: bold;">This code expires in 10 minutes.</p>

                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <p style="margin: 0;"><strong>Security Note:</strong> If you didn't request this code, please ignore this email and consider changing your password.</p>
                        </div>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                user.getFirstName(),
                verificationCode,
                appName);
    }

    // Email templates for profile management
    private String buildEmailChangeApprovalEmail(String firstName) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #27ae60;">Email Change Approved</h2>
                        <p>Dear %s,</p>
                        <p>Your email change request has been approved by an administrator.</p>
                        
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <p style="margin: 0; color: #155724;"><strong>Your email address has been successfully updated.</strong></p>
                        </div>

                        <p>You can now log in using your new email address.</p>
                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                firstName, appName);
    }

    private String buildEmailChangeRejectionEmail(String firstName, String rejectionReason) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #e74c3c;">Email Change Request Rejected</h2>
                        <p>Dear %s,</p>
                        <p>Your email change request has been rejected by an administrator.</p>
                        
                        <div style="background: #f8d7da; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #dc3545;">
                            <p style="margin: 0; color: #721c24;"><strong>Reason:</strong> %s</p>
                        </div>

                        <p>If you believe this was an error, please contact your administrator.</p>
                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                firstName, rejectionReason, appName);
    }

    private String buildOtpEmail(String firstName, String otpCode, String purpose) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #2c3e50;">OTP for %s</h2>
                        <p>Dear %s,</p>
                        <p>You have requested an OTP for %s. Please use the following code:</p>

                        <div style="text-align: center; margin: 30px 0;">
                            <div style="background: #f8f9fa; border: 2px dashed #3498db; padding: 20px; border-radius: 10px; display: inline-block;">
                                <h1 style="margin: 0; color: #2c3e50; font-size: 36px; letter-spacing: 8px; font-family: 'Courier New', monospace;">%s</h1>
                            </div>
                        </div>

                        <p style="text-align: center; color: #e74c3c; font-weight: bold;">This code expires in 10 minutes.</p>

                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <p style="margin: 0;"><strong>Security Note:</strong> If you didn't request this code, please ignore this email.</p>
                        </div>

                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                purpose, firstName, purpose, otpCode, appName);
    }

    private String buildPasswordChangeConfirmationEmail(String firstName) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #27ae60;">Password Changed Successfully</h2>
                        <p>Dear %s,</p>
                        <p>Your password has been successfully changed.</p>
                        
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <p style="margin: 0; color: #155724;"><strong>Your account security has been updated.</strong></p>
                        </div>

                        <p>If you did not make this change, please contact your administrator immediately.</p>
                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                firstName, appName);
    }

    private String buildEmailChangeRequestNotificationEmail(String adminEmail, User user, EmailChangeRequest request) {
        return String.format("""
                <html>
                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                        <h2 style="color: #f39c12;">Email Change Request - Action Required</h2>
                        <p>Dear Administrator,</p>
                        <p>A user has requested to change their email address. Please review and take action.</p>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #f39c12;">
                            <h3 style="margin-top: 0; color: #2c3e50;">Request Details:</h3>
                            <p><strong>User:</strong> %s %s</p>
                            <p><strong>Current Email:</strong> %s</p>
                            <p><strong>New Email:</strong> %s</p>
                            <p><strong>Reason:</strong> %s</p>
                            <p><strong>Request Date:</strong> %s</p>
                        </div>

                        <p>Please log in to the admin dashboard to approve or reject this request.</p>
                        <p>Best regards,<br>%s Team</p>
                    </div>
                </body>
                </html>
                """,
                user.getFirstName(), user.getLastName(), 
                request.getCurrentEmail(), request.getNewEmail(), 
                request.getReason(), request.getCreatedAt(), appName);
    }

    private String calculateDuration(Booking booking) {
        if (booking.getEndTime() != null) {
            long hours = java.time.Duration.between(booking.getStartTime(), booking.getEndTime()).toHours();
            long minutes = java.time.Duration.between(booking.getStartTime(), booking.getEndTime()).toMinutes() % 60;

            if (hours > 0 && minutes > 0) {
                return hours + " hours " + minutes + " minutes";
            } else if (hours > 0) {
                return hours + " hours";
            } else {
                return minutes + " minutes";
            }
        }
        return "Not specified";
    }

    public void sendApprovalEmail(String to, String firstName, String approverName, String role) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Account Approved - Welcome to Conference Room Booking System!");
        message.setText(
                "Dear " + firstName + ",\n\n" +
                        "🎉 Great news! Your account has been approved!\n\n" +
                        "Approved by: " + approverName + "\n" +
                        "Role assigned: " + role + "\n\n" +
                        "Your account is now active and you can access all features of the Conference Room Booking System.\n\n" +
                        "What you can do now:\n" +
                        "✅ Book conference rooms\n" +
                        "✅ View available rooms and schedules\n" +
                        "✅ Manage your bookings\n" +
                        "✅ Receive notifications about your meetings\n\n" +
                        "To get started, please visit our login page and sign in with your credentials.\n\n" +
                        "Welcome aboard!\n\n" +
                        "Best regards,\n" +
                        "Conference Room Booking System Team");
        mailSender.send(message);
    }

    public void sendRejectionEmail(String to, String firstName) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Account Registration Rejected - Conference Room Booking System");
        message.setText(
                "Dear " + firstName + ",\n\n" +
                        "We regret to inform you that your account registration has been rejected by an administrator.\n\n" +
                        "Your account has been removed from our system and you will not be able to access the Conference Room Booking System.\n\n" +
                        "If you believe this rejection was made in error, or if you would like to register again with different information, please:\n" +
                        "1. Contact your system administrator for clarification\n" +
                        "2. Visit our registration page to create a new account with updated information\n\n" +
                        "Best regards,\n" +
                        "Conference Room Booking System Team");
        mailSender.send(message);
    }

    public void sendPendingApprovalNotification(User pendingUser, User orgAdmin, List<User> systemAdmins) {
        String subject = "User Pending Approval - Conference Room Management System";
        String body = "A new user is pending approval.\n\n" +
                "User Name: " + pendingUser.getFirstName() + " " + pendingUser.getLastName() + "\n" +
                "User Email: " + pendingUser.getEmail() + "\n\n" +
                "Please log in to the system to review and approve this user.";

        // Notify organization admin if available
        if (orgAdmin != null && orgAdmin.getEmail() != null) {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setTo(orgAdmin.getEmail());
            message.setSubject(subject);
            message.setText(body);
            mailSender.send(message);
        }
        // Notify all system admins
        for (User sysAdmin : systemAdmins) {
            if (sysAdmin.getEmail() != null) {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setTo(sysAdmin.getEmail());
                message.setSubject(subject);
                message.setText(body);
                mailSender.send(message);
            }
        }
    }

    // --- Booking Approval Workflow Notifications ---
    public void sendBookingPendingToUser(Booking booking) {
        sendSimpleEmail(
                booking.getUser().getEmail(),
                "Booking Request Sent",
                "Your booking request for room '" + booking.getRoom().getName()
                        + "' has been sent and is pending approval.");
    }

    public void sendBookingPendingToAdmins(Booking booking, List<User> admins) {
        for (User admin : admins) {
            sendSimpleEmail(
                    admin.getEmail(),
                    "Booking Pending Approval",
                    "A new booking is pending your approval for room: '" + booking.getRoom().getName() + "'.");
        }
    }

    public void sendBookingApprovedToUser(Booking booking) {
        sendSimpleEmail(
                booking.getUser().getEmail(),
                "Booking Approved",
                "Your booking for room '" + booking.getRoom().getName() + "' has been approved.");
    }

    public void sendBookingRejectedToUser(Booking booking) {
        sendSimpleEmail(
                booking.getUser().getEmail(),
                "Booking Rejected",
                "Your booking for room '" + booking.getRoom().getName() + "' has been rejected.");
    }

    public void sendTimeoutNotificationEmail(String to, String firstName) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("Account Registration Expired - Conference Room Booking System");
        message.setText(
                "Dear " + firstName + ",\n\n" +
                        "Your account registration request has expired because no administrator reviewed it within the required 5-hour timeframe.\n\n" +
                        "Your account has been automatically deleted from our system for security purposes.\n\n" +
                        "You can register again at any time by visiting our registration page. " +
                        "We recommend registering during business hours when administrators are more likely to be available for approval.\n\n" +
                        "If you have any questions or need assistance, please contact your system administrator.\n\n" +
                        "Best regards,\n" +
                        "Conference Room Booking System Team");
        mailSender.send(message);
    }
}
