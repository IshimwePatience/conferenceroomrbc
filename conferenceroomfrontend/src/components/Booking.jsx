import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { jwtDecode } from 'jwt-decode';
import { FaSearch } from 'react-icons/fa';
import { Listbox } from '@headlessui/react';
import { Fragment } from 'react';
import Footer from './Footer'

const PAGE_SIZE = 8;

// Utility function to check if two time ranges overlap
const isTimeOverlapping = (start1, end1, start2, end2) => {
    return start1 < end2 && start2 < end1;
};

const getUserRoleAndOrg = () => {
    const token = localStorage.getItem('token');
    if (token) {
        try {
            const decoded = jwtDecode(token);
            return { role: decoded.role, organizationId: decoded.organizationId };
        } catch (e) {
            return { role: null, organizationId: null };
        }
    }
    return { role: null, organizationId: null };
};

const Booking = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [purpose, setPurpose] = useState('');
    const [formError, setFormError] = useState('');
    const [success, setSuccess] = useState('');

    // New states for search, filter, sort, pagination
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [sortOrder, setSortOrder] = useState('desc'); // 'asc' or 'desc'
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const { role: userRole, organizationId: userOrgId } = getUserRoleAndOrg();

    const [actionError, setActionError] = useState('');
    const [actionSuccess, setActionSuccess] = useState('');
    const [conflictWarning, setConflictWarning] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    // Recurrence
    const [isRecurring, setIsRecurring] = useState(false);
    const [recurrencePattern, setRecurrencePattern] = useState('WEEKLY'); // WEEKLY | DAILY | CUSTOM:TUESDAY,THURSDAY
    const [recurrenceEndDate, setRecurrenceEndDate] = useState('');

        // Debounce search term
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 900);
        return () => clearTimeout(handler);
    }, [searchTerm]);
    
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearchTerm, statusFilter, sortOrder]);

    // Fetch room details if roomId exists
    const { data: room, error: roomError } = useQuery({
        queryKey: ['room', roomId],
        queryFn: () => api.get(`/room/${roomId}`).then(res => res.data),
        enabled: !!roomId,
        refetchInterval: 10000
    });

    // Fetch all bookings if no roomId
    const { data: bookings, error: bookingsError } = useQuery({
        queryKey: ['bookings'],
        queryFn: () => api.get('/booking').then(res => res.data),
        enabled: !roomId,
        refetchInterval: 10000
    });

    // Combine query errors
    const queryError = roomError || bookingsError;
    
    // Check for conflicts in real-time as user selects times
    useEffect(() => {
        if (startTime && endTime && bookings && Array.isArray(bookings)) {
            const newStart = new Date(startTime);
            const newEnd = new Date(endTime);
            
            // Check for conflicts with other users' bookings
            const roomBookings = bookings.filter(b => 
                b.roomId === roomId || b.roomName === room?.name
            );
            
            const conflicts = roomBookings.filter(b => {
                if (b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED') {
                    return false;
                }
                
                const existingStart = new Date(b.startTime);
                const existingEnd = new Date(b.endTime);
                
                return isTimeOverlapping(newStart, newEnd, existingStart, existingEnd);
            });
            
            if (conflicts.length > 0) {
                const conflict = conflicts[0];
                const conflictTime = `${new Date(conflict.startTime).toLocaleTimeString()} - ${new Date(conflict.endTime).toLocaleTimeString()}`;
                const conflictStatus = conflict.status;
                const conflictUser = conflict.userName || 'Another user';
                const conflictCount = conflicts.length;
                
                if (conflictCount === 1) {
                    setConflictWarning(`⚠️ Time conflict detected: Room is booked from ${conflictTime} (Status: ${conflictStatus}, Booked by: ${conflictUser})`);
                } else {
                    setConflictWarning(`⚠️ Multiple conflicts detected: ${conflictCount} existing bookings overlap with your selected time. First conflict: ${conflictTime} (Status: ${conflictStatus}, Booked by: ${conflictUser})`);
                }
            } else {
                setConflictWarning('');
            }
        } else {
            setConflictWarning('');
        }
    }, [startTime, endTime, bookings, roomId, room]);

    // Filtering, sorting, and pagination for all bookings
    let filteredBookings = bookings || [];
    if (debouncedSearchTerm) {
        filteredBookings = filteredBookings.filter(b =>
            (b.purpose && b.purpose.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
            (b.roomName && b.roomName.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
            (b.organizationName && b.organizationName.toLowerCase().includes(debouncedSearchTerm.toLowerCase()))
        );
    }
    if (statusFilter !== 'ALL') {
        filteredBookings = filteredBookings.filter(b => b.status === statusFilter);
    }
    filteredBookings = filteredBookings.sort((a, b) => {
        const dateA = new Date(a.startTime);
        const dateB = new Date(b.startTime);
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
    useEffect(() => {
        setTotalPages(Math.ceil(filteredBookings.length / PAGE_SIZE) || 1);
    }, [filteredBookings]);
    const startIdx = (currentPage - 1) * PAGE_SIZE;
    const paginatedBookings = filteredBookings.slice(startIdx, startIdx + PAGE_SIZE);

    const handleBooking = async (e) => {
        e.preventDefault();
        
        // Prevent multiple submissions
        if (isSubmitting) {
            setFormError('Please wait, your booking is being processed...');
            return;
        }
        
        // Check for conflicts before allowing submission
        if (conflictWarning) {
            setFormError('Cannot book due to time conflicts. Please choose a different time.');
            return;
        }
        
        setIsSubmitting(true);
        setFormError('');
        setSuccess('');
        if (!startTime || !endTime || !purpose) {
            setFormError('All fields are required.');
            return;
        }
        // New validation: prevent booking in the past or with invalid time range
        const now = new Date();
        const start = new Date(startTime);
        const end = new Date(endTime);
        if (start < now) {
            setFormError('Start time cannot be in the past.');
            return;
        }
        if (end <= start) {
            setFormError('End time must be after start time.');
            return;
        }
        // Business hours + weekdays + 15-min increments
        const day = start.getDay(); // 0 Sun .. 6 Sat
        if (day === 0 || day === 6 || end.getDay() === 0 || end.getDay() === 6) {
            setFormError('Bookings are allowed only on weekdays (Mon-Fri).');
            return;
        }
        const startMinutes = start.getHours() * 60 + start.getMinutes();
        const endMinutes = end.getHours() * 60 + end.getMinutes();
        if (startMinutes < 7 * 60 || endMinutes > 17 * 60) {
            setFormError('Bookings must be within business hours (07:00-17:00).');
            return;
        }
        // Prevent creating bookings for today after 17:00
        const isToday = start.toDateString() === new Date().toDateString();
        if (isToday && (now.getHours() > 17 || (now.getHours() === 17 && now.getMinutes() > 0))) {
            setFormError('Booking for today is closed after 17:00. Please choose another day.');
            return;
        }

        const durationMins = (end - start) / 60000;
        if (durationMins < 30) {
            setFormError('Minimum booking duration is 30 minutes.');
            return;
        }
        if (durationMins > 8 * 60) {
            setFormError('Maximum booking duration is 8 hours.');
            return;
        }
        
        // Prevent booking too close to current time (less than 5 minutes)
        const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
        if (start < fiveMinutesFromNow) {
            setFormError('Start time must be at least 5 minutes from now to allow for admin approval.');
            return;
        }
        // Debug: log a booking object to inspect its structure
        if (bookings && bookings.length > 0) {
            console.log('Sample booking object:', bookings[0]);
        }
        // Enhanced overlapping validation for the same user
        const token = localStorage.getItem('token');
        let userId = null;
        if (token) {
            try {
                const decoded = jwtDecode(token);
                userId = decoded.id || decoded.userId || decoded.sub; // Try common fields
            } catch (e) {}
        }
        
        if (userId && bookings && Array.isArray(bookings)) {
            const newStart = new Date(startTime);
            const newEnd = new Date(endTime);
            
            // Find all user's bookings (try different possible field names)
            const userBookings = bookings.filter(b => {
                const bookingUserId = b.userId || b.user_id || b.user || b.userEmail;
                return bookingUserId === userId || bookingUserId === userId?.toString();
            });
            
            // Check for overlapping with any active booking (PENDING, APPROVED)
            const hasOverlap = userBookings.some(b => {
                // Only check active bookings
                if (b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED') {
                    return false;
                }
                
                const existingStart = new Date(b.startTime);
                const existingEnd = new Date(b.endTime);
                
                // Check if times overlap using utility function
                const overlaps = isTimeOverlapping(newStart, newEnd, existingStart, existingEnd);
                
                if (overlaps) {
                    console.log('Overlap detected:', {
                        new: { start: newStart, end: newEnd },
                        existing: { start: existingStart, end: existingEnd, status: b.status, room: b.roomName }
                    });
                }
                
                return overlaps;
            });
            
            if (hasOverlap) {
                setFormError('You already have an active booking that overlaps with this time. Please choose a different time or cancel your existing booking first.');
                return;
            }
        }
        
        // Check for conflicts with other users' bookings in the same room
        if (bookings && Array.isArray(bookings)) {
            const newStart = new Date(startTime);
            const newEnd = new Date(endTime);
            
            const roomBookings = bookings.filter(b => 
                b.roomId === roomId || b.roomName === room?.name
            );
            
            const hasRoomConflict = roomBookings.some(b => {
                // Skip cancelled, completed, and rejected bookings
                if (b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED') {
                    return false;
                }
                
                const existingStart = new Date(b.startTime);
                const existingEnd = new Date(b.endTime);
                
                return isTimeOverlapping(newStart, newEnd, existingStart, existingEnd);
            });
            
            if (hasRoomConflict) {
                // Find the conflicting booking details for better error message
                const conflictingBooking = roomBookings.find(b => {
                    if (b.status === 'CANCELLED' || b.status === 'COMPLETED' || b.status === 'REJECTED') {
                        return false;
                    }
                    const existingStart = new Date(b.startTime);
                    const existingEnd = new Date(b.endTime);
                    return isTimeOverlapping(newStart, newEnd, existingStart, existingEnd);
                });
                
                if (conflictingBooking) {
                    const conflictTime = `${new Date(conflictingBooking.startTime).toLocaleTimeString()} - ${new Date(conflictingBooking.endTime).toLocaleTimeString()}`;
                    const conflictStatus = conflictingBooking.status;
                    const conflictUser = conflictingBooking.userName || 'Another user';
                    
                    setFormError(`⚠️ Time conflict detected! This room is already booked from ${conflictTime} (Status: ${conflictStatus}, Booked by: ${conflictUser}). Please choose a different time or room.`);
                } else {
                    setFormError('This room is already booked for the selected time. Please choose a different time or room.');
                }
                return;
            }
        }
        
        try {
            if (isRecurring) {
                await api.post('/booking/create/recurring', {
                    roomId,
                    startTime,
                    endTime,
                    purpose,
                    isRecurring: true,
                    recurrencePattern,
                    recurrenceEndDate,
                });
            } else {
                await api.post('/booking/create', {
                    roomId,
                    startTime,
                    endTime,
                    purpose,
                });
            }
            setSuccess('Booking created successfully!');
            setIsSubmitting(false); // Reset submitting state on success
            setTimeout(() => navigate('/bookings'), 2000);
        } catch (err) {
            setIsSubmitting(false); // Reset submitting state on error
            
            let errorMessage = 'An unexpected error occurred.';
            if (err.response?.data) {
                if (typeof err.response.data === 'string' && err.response.data.length < 100) {
                    // If the response data is a short string, use it directly.
                    errorMessage = err.response.data;
                } else if (err.response.data.message) {
                    // If it's an object with a message property, use that.
                    errorMessage = err.response.data.message;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            if (errorMessage.includes("You have already booked")) {
                setFormError("You have already booked this room for the selected time.");
            } else if (errorMessage.includes("already booked from")) {
                try {
                    // Try to extract details from the error response if available
                    let bookingDetails = null;
                    // Check for new backend error structure (custom exception fields)
                    if (err.response && err.response.data && typeof err.response.data === 'object') {
                        const d = err.response.data;
                        if (d.startTime && d.endTime && d.userName && d.userEmail && d.organizationName) {
                            const fromTime = new Date(d.startTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });
                            const toTime = new Date(d.endTime).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });
                            setFormError(`Sorry, this room is booked from ${fromTime} to ${toTime}.\nBooked by: ${d.userName} (${d.userEmail}) from ${d.organizationName}.`);
                            return;
                        }
                        // Legacy: check for nested conflictingBooking object
                        if (d.conflictingBooking) {
                            bookingDetails = d.conflictingBooking;
                        }
                    }
                    if (bookingDetails) {
                        const fromTime = new Date(bookingDetails.startTime).toLocaleString();
                        const toTime = new Date(bookingDetails.endTime).toLocaleString();
                        setFormError(`Sorry, this room is booked from ${fromTime} to ${toTime}.\nBooked by: ${bookingDetails.userName} (${bookingDetails.userEmail}) from ${bookingDetails.organizationName}.`);
                    } else {
                        // Fallback: try to parse from error message string
                        const parts = errorMessage.split(' from ')[1].split(' to ');
                        const fromTime = new Date(parts[0]).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });
                        const toTime = new Date(parts[1]).toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true, year: 'numeric', month: 'short', day: 'numeric' });
                        setFormError(`Sorry, this room is booked from ${fromTime} to ${toTime}. Please choose a different time or room.`);
                    }
                } catch (parseError) {
                    setFormError('This room is currently unavailable at the selected time. Please choose a different time or room.');
                }
            } else {
                setFormError(`Failed to create booking: ${errorMessage}`);
            }
            console.error(err);
        }
    };

    // Approve/Reject handlers
    const handleApprove = async (bookingId) => {
        setActionError(''); setActionSuccess('');
        try {
            await api.post(`/booking/${bookingId}/approve`);
            setActionSuccess('Booking approved successfully.');
            setTimeout(() => setActionSuccess(''), 3000);
        } catch (err) {
            setActionError('Failed to approve booking.');
            setTimeout(() => setActionError(''), 3000);
        }
    };
    const handleReject = async (bookingId) => {
        setActionError(''); setActionSuccess('');
        try {
            await api.post(`/booking/${bookingId}/reject`);
            setActionSuccess('Booking rejected successfully.');
            setTimeout(() => setActionSuccess(''), 3000);
        } catch (err) {
            setActionError('Failed to reject booking.');
            setTimeout(() => setActionError(''), 3000);
        }
    };

    const handleCancelBooking = async (bookingId) => {
        if (window.confirm("Are you sure you want to cancel this booking?")) {
            setActionError(''); setActionSuccess('');
            try {
                await api.post(`/booking/${bookingId}/cancel`);
                setActionSuccess('Booking cancelled successfully.');
                setTimeout(() => setActionSuccess(''), 3000);
            } catch (err) {
                setActionError('Failed to cancel booking: ' + (err.response?.data || err.message));
                setTimeout(() => setActionError(''), 3000);
            }
        }
    };

    // Add options for status and sort order
    const statusOptions = [
        { value: 'ALL', label: 'All Statuses' },
        { value: 'APPROVED', label: 'Approved' },
        { value: 'PENDING', label: 'Pending' },
        { value: 'COMPLETED', label: 'Completed' },
        { value: 'CANCELLED', label: 'Cancelled' },
    ];
    const sortOptions = [
        { value: 'desc', label: 'Newest First' },
        { value: 'asc', label: 'Oldest First' },
    ];

    if (queryError) {
        return (
            <div className="container min-h-screen bg-gray-900 flex items-center justify-center p-6">
                <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 text-red-300 max-w-md">
                    <p className="font-medium text-center">{queryError.message}</p>
                </div>
            </div>
        );
    }

    // If no roomId, show all bookings in table format
    if (!roomId) {
        return (
            <div className="container min-h-screen text-gray-500 p-6">
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <div className="mb-6">
                        <h1 className="text-2xl font-['Poppins'] text-gray-500">My Bookings</h1>
                        <p className="text-gray-400">Track and manage your room reservations.</p>
                    </div>

                    {/* Search, Filter, Sort Controls */}
                    <div className="mb-6 flex flex-wrap gap-4 items-center">
                        <div className="relative flex-grow md:flex-grow-0">
                            <input
                                type="text"
                                placeholder="Search bookings..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        </div>
                        {/* Status Dropdown */}
                        <Listbox value={statusFilter} onChange={setStatusFilter} as={Fragment}>
                            <div className="relative w-full sm:w-auto">
                                <Listbox.Button className="w-full sm:w-auto text-sm py-1 px-2 bg-gray-800 border border-gray-700 rounded-sm text-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {statusOptions.find(o => o.value === statusFilter)?.label}
                                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </Listbox.Button>
                                <Listbox.Options className="absolute z-10 mt-1 w-full sm:w-48 bg-gray-900 border border-gray-700 rounded-sm shadow-lg py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {statusOptions.map(option => (
                                        <Listbox.Option key={option.value} value={option.value} as={Fragment}>
                                            {({ active, selected }) => (
                                                <li className={`cursor-pointer select-none relative py-2 px-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-200'} ${selected ? 'font-semibold' : ''}`}>{option.label}</li>
                                            )}
                                        </Listbox.Option>
                                    ))}
                                </Listbox.Options>
                            </div>
                        </Listbox>
                        {/* Sort Dropdown */}
                        <Listbox value={sortOrder} onChange={setSortOrder} as={Fragment}>
                            <div className="relative w-full sm:w-auto">
                                <Listbox.Button className="w-full sm:w-auto text-sm py-1 px-2 bg-gray-800 border border-gray-700 rounded-sm text-white flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-blue-500">
                                    {sortOptions.find(o => o.value === sortOrder)?.label}
                                    <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                                </Listbox.Button>
                                <Listbox.Options className="absolute z-10 mt-1 w-full sm:w-48 bg-gray-900 border border-gray-700 rounded-sm shadow-lg py-1 text-base ring-1 ring-black ring-opacity-5 focus:outline-none">
                                    {sortOptions.map(option => (
                                        <Listbox.Option key={option.value} value={option.value} as={Fragment}>
                                            {({ active, selected }) => (
                                                <li className={`cursor-pointer select-none relative py-2 px-4 ${active ? 'bg-blue-600 text-white' : 'text-gray-200'} ${selected ? 'font-semibold' : ''}`}>{option.label}</li>
                                            )}
                                        </Listbox.Option>
                                    ))}
                                </Listbox.Options>
                            </div>
                        </Listbox>
                    </div>

                    {/* Show action error/success */}
                    {(actionError || actionSuccess) && (
                        <div className={`mb-4 px-4 py-2 rounded-lg font-semibold text-center transition-all duration-300 shadow-lg ${actionSuccess ? 'bg-green-700 text-green-100' : 'bg-red-700 text-red-100'}`}>
                            {actionError || actionSuccess}
                        </div>
                    )}
                    {/* Bookings Table */}
                    <div className="bg-gray-800 border border-gray-700 rounded-sm overflow-hidden">
                        {!paginatedBookings || paginatedBookings.length === 0 ? (
                            <div className="text-center py-16">
                                <h3 className="text-xl font-bold text-white mb-2">No Bookings Found</h3>
                                <p className="text-gray-400">Your search and filter criteria did not match any bookings.</p>
                                {userRole === 'USER' && (
                                    <button 
                                        onClick={() => navigate('/rooms')}
                                        className="mt-4 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                    >
                                        Browse Rooms to Book
                                    </button>
                                )}
                            </div>
                        ) : (
                            <div>
                                <table className="w-full min-w-[600px] divide-y divide-gray-700 text-xs sm:text-sm">
                                    <thead className="bg-gray-800">
                                        <tr>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Room</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Organization</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Start Time</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">End Time</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Purpose</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                                            <th className="py-3 px-4 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-gray-800 divide-y divide-gray-700">
                                        {paginatedBookings.map(booking => {
                                            // Force show for org admins
                                            let canApproveReject = false;
                                            if (userRole === 'SYSTEM_ADMIN') {
                                                canApproveReject = booking.status === 'PENDING';
                                            } else if (userRole === 'ADMIN') {
                                                canApproveReject = booking.status === 'PENDING';
                                            }
                                            return (
                                                <tr key={booking.id} className="hover:bg-gray-700/50 transition-colors">
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white">{booking.roomName}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{booking.organizationName}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{new Date(booking.startTime).toLocaleString()}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">{new Date(booking.endTime).toLocaleString()}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300 truncate max-w-xs">{booking.purpose}</td>
                                                    <td className="px-4 py-3 whitespace-nowrap">
                                                        <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full items-center ${
                                                            booking.status === 'APPROVED' ? 'bg-green-500/20 text-green-300' :
                                                            booking.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                                            booking.status === 'COMPLETED' ? 'bg-blue-500/20 text-blue-300' :
                                                            'bg-gray-600/50 text-gray-300'
                                                        }`}>
                                                            {booking.status}
                                                            {booking.status === 'PENDING' && (
                                                                <span className="ml-1 group relative cursor-pointer">
                                                                    <svg className="w-3 h-3 text-yellow-300 inline-block" fill="currentColor" viewBox="0 0 20 20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v2h-2zm0 4h2v6h-2z" /></svg>
                                                                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 max-w-[180px] w-auto bg-black text-xs text-yellow-200 rounded px-2 py-1 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-20 whitespace-normal break-words text-center pointer-events-none">
                                                                        Pending bookings require admin approval. You will be notified when approved or rejected.
                                                                    </span>
                                                                </span>
                                                            )}
                                                        </span>
                                                        {canApproveReject && (
                                                            <div className="flex space-x-2 mt-2">
                                                                <button onClick={() => handleApprove(booking.id)} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 text-xs">Approve</button>
                                                                <button onClick={() => handleReject(booking.id)} className="px-2 py-1 bg-pink-600 text-white rounded hover:bg-pink-700 text-xs">Reject</button>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-300">
                                                        {/* Cancel button - only show for user's own pending bookings */}
                                                        {booking.status === 'PENDING' && (
                                                            <button
                                                                onClick={() => handleCancelBooking(booking.id)}
                                                                className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition-colors"
                                                                title="Cancel this pending booking"
                                                            >
                                                                Cancel
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    {/* Pagination Controls */}
                    <div className="flex justify-center items-center mt-8 space-x-4">
                        <button
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                            className="px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white disabled:opacity-50"
                        >
                            Previous
                        </button>
                        <span className="text-gray-500 font-medium">Page {currentPage} of {totalPages}</span>
                        <button
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                            className="px-4 py-2 rounded-lg font-semibold bg-gray-700 text-white disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // If roomId exists, show booking form
    if (!room) {
        return (
            <div className="container min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-3 text-gray-400">Loading room details...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container min-h-screen text-gray-500 p-2 sm:p-6">
            <div className="max-w-lg mx-auto w-full">
                {/* Header */}
                <div className="mb-6 text-center">
                    <h1 className="text-3xl font-['Poppins'] text-gray-500">Book Room: {room.name}</h1>
                    <p className="text-gray-400">Organization: {room.organizationName}</p>
                    
                    {/* Show existing bookings for this room */}
                    {bookings && Array.isArray(bookings) && (
                        <div className="mt-4 p-3 bg-gray-700/50 rounded-lg">
                            <h3 className="text-sm font-medium text-gray-300 mb-2">Existing Bookings for This Room:</h3>
                            <div className="text-xs text-gray-400 space-y-1">
                                {bookings
                                    .filter(b => (b.roomId === roomId || b.roomName === room?.name) && b.isActive)
                                    .slice(0, 3) // Show only first 3
                                    .map((booking, index) => (
                                        <div key={index} className="flex justify-between items-center">
                                            <span>{new Date(booking.startTime).toLocaleTimeString()} - {new Date(booking.endTime).toLocaleTimeString()}</span>
                                            <div className="flex items-center space-x-2">
                                                <span className={`px-2 py-1 rounded text-xs ${
                                                    booking.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
                                                    booking.status === 'APPROVED' ? 'bg-green-500/20 text-green-300' :
                                                    'bg-gray-500/20 text-gray-300'
                                                }`}>
                                                    {booking.status}
                                                </span>
                                                {/* Cancel button for user's own pending bookings */}
                                                {booking.status === 'PENDING' && (
                                                    <button
                                                        onClick={() => handleCancelBooking(booking.id)}
                                                        className="px-1 py-0.5 bg-red-600 text-white rounded hover:bg-red-700 text-xs transition-colors"
                                                        title="Cancel this pending booking"
                                                    >
                                                        ×
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                {bookings.filter(b => (b.roomId === roomId || b.roomName === room?.name) && b.isActive).length > 3 && (
                                    <div className="text-gray-500 text-xs mt-1">... and {bookings.filter(b => (b.roomId === roomId || b.roomName === room?.name) && b.isActive).length - 3} more</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Alert Messages */}
                {formError && (
                    <div className="mb-4 p-3 bg-red-500/20 text-red-300 border border-red-500/50 rounded-lg">{formError}</div>
                )}
                {success && (
                    <div className="mb-4 p-3 bg-green-500/20 text-green-300 border border-green-500/50 rounded-lg">
                        Booking request sent! Your booking is now <b>pending approval</b> by an administrator.
                    </div>
                )}
                {conflictWarning && (
                    <div className="mb-4 p-3 bg-yellow-500/20 text-yellow-300 border border-yellow-500/50 rounded-lg">
                        {conflictWarning}
                    </div>
                )}

                {/* Booking Form */}
                <div className="bg-gray-700 border border-gray-700 rounded-lg p-14">
                    {/* Custom CSS for datetime inputs */}
                    <style jsx>{`
                        input[type="datetime-local"]::-webkit-calendar-picker-indicator {
                            filter: invert(1);
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-fields-wrapper {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-text {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-month-field {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-day-field {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-year-field {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-hour-field {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-minute-field {
                            color: white;
                        }
                        input[type="datetime-local"]::-webkit-datetime-edit-ampm-field {
                            color: white;
                        }
                    `}</style>
                    <form onSubmit={handleBooking} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                            <div>
                                <label htmlFor="startTime" className="block text-sm font-medium text-gray-300 mb-1">Start Time</label>
                                <input
                                    type="datetime-local"
                                    id="startTime"
                                    value={startTime}
                                    onChange={(e) => {
                                        const selectedTime = e.target.value;
                                        if (selectedTime) {
                                            const date = new Date(selectedTime);
                                            const hour = date.getHours();
                                            const minute = date.getMinutes();
                                            
                                            // Validate business hours
                                            if (hour < 7 || hour >= 17) {
                                                setFormError('Start time must be between 7:00 AM and 5:00 PM.');
                                                return;
                                            }
                                            
                                            setFormError(''); // Clear error if valid
                                        }
                                        setStartTime(selectedTime);
                                    }}
                                    min={(() => {
                                        const now = new Date();
                                        const currentHour = now.getHours();
                                        const currentMinute = now.getMinutes();
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        
                                        console.log('Current time:', now.toLocaleString());
                                        console.log('Current hour:', currentHour);
                                        console.log('Today is:', today.toLocaleDateString());
                                        
                                        // If it's past 17:00 today, start from tomorrow (21st)
                                        if (currentHour >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            console.log('Past 17:00, starting from tomorrow (21st):', tomorrow.toLocaleString());
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's before 7:00 AM today, start from 7:00 AM today
                                        if (currentHour < 7) {
                                            today.setHours(7, 0, 0, 0); // 7:00 AM today
                                            console.log('Before 7:00 AM, starting from 7:00 AM today:', today.toLocaleString());
                                            return today.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's during business hours today, start from now + 5 minutes
                                        const minStart = new Date(now);
                                        minStart.setMinutes(minStart.getMinutes() + 5);
                                        
                                        // If time goes past 17:00, move to next day (21st)
                                        if (minStart.getHours() >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            console.log('Time past 17:00, starting from tomorrow (21st):', tomorrow.toISOString().slice(0, 16));
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        console.log('During business hours, starting from:', minStart.toLocaleString());
                                        return minStart.toISOString().slice(0, 16);
                                    })()}
                                    max={(() => {
                                        // Allow booking up to 4 weeks in the future
                                        const maxDate = new Date();
                                        maxDate.setDate(maxDate.getDate() + 28); // 4 weeks from now
                                        maxDate.setHours(17, 0, 0, 0); // 5:00 PM on that date
                                        return maxDate.toISOString().slice(0, 16);
                                    })()}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label htmlFor="endTime" className="block text-sm font-medium text-gray-300 mb-1">End Time</label>
                                <input
                                    type="datetime-local"
                                    id="endTime"
                                    value={endTime}
                                    onChange={(e) => {
                                        const selectedTime = e.target.value;
                                        if (selectedTime) {
                                            const date = new Date(selectedTime);
                                            const hour = date.getHours();
                                            const minute = date.getMinutes();
                                            
                                            // Validate business hours
                                            if (hour < 7 || hour >= 17) {
                                                setFormError('End time must be between 7:00 AM and 5:00 PM.');
                                                return;
                                            }
                                            
                                            setFormError(''); // Clear error if valid
                                        }
                                        setEndTime(selectedTime);
                                    }}
                                    min={startTime || (() => {
                                        const now = new Date();
                                        const currentHour = now.getHours();
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        
                                        // If it's past 17:00 today, start from tomorrow
                                        if (currentHour >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's before 7:00 AM today, start from 7:00 AM today
                                        if (currentHour < 7) {
                                            today.setHours(7, 0, 0, 0); // 7:00 AM today
                                            return today.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's during business hours today, start from now + 5 minutes
                                        const minStart = new Date(now);
                                        minStart.setMinutes(minStart.getMinutes() + 5);
                                        
                                        // If time goes past 17:00, move to next day
                                        if (minStart.getHours() >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        return minStart.toISOString().slice(0, 16);
                                    })()}
                                    max={(() => {
                                        // Allow booking up to 4 weeks in the future
                                        const maxDate = new Date();
                                        maxDate.setDate(maxDate.getDate() + 28); // 4 weeks from now
                                        maxDate.setHours(17, 0, 0, 0); // 5:00 PM on that date
                                        return maxDate.toISOString().slice(0, 16);
                                    })()}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                        </div>
                        {/* Recurrence Controls */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-4">
                            <div className="flex items-center space-x-2">
                                <input type="checkbox" id="isRecurring" checked={isRecurring} onChange={(e)=>setIsRecurring(e.target.checked)} />
                                <label htmlFor="isRecurring" className="text-sm text-gray-300">Recurring</label>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Pattern</label>
                                <select disabled={!isRecurring} value={recurrencePattern} onChange={(e)=>setRecurrencePattern(e.target.value)} className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white">
                                    <option value="WEEKLY">Weekly</option>
                                    <option value="DAILY">Daily (Mon-Fri)</option>
                                    <option value="CUSTOM:TUESDAY,THURSDAY">Custom: Tue & Thu</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Repeat Until</label>
                                <input 
                                    type="datetime-local" 
                                    disabled={!isRecurring} 
                                    value={recurrenceEndDate} 
                                    onChange={(e)=>setRecurrenceEndDate(e.target.value)} 
                                    min={startTime || (() => {
                                        const now = new Date();
                                        const currentHour = now.getHours();
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        
                                        // If it's past 17:00 today, start from tomorrow
                                        if (currentHour >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's before 7:00 AM today, start from 7:00 AM today
                                        if (currentHour < 7) {
                                            today.setHours(7, 0, 0, 0); // 7:00 AM today
                                            return today.toISOString().slice(0, 16);
                                        }
                                        
                                        // If it's during business hours today, start from now + 5 minutes
                                        const minStart = new Date(now);
                                        minStart.setMinutes(minStart.getMinutes() + 5);
                                        
                                        // If time goes past 17:00, move to next day
                                        if (minStart.getHours() >= 17) {
                                            const tomorrow = new Date(today);
                                            tomorrow.setDate(tomorrow.getDate() + 1);
                                            tomorrow.setHours(7, 0, 0, 0); // 7:00 AM tomorrow
                                            return tomorrow.toISOString().slice(0, 16);
                                        }
                                        
                                        return minStart.toISOString().slice(0, 16);
                                    })()}
                                    className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white" 
                                />
                            </div>
                        </div>
                        <div>
                            <label htmlFor="purpose" className="block text-sm font-medium text-gray-300 mb-1">Purpose</label>
                            <textarea
                                id="purpose"
                                value={purpose}
                                onChange={(e) => setPurpose(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows="3"
                                placeholder="Describe the purpose of your booking..."
                            ></textarea>
                        </div>
                        <div className="pt-2">
                            <button
                                type="submit"
                                disabled={!!conflictWarning || isSubmitting}
                                className={`w-full px-3 py-2 font-semibold rounded-lg text-sm transition-colors ${
                                    conflictWarning 
                                        ? 'bg-gray-500 text-gray-300 cursor-not-allowed' 
                                        : isSubmitting
                                        ? 'bg-white text-black cursor-wait'
                                        : 'bg-white text-black'
                                }`}
                            >
                                {conflictWarning ? 'Cannot Book - Time Conflict' : 
                                 isSubmitting ? 'Processing...' : 'Book Now'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
            
        </div>
        
    );
};

export default Booking;