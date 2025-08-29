import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { FaUser, FaEnvelope, FaLock, FaCamera, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import Avatar from './Avatar';

const Profile = () => {
	console.log('Profile component - Component rendering, currentUser:', null); // Debug log
	
	const [activeTab, setActiveTab] = useState('basic');
	const [loading, setLoading] = useState(false);
	const [success, setSuccess] = useState('');
	const [error, setError] = useState('');

	// React Query client for cache invalidation
	const queryClient = useQueryClient();

	// Basic profile form state
	const [basicForm, setBasicForm] = useState({
		firstName: '',
		lastName: '',
		profilePictureUrl: ''
	});

	// File upload state
	const [selectedFile, setSelectedFile] = useState(null);
	const [previewUrl, setPreviewUrl] = useState('');

	// Email change form state
	const [emailForm, setEmailForm] = useState({
		newEmail: '',
		reason: ''
	});

	// Password change form state
	const [passwordForm, setPasswordForm] = useState({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
		otp: ''
	});

	const [showOtpField, setShowOtpField] = useState(false);
	const [otpSent, setOtpSent] = useState(false);

	// Handle file selection
	const handleFileSelect = (e) => {
		const file = e.target.files[0];
		if (file) {
			// Validate file type
			if (!file.type.startsWith('image/')) {
				setError('Please select an image file');
				return;
			}
			
			// Validate file size (max 5MB)
			if (file.size > 5 * 1024 * 1024) {
				setError('File size must be less than 5MB');
				return;
			}

			setSelectedFile(file);
			
			// Create preview URL
			const reader = new FileReader();
			reader.onload = (e) => {
				setPreviewUrl(e.target.result);
			};
			reader.readAsDataURL(file);
			setError('');
		}
	};

	// Fetch current user data - using direct API call instead of useQuery for debugging
	const [currentUser, setCurrentUser] = useState(null);

	// Direct API call to fetch user data
	const fetchUserData = async () => {
		try {
			console.log('Profile component - Fetching user data directly...');
			setLoading(true);
			const response = await api.get('/auth/me');
			console.log('Profile component - Direct API response:', response.data);
			setCurrentUser(response.data);
			
			// Set the form data immediately
			const data = response.data;
			console.log('Profile component - Setting form with data:', data);
			
			setBasicForm({
				firstName: data.firstName || '',
				lastName: data.lastName || '',
				profilePictureUrl: data.profilePictureUrl || ''
			});
			setPreviewUrl(data.profilePictureUrl || '');
			
		} catch (error) {
			console.error('Profile component - Error fetching user data:', error);
		} finally {
			setLoading(false);
		}
	};

	// Fetch data when component mounts
	useEffect(() => {
		console.log('Profile component - Component mounted, fetching data...');
		fetchUserData();
	}, []);

	// Refetch function for updates
	const refetchUser = () => {
		fetchUserData();
		// Invalidate shared cache so navbars/sidebars refresh their avatars
		try { queryClient.invalidateQueries({ queryKey: ['currentUser'] }); } catch {}
	};

	// Check if user is system admin (can change email without approval)
	const isSystemAdmin = currentUser?.role === 'SYSTEM_ADMIN';
	const isAdmin = currentUser?.role === 'ADMIN';
	const isNormalUser = currentUser?.role === 'USER';

	// Fetch email change requests
	const { data: emailRequests, refetch: refetchEmailRequests } = useQuery({
		queryKey: ['emailRequests'],
		queryFn: async () => {
			try {
				const response = await api.get('/profile/my-email-change-requests');
				// Ensure we always return an array
				return Array.isArray(response.data) ? response.data : [];
			} catch (error) {
				console.error('Error fetching email requests:', error);
				return []; // Return empty array on error
			}
		},
		enabled: activeTab === 'email',
		initialData: [] // Ensure it's always an array
	});

	// Handle file upload
	const handleFileUpload = async () => {
		if (!selectedFile) {
			setError('Please select a file first');
			return;
		}

		setLoading(true);
		setError('');

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await api.post('/profile/upload-picture', formData, {
				headers: {
					'Content-Type': 'multipart/form-data',
				},
			});

			const uploadedUrl = response.data.profilePictureUrl;
			setBasicForm({ ...basicForm, profilePictureUrl: uploadedUrl });
			// Update current user immediately for instant avatar refresh
			setCurrentUser((prev) => prev ? { ...prev, profilePictureUrl: uploadedUrl } : prev);
			setSuccess('Profile picture uploaded successfully!');
			setSelectedFile(null);
			// Refresh local data and global caches
			refetchUser();
			try { queryClient.invalidateQueries({ queryKey: ['currentUser'] }); } catch {}
		} catch (err) {
			setError(err.response?.data || 'Failed to upload profile picture');
		} finally {
			setLoading(false);
		}
	};

	// Handle basic profile update
	const handleBasicUpdate = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');

		try {
			// Only update names, not profile picture URL (handled separately)
			const updateData = {
				firstName: basicForm.firstName,
				lastName: basicForm.lastName
			};
			await api.put('/profile/update', updateData);
			setSuccess('Profile updated successfully!');
			// Update local current user state
			setCurrentUser((prev) => prev ? { ...prev, firstName: updateData.firstName, lastName: updateData.lastName } : prev);
			// Refresh caches so sidebars update
			try { queryClient.invalidateQueries({ queryKey: ['currentUser'] }); } catch {}
			refetchUser();
		} catch (err) {
			setError(err.response?.data || 'Failed to update profile');
		} finally {
			setLoading(false);
		}
	};

	// Temporary debug function
	const debugUserData = async () => {
		try {
			console.log('Testing debug endpoint...');
			const response = await api.get('/auth/debug-user');
			console.log('Debug user data:', response.data);
			
			// Also test the regular /auth/me endpoint
			const meResponse = await api.get('/auth/me');
			console.log('Regular /auth/me response:', meResponse.data);
			
		} catch (error) {
			console.error('Debug error:', error);
		}
	};

	// Handle email change request
	const handleEmailChangeRequest = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');

		try {
			if (isSystemAdmin) {
				// System admin can change email directly without approval
				await api.put('/profile/update', {
					...basicForm,
					email: emailForm.newEmail
				});
				setSuccess('Email changed successfully!');
				setEmailForm({ newEmail: '', reason: '' });
				refetchUser();
			} else {
				// Other users need approval
				await api.post('/profile/request-email-change', null, {
					params: {
						newEmail: emailForm.newEmail,
						reason: emailForm.reason
					}
				});
				const approvalMessage = isAdmin 
					? 'Email change request submitted successfully! A system administrator will review your request.'
					: 'Email change request submitted successfully! An administrator will review your request.';
				setSuccess(approvalMessage);
				setEmailForm({ newEmail: '', reason: '' });
				refetchEmailRequests();
			}
		} catch (err) {
			setError(err.response?.data || 'Failed to submit email change request');
		} finally {
			setLoading(false);
		}
	};

	// Generate OTP for password change
	const handleGenerateOtp = async () => {
		if (!passwordForm.currentPassword) {
			setError('Please enter your current email address');
			return;
		}

		setLoading(true);
		setError('');

		try {
			await api.post('/profile/generate-otp', null, {
				params: { email: passwordForm.currentPassword }
			});
			setOtpSent(true);
			setShowOtpField(true);
			setSuccess('OTP sent to your email address');
		} catch (err) {
			setError(err.response?.data || 'Failed to send OTP');
		} finally {
			setLoading(false);
		}
	};

	// Handle password change
	const handlePasswordChange = async (e) => {
		e.preventDefault();
		setLoading(true);
		setError('');
		setSuccess('');

		try {
			await api.post('/profile/change-password', passwordForm);
			setSuccess('Password changed successfully!');
			setPasswordForm({
				currentPassword: '',
				newPassword: '',
				confirmPassword: '',
				otp: ''
			});
			setShowOtpField(false);
			setOtpSent(false);
		} catch (err) {
			setError(err.response?.data || 'Failed to change password');
		} finally {
			setLoading(false);
		}
	};

	// Clear messages after 5 seconds
	useEffect(() => {
		if (success || error) {
			const timer = setTimeout(() => {
				setSuccess('');
				setError('');
			}, 5000);
			return () => clearTimeout(timer);
		}
	}, [success, error]);

	// Debug effect to track state changes
	useEffect(() => {
		console.log('Profile component - Component rendered with currentUser:', currentUser);
		console.log('Profile component - Current basicForm state:', basicForm);
		console.log('Profile component - Current previewUrl:', previewUrl);
	}, [currentUser, basicForm, previewUrl]);

	return (
		<div className="min-h-screen bg-black text-white p-4 sm:p-6">
			<div className="max-w-4xl mx-auto">
				{/* Header */}
				<div className="mb-6 sm:mb-8">
					<h1 className="text-xl sm:text-2xl font-['Poppins'] text-white mb-2">Profile Management</h1>
					<p className="text-gray-300 text-sm sm:text-base">Manage your account settings and preferences</p>
				</div>

				{/* Alert Messages */}
				{error && (
					<div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200">
						{error}
					</div>
				)}
				{success && (
					<div className="mb-6 p-4 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200">
						{success}
					</div>
				)}

				{/* Tab Navigation */}
				<div className="flex flex-wrap gap-2 mb-6 sm:mb-8 p-1">
					<button
						onClick={() => setActiveTab('basic')}
						className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full transition-colors text-sm sm:text-base ${
							activeTab === 'basic'
								? 'bg-white text-black'
								: 'text-white/70 hover:text-white'
						}`}
					>
						<FaUser />
						<span>Basic Info</span>
					</button>
					<button
						onClick={() => setActiveTab('email')}
						className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full transition-colors text-sm sm:text-base ${
							activeTab === 'email'
								? 'bg-white text-black'
								: 'text-white/70 hover:text-white'
						}`}
					>
						<FaEnvelope />
						<span>Email</span>
					</button>
					<button
						onClick={() => setActiveTab('password')}
						className={`flex items-center space-x-2 px-3 sm:px-4 py-2 rounded-full transition-colors text-sm sm:text-base ${
							activeTab === 'password'
								? 'bg-white text-black'
								: 'text-white/70 hover:text-white'
						}`}
					>
						<FaLock />
						<span>Password</span>
					</button>
				</div>

				{/* Tab Content */}
				<div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg p-4 sm:p-6">
					{/* Basic Profile Tab */}
					{activeTab === 'basic' && (
						<div>
							<h2 className="text-xl font-semibold mb-6 flex items-center">
								<FaUser className="mr-2" />
								Basic Information
							</h2>
							
							<form onSubmit={handleBasicUpdate} className="space-y-4 sm:space-y-6">
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											First Name
										</label>
										<input
											type="text"
											value={basicForm.firstName}
											onChange={(e) => setBasicForm({...basicForm, firstName: e.target.value})}
											className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
											required
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Last Name
										</label>
										<input
											type="text"
											value={basicForm.lastName}
											onChange={(e) => setBasicForm({...basicForm, lastName: e.target.value})}
											className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
											required
										/>
									</div>
								</div>
								
																	<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Profile Picture
										</label>
										
										{/* Current Profile Picture Display */}
										<div className="mb-4 flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
											<div className="relative">
												{selectedFile ? (
													<img
														src={previewUrl}
														alt="Profile Preview"
														className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gray-600"
													/>
												) : (
													<Avatar user={currentUser} size="2xl" className="border-2 border-gray-600" />
												)}
											</div>
											<div className="flex-1">
												<p className="text-sm text-gray-400">
													{selectedFile ? 'Preview of selected image' : 
													 currentUser?.profilePictureUrl ? 'Current profile picture' : 'No profile picture set'}
												</p>
											</div>
										</div>

									{/* File Upload Section */}
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Upload New Picture
										</label>
										<div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
											<input
												type="file"
												accept="image/*"
												onChange={handleFileSelect}
												className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-white file:text-black"
											/>
											{selectedFile && (
												<button
													type="button"
													onClick={handleFileUpload}
													disabled={loading}
													className={`px-4 py-2 rounded-lg font-medium transition-colors ${
														loading
															? 'bg-gray-600 text-gray-400 cursor-not-allowed'
															: 'bg-green-600 hover:bg-green-700 text-white'
													}`}
												>
													{loading ? (
														<FaSpinner className="animate-spin" />
													) : (
														'Upload'
													)}
												</button>
											)}
										</div>
										{selectedFile && (
											<p className="text-sm text-gray-400 mt-2">
												Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
											</p>
										)}
									</div>
								</div>

								<button
									type="submit"
									disabled={loading}
									className={`w-full px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
										loading
											? 'bg-gray-600 text-gray-400 cursor-not-allowed'
											: 'bg-white text-black'
									}`}
								>
									{loading ? (
										<>
											<FaSpinner className="animate-spin" />
											<span>Updating...</span>
										</>
									) : (
										<>
											<FaCheck />
											<span>Update Profile</span>
										</>
									)}
								</button>
							</form>
						</div>
					)}

					{/* Email Tab */}
					{activeTab === 'email' && (
						<div>
							<h2 className="text-xl font-semibold mb-6 flex items-center">
								<FaEnvelope className="mr-2" />
								Email Management
							</h2>

							{/* Current Email Display */}
							<div className="mb-6 p-3 sm:p-4 bg-gray-700 rounded-lg">
								<h3 className="text-sm font-medium text-gray-300 mb-2">Current Email</h3>
								<p className="text-white font-medium">{currentUser?.email}</p>
							</div>

							{/* Role-based Email Change Information */}
							<div className="mb-6 p-3 sm:p-4 bg-blue-500/20 border border-blue-500/50 rounded-lg">
								<h3 className="text-sm font-medium text-blue-200 mb-2">Email Change Policy</h3>
								{isSystemAdmin ? (
									<p className="text-blue-100 text-sm">
										As a System Administrator, you can change your email address directly without requiring approval.
									</p>
								) : isAdmin ? (
									<p className="text-blue-100 text-sm">
										As an Administrator, your email change request will be reviewed by a System Administrator.
									</p>
								) : (
									<p className="text-blue-100 text-sm">
										Your email change request will be reviewed by either a System Administrator or your Organization Administrator.
									</p>
								)}
							</div>

							{/* Email Change Form */}
							<form onSubmit={handleEmailChangeRequest} className="space-y-4 sm:space-y-6 mb-6 sm:mb-8">
								<h3 className="text-lg font-medium text-white">
									{isSystemAdmin ? 'Change Email Address' : 'Request Email Change'}
								</h3>
								
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										New Email Address
									</label>
									<input
										type="email"
										value={emailForm.newEmail}
										onChange={(e) => setEmailForm({...emailForm, newEmail: e.target.value})}
										className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="newemail@example.com"
										required
									/>
								</div>

								{!isSystemAdmin && (
									<div>
										<label className="block text-sm font-medium text-gray-300 mb-2">
											Reason for Change
										</label>
										<textarea
											value={emailForm.reason}
											onChange={(e) => setEmailForm({...emailForm, reason: e.target.value})}
											className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
											rows="3"
											placeholder="Please provide a reason for changing your email address..."
											required
										/>
									</div>
								)}

								<button
									type="submit"
									disabled={loading}
									className={`w-full px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
										loading
											? 'bg-gray-600 text-gray-400 cursor-not-allowed'
											: 'bg-white text-black'
									}`}
								>
									{loading ? (
										<>
											<FaSpinner className="animate-spin" />
											<span>Submitting...</span>
										</>
										) : (
										<>
											<FaEnvelope />
											<span>{isSystemAdmin ? 'Change Email' : 'Request Email Change'}</span>
										</>
									)}
								</button>
							</form>

							{/* Email Change Requests History */}
							{Array.isArray(emailRequests) && emailRequests.length > 0 && (
								<div>
									<h3 className="text-lg font-medium text-white mb-4">Email Change Requests</h3>
									<div className="space-y-3">
										{emailRequests.map((request) => (
											<div key={request.id} className="p-3 sm:p-4 bg-gray-700 rounded-lg">
												<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
													<div>
														<p className="text-white font-medium">
															{request.currentEmail} → {request.newEmail}
														</p>
														<p className="text-gray-400 text-sm mt-1">
															Reason: {request.reason}
														</p>
														<p className="text-gray-400 text-sm">
															Requested: {new Date(request.createdAt).toLocaleDateString()}
														</p>
													</div>
													<span className={`px-2 py-1 rounded text-xs font-medium ${
														request.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-300' :
														request.status === 'APPROVED' ? 'bg-green-500/20 text-green-300' :
														'bg-red-500/20 text-red-300'
													}`}>
														{request.status}
													</span>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</div>
					)}

					{/* Password Tab */}
					{activeTab === 'password' && (
						<div>
							<h2 className="text-xl font-semibold mb-6 flex items-center">
								<FaLock className="mr-2" />
								Password Management
							</h2>

							<form onSubmit={handlePasswordChange} className="space-y-4 sm:space-y-6">
								<div>
									<label className="block text-sm font-medium text-gray-300 mb-2">
										Current Email Address
									</label>
									<input
										type="email"
										value={passwordForm.currentPassword}
										onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
										className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder="your.email@example.com"
										required
									/>
									<p className="text-gray-400 text-sm mt-1">
										Enter your current email address to receive an OTP
									</p>
								</div>

								{!otpSent && (
									<button
										type="button"
										onClick={handleGenerateOtp}
										disabled={loading || !passwordForm.currentPassword}
										className={`w-full px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
											loading || !passwordForm.currentPassword
												? 'bg-gray-600 text-gray-400 cursor-not-allowed'
												: 'bg-white text-black'
										}`}
									>
										{loading ? (
											<>
												<FaSpinner className="animate-spin" />
												<span>Sending OTP...</span>
											</>
										) : (
											<>
												<FaEnvelope />
												<span>Send OTP</span>
											</>
										)}
									</button>
								)}

								{showOtpField && (
									<>
										<div>
											<label className="block text-sm font-medium text-gray-300 mb-2">
												OTP Code
											</label>
											<input
												type="text"
												value={passwordForm.otp}
												onChange={(e) => setPasswordForm({...passwordForm, otp: e.target.value})}
												className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none "
												placeholder="Enter 6-digit OTP"
												maxLength="6"
												required
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-300 mb-2">
												New Password
											</label>
											<input
												type="password"
												value={passwordForm.newPassword}
												onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
												className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="Enter new password"
												minLength="6"
												required
											/>
										</div>

										<div>
											<label className="block text-sm font-medium text-gray-300 mb-2">
												Confirm New Password
											</label>
											<input
												type="password"
												value={passwordForm.confirmPassword}
												onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
												className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
												placeholder="Confirm new password"
												minLength="6"
												required
											/>
										</div>

										<button
											type="submit"
											disabled={loading || passwordForm.newPassword !== passwordForm.confirmPassword}
											className={`w-full px-4 sm:px-6 py-2 sm:py-3 font-semibold rounded-lg transition-colors flex items-center justify-center space-x-2 ${
												loading || passwordForm.newPassword !== passwordForm.confirmPassword
													? 'bg-gray-600 text-gray-400 cursor-not-allowed'
													: 'bg-green-600 hover:bg-green-700 text-white'
											}`}
										>
											{loading ? (
												<>
													<FaSpinner className="animate-spin" />
													<span>Changing Password...</span>
												</>
											) : (
												<>
													<FaLock />
													<span>Change Password</span>
												</>
											)}
										</button>
									</>
								)}
							</form>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default Profile;
