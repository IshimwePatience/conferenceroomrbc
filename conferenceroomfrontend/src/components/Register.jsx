import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import SystemAdminRegister from './SystemAdminRegister';
import meetingImg from '../assets/images/meeting.jpg';
import rbc from '../assets/images/rbc.png';
import rbcheader from '../assets/images/rbcphoto.png';

const Register = () => {
    const [registrationType, setRegistrationType] = useState('user');
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        organizationName: ''
    });
    const [organizations, setOrganizations] = useState([]);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (registrationType === 'user') {
            const fetchOrganizations = async () => {
                try {
                    setIsLoading(true);
                    const response = await api.get('/organization');
                    if (Array.isArray(response.data)) {
                        setOrganizations(response.data);
                    } else {
                        setError('Invalid organization data received');
                        setOrganizations([]);
                    }
                } catch (err) {
                    console.error('Error fetching organizations:', err);
                    setError('Failed to fetch organizations. Please try again later.');
                    setOrganizations([]);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchOrganizations();
        } else {
            setIsLoading(false);
            setOrganizations([]);
        }
    }, [registrationType]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleNext = () => {
        if (currentStep === 1) {
            if (!formData.firstName || !formData.lastName) {
                setError('Please fill in all fields');
                return;
            }
        } else if (currentStep === 2) {
            if (!formData.email || !formData.password || !formData.confirmPassword) {
                setError('Please fill in all fields');
                return;
            }
            if (formData.password !== formData.confirmPassword) {
                setError('Passwords do not match');
                return;
            }
        }
        setError('');
        setCurrentStep(currentStep + 1);
    };

    const handleBack = () => {
        setCurrentStep(currentStep - 1);
        setError('');
    };

    const handleFinalSubmit = async () => {
        setError('');
        setSuccess('');
        
        // Prevent multiple submissions
        if (isSubmitting) {
            setError('Please wait, processing your registration...');
            return;
        }

        if (registrationType === 'user' && !formData.organizationName) {
            setError('Please select an organization');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post('/user/register', formData);
            
            if (response.data.success) {
                setSuccess(response.data.message + '. ' + response.data.nextStep);
                setFormData({
                    firstName: '',
                    lastName: '',
                    email: '',
                    password: '',
                    confirmPassword: '',
                    organizationName: ''
                });
                setCurrentStep(1);
                setRegistrationType('user'); // Reset to user registration
                
                // Show additional information about approval process
                setTimeout(() => {
                    setSuccess(
                        'Registration successful! Your account is now pending admin approval. ' +
                        'An administrator will review your registration within 5 hours. ' +
                        'You will receive an email notification once your account is approved. ' +
                        'If no action is taken within 5 hours, your account will be automatically deleted. ' +
                        'You can check your approval status by logging in with your credentials.'
                    );
                }, 1000);
            } else {
                setError(response.data.message || 'Registration failed');
            }
            setIsSubmitting(false);
        } catch (err) {
            setIsSubmitting(false);
            console.error('Registration error:', err);
            setError(err.response?.data?.message || 'Registration failed. Please try again.');
        }
    };

    const renderStep1 = () => (
        <div className="youtube-form space-youtube-y">
            <input
                name="firstName"
                type="text"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="First Name"
                value={formData.firstName}
                onChange={handleChange}
            />

            <input
                name="lastName"
                type="text"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="Last Name"
                value={formData.lastName}
                onChange={handleChange}
            />

            <button
                type="button"
                onClick={handleNext}
                className="youtube-button bg-gray-900 text-white hover:shadow-lg  transition-all"
            >
                Next
            </button>
        </div>
    );

    const renderStep2 = () => (
        <div className="youtube-form space-youtube-y">
            <input
                name="email"
                type="email"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="Email address"
                value={formData.email}
                onChange={handleChange}
            />

            <input
                name="password"
                type="password"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="Password"
                value={formData.password}
                onChange={handleChange}
            />

            <input
                name="confirmPassword"
                type="password"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="Confirm Password"
                value={formData.confirmPassword}
                onChange={handleChange}
            />

            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 youtube-button bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20"
                >
                    Go back
                </button>
                <button
                    type="button"
                    onClick={handleNext}
                    className="flex-1 youtube-button bg-gray-900 text-white hover:shadow-lg "
                >
                    Next
                </button>
            </div>
        </div>
    );

    const renderStep3 = () => (
        <div className="youtube-form space-youtube-y">
            <select
                name="organizationName"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                value={formData.organizationName}
                onChange={handleChange}
                disabled={isLoading}
            >
                <option value="" className="bg-gray-800">Select an organization</option>
                {organizations.map((org) => (
                    <option key={org.id} value={org.name} className="bg-gray-800">
                        {org.name}
                    </option>
                ))}
            </select>
            {isLoading && (
                <p className="youtube-text-sm text-white/60 text-center">Loading organizations...</p>
            )}

            <div className="flex gap-4">
                <button
                    type="button"
                    onClick={handleBack}
                    className="flex-1 youtube-button bg-white/10 backdrop-blur-sm border border-white/20 text-white hover:bg-white/20"
                >
                    Go back
                </button>
                <button
                    type="button"
                    onClick={handleFinalSubmit}
                    disabled={isLoading || isSubmitting}
                    className={`flex-1 youtube-button transition-all ${
                        isSubmitting 
                            ? 'bg-gray-500 text-white cursor-not-allowed hover:shadow-none' 
                            : 'bg-gray-900 text-white hover:shadow-lg '
                    }`}
                >
                    {isSubmitting ? 'Signing up...' : 'Sign up'}
                </button>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen w-full flex flex-col lg:flex-row relative overflow-hidden bg-black">
            {/* Background Space Elements - Same as Login */}
            <div className="absolute inset-0 overflow-hidden">
                
                {/* Shooting Stars */}
                <div className="absolute top-20 right-20 w-12 h-0.5 sm:w-16 sm:h-0.5 md:w-20 md:h-0.5 lg:w-24 lg:h-0.5 xl:w-28 xl:h-0.5 2xl:w-32 2xl:h-0.5 bg-gradient-to-r from-transparent via-white to-transparent transform rotate-45 animate-pulse opacity-80"></div>
                <div className="absolute bottom-40 left-40 w-10 h-0.5 sm:w-12 sm:h-0.5 md:w-16 md:h-0.5 lg:w-20 lg:h-0.5 xl:w-24 xl:h-0.5 2xl:w-28 2xl:h-0.5 bg-gradient-to-r from-transparent via-cyan-300 to-transparent transform -rotate-12 animate-pulse opacity-80"></div>
            </div>

              {/* Left Side Content */}
              <div className="flex-[2] md:flex-[2] lg:flex-[2] scaled:flex-[2] flex flex-col justify-center items-start px-6 py-6 md:px-10 md:py-8 lg:px-16 lg:py-12 scaled:px-14 scaled:py-12 relative bg-cover bg-center" style={{ backgroundImage: `url(${meetingImg})` }}>
                <div className="absolute inset-0 bg-black/50 z-0"></div>
                <div className="relative z-10 w-full flex flex-col">
                   {/* Logo */}
<div className="flex items-center space-x-3 mb-6 md:mb-4 scaled:mb-6">
    <div className="w-50 h-50 md:w-10 md:h-10 lg:w-18 lg:h-18 scaled:w-15 scaled:h-15 rounded-lg flex items-center justify-center">
        <img src={rbcheader} alt="RBC Logo" className="w-full h-full object-contain" />
    </div>
    <span className="text-white text-fluid-2xl font-['Poppins']">ConferenceRoomBooking</span>
</div>
                    
                    {/* Heading */}
                    <div className="max-w-lg">
                        <h1 className="text-fluid-3xl font-['Poppins'] text-white mb-4 md:mb-3 scaled:mb-4 leading-tight">
                            Sign in to your
                            <br />
                            <span className="text-gray-700">
                                Booking Partner!
                            </span>
                        </h1>
                    </div>
                </div>
            </div>

            {/* Right Side Form */}
            <div className="flex-[1] md:flex-[1] lg:flex-[1] scaled:flex-[1] flex items-start justify-center relative z-10 px-6 py-6 md:px-4 md:py-4 scaled:px-6 scaled:py-6 md:overflow-y-auto lg:overflow-y-auto">
                <div className="w-full max-w-md">
                    {/* RBC Header Logo - Only visible on md, lg, and scaled devices */}
                    <div className="hidden md:flex scaled:flex justify-center mb-8 lg:mb-10 scaled:mb-10">
                        <img 
                            src={rbcheader} 
                            alt="RBC Logo" 
                            className="h-12 md:h-14 lg:h-16 scaled:h-16 object-contain"
                        />
                    </div>

                    <div className="text-center font-light mb-6 md:mb-4 scaled:mb-6">
                        <h2 className="text-fluid-xl font-light text-white mb-2">REGISTER</h2>
                        <p className="text-white/70 font-light text-fluid-base">
                            {registrationType === 'user' ? 'User Registration' : 'System Admin Registration'}
                        </p>
                    </div>

                    {/* Registration Type Selection */}
                    <div className="flex justify-center mb-6 backdrop-blur-sm rounded-lg p-1">
                        <label className="flex items-center flex-1 justify-center p-3 cursor-pointer">
                            <input
                                type="radio"
                                className="sr-only"
                                name="registrationType"
                                value="user"
                                checked={registrationType === 'user'}
                                onChange={() => {
                                    setRegistrationType('user');
                                    setCurrentStep(1);
                                    setError('');
                                }}
                            />
                            <div className={`w-full text-center py-2  rounded-full transition-all ${
                                registrationType === 'user' 
                                    ? 'bg-white text-black' 
                                    : 'text-white/70 hover:text-white'
                            }`}>
                                User
                            </div>
                        </label>
                        <label className="flex items-center flex-1 justify-center p-3 cursor-pointer">
                            <input
                                type="radio"
                                className="sr-only"
                                name="registrationType"
                                value="system_admin"
                                checked={registrationType === 'system_admin'}
                                onChange={() => {
                                    setRegistrationType('system_admin');
                                    setCurrentStep(1);
                                    setError('');
                                }}
                            />
                            <div className={`w-full text-center py-2  rounded-full transition-all ${
                                registrationType === 'system_admin' 
                                    ? 'bg-white text-black' 
                                    : 'text-white/70 hover:text-white'
                            }`}>
                                System Admin
                            </div>
                        </label>
                    </div>

                    {/* Error and Success Messages */}
                    {error && (
                        <div className="mb-youtube p-2 md:p-1.5 scaled:p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-center youtube-text-sm">
                            {error}
                        </div>
                    )}
                    {success && (
                        <div className="mb-youtube p-2 md:p-1.5 scaled:p-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-200 text-center youtube-text-sm">
                            {success}
                        </div>
                    )}

                    <div className="flex justify-center">
                        {registrationType === 'user' && (
                            <form onSubmit={handleFinalSubmit} className="w-full">
                                {currentStep === 1 && renderStep1()}
                                {currentStep === 2 && renderStep2()}
                                {currentStep === 3 && renderStep3()}
                            </form>
                        )}

                        {registrationType === 'system_admin' && (
                            <div className="w-full">
                                <SystemAdminRegister />
                            </div>
                        )}
                    </div>

                    <p className="text-center youtube-text-sm text-white/60 mt-6 md:mt-4 scaled:mt-6">
                        Already have an account? <a href="/login" className="text-purple-400 hover:text-purple-300 transition-colors">Login</a>
                    </p>

                    {/* Terms and Conditions */}
                    <div className="text-center mt-6 md:mt-4 scaled:mt-6">
                        <p className="youtube-text-sm text-white/50">
                            By signing up with our <span className="text-cyan-400">Terms and Conditions</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;