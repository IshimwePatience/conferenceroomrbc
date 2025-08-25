import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { FaBuilding, FaCheck, FaSpinner } from 'react-icons/fa';

const OAuthOrganizationSelection = ({ user, onOrganizationSelected, onCancel }) => {
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrganization, setSelectedOrganization] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchOrganizations = async () => {
            try {
                const response = await api.get('/organization');
                setOrganizations(response.data);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch organizations. Please try again.');
                setLoading(false);
            }
        };

        fetchOrganizations();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!selectedOrganization) {
            setError('Please select an organization');
            return;
        }

        if (!password) {
            setError('Please enter a password');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters long');
            return;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            const response = await api.post('/auth/oauth/select-organization', {
                email: user.email,
                organizationName: selectedOrganization,
                password: password,
                confirmPassword: confirmPassword,
                firstName: user.firstName,
                lastName: user.lastName
            });

            if (response.data.success === false && !response.data.organizationSelectionRequired) {
                // Account created successfully, now pending approval
                onOrganizationSelected(response.data);
            } else {
                setError(response.data.message || 'Failed to create account');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create account. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <FaSpinner className="animate-spin text-blue-400 text-fluid-3xl mx-auto mb-youtube" />
                    <p className="text-white text-fluid-base">Loading organizations...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-compact-1 xs:p-compact-2 sm:p-compact-3 md:p-compact-4 lg:p-6 xl:p-8">
            <div className="youtube-form  shadow-lg">
                <div className="text-center mb-youtube">
                    <h2 className="text-fluid-2xl font-['Poppins'] text-white mb-compact-2">
                        Complete Your Account Setup
                    </h2>
                    <p className="text-gray-300 text-fluid-base">
                        Welcome, {user.firstName}! Please select your organization to complete your account registration.
                    </p>
                </div>

                {error && (
                    <div className="mb-youtube p-compact-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-youtube-y">
                    <div>
                        <label className="block text-gray-300 mb-compact-2 font-medium text-fluid-sm">
                            Select Your Organization
                        </label>
                        <select
                            value={selectedOrganization}
                            onChange={(e) => setSelectedOrganization(e.target.value)}
                            className="youtube-input bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            required
                        >
                            <option value="" className="bg-gray-700">Choose an organization...</option>
                            {organizations.map((org) => (
                                <option key={org.id} value={org.name} className="bg-gray-700">
                                    {org.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-compact-2 font-medium text-fluid-sm">
                            Create Password
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="youtube-input bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Enter your password"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-300 mb-compact-2 font-medium text-fluid-sm">
                            Confirm Password
                        </label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="youtube-input bg-gray-700 border border-gray-600 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Confirm your password"
                            required
                        />
                    </div>

                    <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-compact-4">
                        <div className="flex items-start gap-youtube">
                            <FaCheck className="text-blue-400 mt-1 flex-shrink-0" />
                            <div>
                                <h4 className="text-blue-300 font-semibold mb-compact-1 text-fluid-sm">What happens next?</h4>
                                <ul className="text-blue-200 youtube-text-sm space-y-1">
                                    <li>• Your account will be created with the selected organization</li>
                                    <li>• Your password will be securely stored for future logins</li>
                                    <li>• An administrator will review and approve your account</li>
                                    <li>• You'll receive an email notification once approved</li>
                                    <li>• You can then log in with your email and password</li>
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-youtube pt-compact-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="youtube-button bg-gray-600 hover:bg-gray-700 text-white transition-colors flex-1"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting || !selectedOrganization}
                            className={`youtube-button transition-colors flex items-center justify-center gap-youtube flex-1 ${
                                submitting || !selectedOrganization
                                    ? 'bg-gray-500 text-gray-300 cursor-not-allowed'
                                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                        >
                            {submitting ? (
                                <>
                                    <FaSpinner className="animate-spin" />
                                    <span>Setting up...</span>
                                </>
                            ) : (
                                <>
                                    <FaCheck />
                                    <span>Complete Setup</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-youtube text-center">
                    <p className="text-gray-400 youtube-text-sm">
                        Don't see your organization? Contact your system administrator.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OAuthOrganizationSelection;