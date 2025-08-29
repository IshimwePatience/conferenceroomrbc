import React from 'react';
import { FaUser } from 'react-icons/fa';

const Avatar = ({ user, size = 'md', className = '' }) => {
	const API_BASE_URL = import.meta.env.VITE_API_URL || '';

	const resolveUrl = (url) => {
		if (!url) return '';
		if (url.startsWith('http://') || url.startsWith('https://')) return url;
		if (url.startsWith('/')) return `${API_BASE_URL}${url}`;
		return `${API_BASE_URL}/${url}`;
	};

	// Generate initials - always show first two characters from email username
	const getInitials = (user) => {
		if (!user) {
			return 'US';
		}

		// Always try to get first two characters from email username
		if (user.email) {
			const username = user.email.split('@')[0] || '';
			// Get first two characters (can be letters, numbers, or symbols)
			if (username.length >= 2) {
				return username.substring(0, 2).toUpperCase();
			}
			// If username is only 1 character, pad with 'U'
			if (username.length === 1) {
				return (username + 'U').toUpperCase();
			}
		}

		// Fallback based on role if no email
		switch (user.role) {
			case 'SYSTEM_ADMIN':
				return 'SA';
			case 'ADMIN':
				return 'AD';
			case 'USER':
				return 'US';
			default:
				return 'US';
		}
	};

	// Size classes
	const sizeClasses = {
		sm: 'w-8 h-8 text-xs',
		md: 'w-10 h-10 text-sm',
		lg: 'w-12 h-12 text-base',
		xl: 'w-16 h-16 text-lg',
		'2xl': 'w-20 h-20 text-xl'
	};

	const sizeClass = sizeClasses[size] || sizeClasses.md;

	// Check if user has a profile picture
	const hasProfilePicture = user?.profilePictureUrl && user.profilePictureUrl.trim() !== '';
	const imageUrl = hasProfilePicture ? resolveUrl(user.profilePictureUrl) : '';

	return (
		<div className={`${sizeClass} ${className}`}>
			{hasProfilePicture ? (
				<img
					src={imageUrl}
					alt={`${user.firstName || 'User'} ${user.lastName || ''}`}
					className="w-full h-full rounded-full object-cover border-2 border-gray-600"
					onError={(e) => {
						// If image fails to load, hide it and show initials instead
						e.target.style.display = 'none';
						e.target.nextSibling.style.display = 'flex';
					}}
				/>
			) : null}

			{/* Fallback with initials */}
			<div 
				className={`w-full h-full rounded-full bg-gray-700 flex items-center justify-center text-white font-medium ${
					hasProfilePicture ? 'hidden' : 'flex'
				}`}
				style={{ display: hasProfilePicture ? 'none' : 'flex' }}
			>
				{getInitials(user)}
			</div>
		</div>
	);
};

export default Avatar;
