// src/pages/EmailVerificationPage.tsx
import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { FaCheckCircle, FaTimesCircle, FaSpinner } from 'react-icons/fa';
import axios from 'axios';

const EmailVerificationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setVerificationStatus('error');
        setErrorMessage('No verification token provided');
        return;
      }

      try {
        const response = await axios.get(`http://localhost:8000/api/v1/auth/verify-email-api?token=${token}`);
        
        if (response.data.success) {
          setVerificationStatus('success');
        } else {
          setVerificationStatus('error');
          setErrorMessage('Verification failed');
        }
      } catch (err: any) {
        setVerificationStatus('error');
        if (err.response?.data?.detail) {
          setErrorMessage(err.response.data.detail);
        } else {
          setErrorMessage('Failed to verify email. Please try again.');
        }
      }
    };

    verifyEmail();
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg shadow-lg">
        {verificationStatus === 'loading' && (
          <div className="text-center">
            <FaSpinner className="animate-spin text-blue-500 text-5xl mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Verifying your email...</h2>
            <p className="text-gray-400">Please wait while we confirm your email address.</p>
          </div>
        )}

        {verificationStatus === 'success' && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <FaCheckCircle className="text-white text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Email Verified!</h2>
            <p className="text-gray-300 mb-6">
              Your email has been successfully verified. You can now log in to your account.
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Go to Login
            </Link>
          </div>
        )}

        {verificationStatus === 'error' && (
          <div className="text-center">
            <div className="mx-auto h-16 w-16 bg-red-500 rounded-full flex items-center justify-center mb-4">
              <FaTimesCircle className="text-white text-3xl" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Verification Failed</h2>
            <p className="text-gray-300 mb-6">
              {errorMessage || 'We could not verify your email address.'}
            </p>
            <div className="space-y-3">
              <Link
                to="/signup"
                className="block px-6 py-3 border border-gray-600 text-base font-medium rounded-md text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Back to Signup
              </Link>
              <p className="text-sm text-gray-400">
                If you're having trouble, please contact support.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmailVerificationPage;