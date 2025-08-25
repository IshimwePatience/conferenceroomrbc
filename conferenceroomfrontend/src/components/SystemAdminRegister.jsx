import React, { useState, useEffect } from 'react';
import api, { getSystemAdminRegistrationEnabled } from '../utils/api';

const SystemAdminRegister = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isRegistrationEnabled, setIsRegistrationEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const checkRegistrationStatus = async () => {
            try {
                const enabled = await getSystemAdminRegistrationEnabled();
                setIsRegistrationEnabled(enabled);
            } catch (err) {
                console.error('Error checking registration status:', err);
                // If there's an error, we'll assume it's the first system admin (no config exists yet)
                setIsRegistrationEnabled(true);
            } finally {
                setIsLoading(false);
            }
        };
        checkRegistrationStatus();
    }, []);

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
            if (!formData.email) {
                setError('Please enter your email');
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

    const handleSubmit = async () => {
        setError('');
        setSuccess('');
        
        // Prevent multiple submissions
        if (isSubmitting) {
            setError('Please wait, processing your registration...');
            return;
        }

        if (!formData.password || !formData.confirmPassword) {
            setError('Please fill in all fields');
            return;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        if (!isRegistrationEnabled) {
            setError('System admin registration is currently disabled. Please contact an existing system admin.');
            return;
        }

        setIsSubmitting(true);
        try {
            const response = await api.post('/user/register-system-admin', formData);
            setSuccess('System admin registered successfully! You can now create organizations.');
            setFormData({
                firstName: '',
                lastName: '',
                email: '',
                password: '',
                confirmPassword: ''
            });
            setCurrentStep(1);
            setIsSubmitting(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
            setIsSubmitting(false);
        }
    };

    const renderStep1 = () => (
        <div className="youtube-form space-youtube-y">
            {error && (
                <div className="mb-youtube p-2 md:p-1.5 scaled:p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-center youtube-text-sm">
                    {error}
                </div>
            )}
            
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
            {error && (
                <div className="mb-youtube p-2 md:p-1.5 scaled:p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-center youtube-text-sm">
                    {error}
                </div>
            )}
            
            <input
                name="email"
                type="email"
                className="youtube-input bg-white/10 backdrop-blur-sm text-white font-light placeholder-white/70 border border-white/20 hover:shadow-lg focus:outline-none focus:border-cyan-400/50 focus:ring-1 focus:ring-cyan-400/20 transition-all"
                placeholder="Email address"
                value={formData.email}
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
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className={`flex-1 youtube-button transition-all ${
                        isSubmitting 
                            ? 'bg-gray-500 text-white cursor-not-allowed hover:shadow-none' 
                            : 'bg-gray-500 text-white hover:shadow-lg '
                    }`}
                >
                    {isSubmitting ? 'Signing up...' : 'Sign up'}
                </button>
            </div>
        </div>
    );

    if (isLoading) {
        return (
            <div className="w-full flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
            </div>
        );
    }

    if (!isRegistrationEnabled) {
        return (
            <div className="w-full">
                <div className="p-3 md:p-2 scaled:p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-200 text-center youtube-text-sm">
                    System admin registration is currently disabled. Please contact an existing system admin to enable registration.
                </div>
            </div>
        );
    }

    return (
        <div className="w-full">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
        </div>
    );
};

export default SystemAdminRegister;