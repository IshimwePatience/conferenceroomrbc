import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../utils/api';
import { jwtDecode } from 'jwt-decode';
import Avatar from './Avatar';

const UserLayoutWrapper = ({ children, setIsLoggedIn }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [userEmail, setUserEmail] = useState('');
    const [firstName, setFirstName] = useState('');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    
    console.log('UserLayoutWrapper rendering, notifications state:', notifications);

    // Fetch current user data
    const { data: currentUser } = useQuery({
        queryKey: ['currentUser'],
        queryFn: () => api.get('/auth/me').then(res => res.data),
        onSuccess: (data) => {
            setUserEmail(data.email || '');
            setFirstName(data.firstName || '');
        }
    });

    // Fetch notifications
    const { data: notificationsData, refetch, isLoading, error } = useQuery({
        queryKey: ['notifications'],
        queryFn: async () => {
            console.log('Making API call to /notification/notifications...');
            try {
                const response = await api.get('/notification/notifications');
                console.log('API response:', response);
                console.log('API response data:', response.data);
                return response.data;
            } catch (err) {
                console.error('API call failed:', err);
                throw err;
            }
        },
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    // Update notifications when data changes
    useEffect(() => {
        if (notificationsData) {
            console.log('Frontend received notifications:', notificationsData);
            console.log('Notifications length:', notificationsData ? notificationsData.length : 0);
            console.log('Notifications type:', typeof notificationsData);
            setNotifications(notificationsData || []);
        }
    }, [notificationsData]);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const decodedToken = jwtDecode(token);
                setUserEmail(decodedToken.sub);
                // Extract username from email (part before @)
                const extractedUsername = decodedToken.sub.split('@')[0];
                // Extract first name (part before first dot, or whole username if no dot)
                const extractedFirstName = extractedUsername.split('.')[0];
                setFirstName(extractedFirstName);
            } catch (error) {
                console.error('Error decoding token:', error);
            }
        }
    }, []);

    // Function to get first two letters of first name
    const getFirstTwoLetters = (name) => {
        if (!name) return 'US';
        return name.substring(0, 2).toUpperCase();
    };

    // Function to format time ago
    const formatTimeAgo = (dateString) => {
        const now = new Date();
        const date = new Date(dateString);
        const diffInMinutes = Math.floor((now - date) / (1000 * 60));
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        
        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours}h ago`;
        
        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays}d ago`;
    };

    // Function to mark notification as read
    const markNotificationAsRead = async (notificationId) => {
        try {
            await api.put(`/notification/${notificationId}/mark-read`);
            // Refetch notifications to update the count
            refetch();
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Function to mark all notifications as read
    const markAllNotificationsAsRead = async () => {
        try {
            await api.put('/notification/mark-all-read');
            // Refetch notifications to update the count
            refetch();
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
            // Close notifications dropdown when clicking outside
            if (!event.target.closest('.notifications-dropdown')) {
                setNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        delete api.defaults.headers.common['Authorization'];
        setIsLoggedIn(false);
        navigate('/login');
        setIsDropdownOpen(false);
    };

    const getLinkClass = (path) => {
        const isActive = location.pathname === path || (path === '/rooms' && location.pathname.startsWith('/booking'));
        return isActive 
            ? "text-cyan-400 font-medium hover:text-cyan-300 transition-colors"
            : "text-white/70 font-medium hover:text-white transition-colors";
    };

    const userInitials = getFirstTwoLetters(firstName);

    return (
        <div className="min-h-screen bg-black">
            {/* Fixed Top Navigation */}
            <header className="fixed top-0 left-0 right-0 bg-black px-4 sm:px-6 py-4 z-50">
                <div className="w-full flex items-center justify-between">
                    {/* Logo */}
                    <div className="flex items-center space-x-3">
                        <h1 className="text-xl sm:text-2xl font-['Poppins'] text-white font-normal">ConferenceRoom</h1>
                    </div>

                    {/* Desktop Navigation Links */}
                    <nav className="hidden md:flex items-center space-x-6 lg:space-x-8">
                        <Link to="/dashboard" className={getLinkClass('/dashboard')}>
                            Dashboard
                        </Link>
                        <Link to="/bookings" className={getLinkClass('/bookings')}>
                            My Bookings
                        </Link>
                        <Link to="/rooms" className={getLinkClass('/rooms')}>
                            Available Rooms
                        </Link>
                        <Link to="/profile" className={getLinkClass('/profile')}>
                            Profile
                        </Link>
                        <Link to="/rooms" className="px-4 py-2 bg-gray-700 text-white font-medium rounded-full hover:opacity-90 transition-colors">
                            Book Now
                        </Link>
                    </nav>

                    {/* Mobile User Profile & Hamburger */}
                    <div className="md:hidden flex items-center space-x-3">
                        {/* User Profile Avatar - No Dropdown */}
                        <Avatar user={currentUser} size="sm" />
                        
                        {/* Hamburger Menu Button */}
                        <button
                            className="p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-400"
                            aria-label="Open menu"
                            onClick={() => setMobileMenuOpen(true)}
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                        </button>
                    </div>

                    {/* User Profile & Dropdown (desktop) */}
                    <div className="hidden md:flex items-center space-x-2">
                        {/* Notifications Bell */}
                        <div className="relative mr-2">
                            <button 
                                onClick={() => setNotificationsOpen(!notificationsOpen)}
                                className="relative p-2 text-gray-400 hover:text-white transition-colors duration-200 hover:bg-gray-700/50 rounded-full"
                                aria-label="Notifications"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m7 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                </svg>
                                {/* Notification count */}
                                {notifications.length > 0 && (
                                    <span className="absolute -top-1 -right-1 block h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                        {notifications.length > 9 ? '9+' : notifications.length}
                                    </span>
                                )}
                            </button>
                            {/* Notifications Dropdown */}
                            {notificationsOpen && (
                                <div className="notifications-dropdown absolute right-0 mt-2 w-80 bg-black shadow-lg border border-gray-700 py-2 z-50 max-h-96 overflow-y-auto">
                                    <div className="px-4 py-2 text-sm text-blue-200 border-b border-gray-700">
                                        <p className="font-medium">Notifications</p>
                                        <p className="text-gray-400 text-xs">{notifications.length} new</p>
                                    </div>
                                    {notifications.length > 0 ? (
                                        <div className="divide-y divide-gray-700">
                                            {notifications.map((notification, index) => (
                                                <div 
                                                    key={index} 
                                                    className="px-4 py-3 hover:bg-gray-700/50 transition-colors cursor-pointer"
                                                    onClick={() => markNotificationAsRead(notification.id)}
                                                >
                                                    <div className="flex items-start space-x-3">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-medium">
                                                                {notification.adminName ? notification.adminName.charAt(0).toUpperCase() : 'A'}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white font-medium">
                                                                {notification.type === 'BOOKING_CANCELLED'
                                                                    ? `Booking cancelled: ${notification.roomName}`
                                                                    : `New room available: ${notification.roomName}`}
                                                            </p>
                                                            {/* Details line */}
                                                            {notification.type === 'BOOKING_CANCELLED' ? (
                                                                <>
                                                                    {notification.reason && (
                                                                        <p className="text-xs text-red-300 mt-1">Reason: {notification.reason}</p>
                                                                    )}
                                                                    {notification.bookingDate && (
                                                                        <p className="text-xs text-gray-400">Date: {new Date(notification.bookingDate).toLocaleString()}</p>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <p className="text-xs text-gray-400 mt-1">
                                                                        Added by {notification.adminName} ({notification.adminRole})
                                                                    </p>
                                                                    <p className="text-xs text-gray-400">
                                                                        Organization: {notification.organizationName}
                                                                    </p>
                                                                    {notification.visibleDate && (
                                                                        <p className="text-xs text-gray-400">Visible on: {new Date(notification.visibleDate).toLocaleDateString()}</p>
                                                                    )}
                                                                </>
                                                            )}
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatTimeAgo(notification.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="px-4 py-3 text-center text-gray-400 text-sm">
                                            No new notifications
                                        </div>
                                    )}
                                    <div className="px-4 py-2 border-t border-gray-700">
                                        {notifications.length > 0 && (
                                            <button 
                                                onClick={markAllNotificationsAsRead}
                                                className="w-full text-left text-sm text-gray-300 hover:text-white transition-colors mb-2"
                                            >
                                                Mark all as read
                                            </button>
                                        )}
                                        <button 
                                            onClick={() => setNotificationsOpen(false)}
                                            className="w-full text-left text-sm text-gray-300 hover:text-white transition-colors"
                                        >
                                            Close
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="relative" ref={dropdownRef}>
                            <button 
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className=""
                                aria-label="Open user menu"
                            >
                                <Avatar user={currentUser} size="md" />
                            </button>
                            {/* Dropdown Menu */}
                            {isDropdownOpen && (
                                <div className="absolute right-0 mt-2 w-48 bg-black shadow-lg border border-gray-700 py-2 z-50">
                                    <div className="px-4 py-2 text-sm text-blue-200 border-b border-gray-700">
                                        <p className="font-medium">User Account</p>
                                        <p className="text-gray-400 truncate">{userEmail}</p>
                                        <p className="text-xs text-blue-200 mt-1">Name: {firstName}</p>
                                    </div>
                                    <Link 
                                        to="/profile"
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center"
                                        onClick={() => setIsDropdownOpen(false)}
                                    >
                                        <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"/>
                                        </svg>
                                        Profile
                                    </Link>
                                    <button 
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 transition-colors flex items-center"
                                    >
                                        <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293-2.293a1 1 0 010-1.414A1 1 0 0114.707 1L18 4.293a1 1 0 010 1.414L14.707 9a1 1 0 01-1.414-1.414L15.586 5H4a3 3 0 00-3 3v9a3 3 0 003 3h12a3 3 0 003-3V4a1 1 0 00-1-1H3z" clipRule="evenodd"/>
                                        </svg>
                                        Logout
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Mobile menu overlay */}
                {mobileMenuOpen && (
                    <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex md:hidden">
                        <div className="w-64 bg-black h-full flex flex-col p-6 animate-slide-in-left relative text-white">
                            {/* Close button */}
                            <button
                                className="absolute top-4 right-4 text-gray-300 hover:text-white"
                                aria-label="Close menu"
                                onClick={() => setMobileMenuOpen(false)}
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                            
                            {/* Notifications Bell - Mobile */}
                            <div className="flex items-center justify-between px-6 py-2 mt-2 border-t border-gray-700">
                                <div className="flex items-center space-x-3">
                                    <button 
                                        onClick={() => setNotificationsOpen(!notificationsOpen)}
                                        className="relative p-2 text-gray-300 hover:text-white transition-colors"
                                        aria-label="Notifications"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-5-5V9a6 6 0 10-12 0v3l-5 5h5m7 0v1a3 3 0 11-6 0v-1m6 0H9"></path>
                                        </svg>
                                        {notifications.length > 0 && (
                                            <span className="absolute -top-1 -right-1 block h-5 w-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-medium">
                                                {notifications.length > 9 ? '9+' : notifications.length}
                                            </span>
                                        )}
                                    </button>
                                    <span className="text-gray-300 text-sm">Notifications ({notifications.length})</span>
                                </div>
                            </div>

                            {/* Notifications Dropdown - Mobile */}
                            {notificationsOpen && (
                                <div className="notifications-dropdown px-6 py-3 border-t border-gray-700">
                                    <div className="text-sm text-blue-200 mb-3">
                                        <p className="font-medium">Notifications</p>
                                        <p className="text-gray-400 text-xs">{notifications.length} new</p>
                                    </div>
                                    {notifications.length > 0 ? (
                                        <div className="space-y-3 max-h-64 overflow-y-auto">
                                            {notifications.map((notification, index) => (
                                                <div key={index} className="p-3 bg-gray-700/50 rounded-lg">
                                                    <div className="flex items-start space-x-3">
                                                        <div className="flex-shrink-0">
                                                            <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-medium">
                                                                {notification.adminName ? notification.adminName.charAt(0).toUpperCase() : 'A'}
                                                            </div>
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm text-white font-medium">
                                                                New room available: {notification.roomName}
                                                            </p>
                                                            <p className="text-xs text-gray-400 mt-1">
                                                                Added by {notification.adminName} ({notification.adminRole})
                                                            </p>
                                                            <p className="text-xs text-gray-400">
                                                                Organization: {notification.organizationName}
                                                            </p>
                                                            <p className="text-xs text-gray-500 mt-1">
                                                                {formatTimeAgo(notification.createdAt)}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center text-gray-400 text-sm py-4">
                                            No new notifications
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Navigation */}
                            <nav className="flex flex-col space-y-4 mt-8">
                                <Link to="/dashboard" className="text-cyan-400 font-medium hover:text-white transition-colors text-base" onClick={() => setMobileMenuOpen(false)}>
                                    Dashboard
                                </Link>
                                <Link to="/bookings" className="text-white/70 font-medium hover:text-white transition-colors text-base" onClick={() => setMobileMenuOpen(false)}>
                                    My Bookings
                                </Link>
                                <Link to="/rooms" className="text-white/70 font-medium hover:text-white transition-colors text-base" onClick={() => setMobileMenuOpen(false)}>
                                    Available Rooms
                                </Link>
                                <Link to="/profile" className="text-white/70 font-medium hover:text-white transition-colors text-base" onClick={() => setMobileMenuOpen(false)}>
                                    Profile
                                </Link>
                                <Link to="/rooms" className="px-4 py-2 bg-gray-700 text-white font-medium rounded-lg hover:opacity-90 transition-colors text-base shadow-md" onClick={() => setMobileMenuOpen(false)}>
                                    Book Now
                                </Link>
                                <button 
                                    onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                                    className="w-full text-left px-4 py-2 text-gray-300 hover:bg-gray-700 transition-colors flex items-center mt-4 border-t border-gray-700 pt-4"
                                >
                                    <svg className="w-4 h-4 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 001-1h10.586l-2.293-2.293a1 1 0 010-1.414A1 1 0 0114.707 1L18 4.293a1 1 0 010 1.414L14.707 9a1 1 0 01-1.414-1.414L15.586 5H4a3 3 0 00-3 3v9a3 3 0 003 3h12a3 3 0 003-3V4a1 1 0 00-1-1H3z" clipRule="evenodd"/>
                                    </svg>
                                    Logout
                                </button>
                            </nav>
                        </div>
                        {/* Click outside to close */}
                        <div className="flex-1" onClick={() => setMobileMenuOpen(false)}></div>
                    </div>
                )}
            </header>

            {/* Main Content with Top Padding */}
            <main className="w-full px-4 sm:px-6 py-8 pt-24">
                <div className="container mx-auto">
                    {children}
                </div>
            </main>
        </div>
    );
};

export default UserLayoutWrapper;