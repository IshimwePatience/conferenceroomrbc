import React, { useState, useEffect } from 'react';
import api from '../utils/api';

const UserApprovalStatus = () => {
    const [userStatus, setUserStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const checkUserStatus = async () => {
            try {
                const response = await api.get('/user/status');
                setUserStatus(response.data);
            } catch (err) {
                if (err.response?.status === 401) {
                    // User not logged in, redirect to login
                    window.location.href = '/login';
                    return;
                }
                setError('Failed to fetch user status');
            } finally {
                setLoading(false);
            }
        };

        checkUserStatus();
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-white">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-red-400">{error}</div>
            </div>
        );
    }

    if (!userStatus) {
        return null;
    }

    const getStatusColor = (status) => {
        switch (status) {
            case 'APPROVED':
                return 'text-green-400';
            case 'PENDING':
                return 'text-yellow-400';
            case 'REJECTED':
                return 'text-red-400';
            default:
                return 'text-gray-400';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'APPROVED':
                return (
                    <svg className="w-6 h-6 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                    </svg>
                );
            case 'PENDING':
                return (
                    <svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                    </svg>
                );
            case 'REJECTED':
                return (
                    <svg className="w-6 h-6 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                    </svg>
                );
            default:
                return (
                    <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                    </svg>
                );
        }
    };

    const getStatusMessage = (status) => {
        switch (status) {
            case 'APPROVED':
                return 'Your account has been approved! You can now access all features.';
            case 'PENDING':
                return 'Your account is pending approval. An administrator will review your registration within 5 hours.';
            case 'REJECTED':
                return 'Your account registration was rejected. You can register again with different information.';
            default:
                return 'Unknown status. Please contact support.';
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-gray-800 rounded-lg shadow-lg p-6">
                <div className="text-center">
                    <div className="flex justify-center mb-4">
                        {getStatusIcon(userStatus.approvalStatus)}
                    </div>
                    
                    <h2 className="text-2xl font-bold text-white mb-2">
                        Account Status
                    </h2>
                    
                    <div className={`text-lg font-semibold mb-4 ${getStatusColor(userStatus.approvalStatus)}`}>
                        {userStatus.approvalStatus}
                    </div>
                    
                    <p className="text-gray-300 mb-6">
                        {getStatusMessage(userStatus.approvalStatus)}
                    </p>

                    {userStatus.approvalStatus === 'PENDING' && (
                        <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-4 mb-6">
                            <div className="flex items-center space-x-2 mb-2">
                                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                                </svg>
                                <span className="text-yellow-300 font-semibold">Important Notice</span>
                            </div>
                            <p className="text-yellow-200 text-sm">
                                If no administrator reviews your account within 5 hours, it will be automatically deleted and you'll need to register again.
                            </p>
                        </div>
                    )}

                    {userStatus.approvalStatus === 'REJECTED' && (
                        <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
                            <div className="flex items-center space-x-2 mb-2">
                                <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                                </svg>
                                <span className="text-red-300 font-semibold">Account Rejected</span>
                            </div>
                            <p className="text-red-200 text-sm">
                                Your account registration was rejected by an administrator. You can register again with different information.
                            </p>
                        </div>
                    )}

                    <div className="space-y-3">
                        {userStatus.approvalStatus === 'PENDING' && (
                            <button
                                onClick={() => window.location.href = '/login'}
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                Check Status Again
                            </button>
                        )}
                        
                        {userStatus.approvalStatus === 'REJECTED' && (
                            <button
                                onClick={() => window.location.href = '/register'}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                Register Again
                            </button>
                        )}
                        
                        {userStatus.approvalStatus === 'APPROVED' && (
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                            >
                                Go to Dashboard
                            </button>
                        )}
                        
                        <button
                            onClick={() => window.location.href = '/login'}
                            className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        >
                            Back to Login
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserApprovalStatus;
