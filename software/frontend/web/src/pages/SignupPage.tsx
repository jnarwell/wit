// src/pages/SignupPage.tsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { FaGoogle, FaEye, FaEyeSlash, FaCheck, FaTimes } from 'react-icons/fa';
import axios from 'axios';
import './SignupPage.css';

interface PasswordStrength {
  score: number;
  label: string;
  color: string;
}

const SignupPage: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [recaptchaVerified, setRecaptchaVerified] = useState(false);
  const navigate = useNavigate();

  // Password validation rules
  const passwordRules = {
    minLength: formData.password.length >= 8,
    hasUpperCase: /[A-Z]/.test(formData.password),
    hasLowerCase: /[a-z]/.test(formData.password),
    hasNumber: /\d/.test(formData.password),
    hasSpecial: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password)
  };

  // Calculate password strength
  const getPasswordStrength = (): PasswordStrength => {
    const score = Object.values(passwordRules).filter(Boolean).length;
    if (score === 0) return { score: 0, label: '', color: '' };
    if (score <= 2) return { score: 1, label: 'Weak', color: 'text-red-500' };
    if (score <= 3) return { score: 2, label: 'Fair', color: 'text-yellow-500' };
    if (score <= 4) return { score: 3, label: 'Good', color: 'text-blue-500' };
    return { score: 4, label: 'Strong', color: 'text-green-500' };
  };

  const passwordStrength = getPasswordStrength();

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Username validation
    if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscores';
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Password validation
    if (passwordStrength.score < 3) {
      newErrors.password = 'Password is too weak';
    }

    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsLoading(true);
    setErrors({});

    try {
      const response = await axios.post('http://localhost:8000/api/v1/auth/signup', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
        recaptcha_token: recaptchaVerified ? 'dummy-token' : null
      });

      if (response.data.success) {
        // Instead of showing verification message, redirect to login
        navigate('/login', { 
          state: { 
            message: 'Account created successfully! Please login with your credentials.' 
          } 
        });
      }
    } catch (err: any) {
      if (err.response?.data?.detail) {
        if (typeof err.response.data.detail === 'string') {
          setErrors({ general: err.response.data.detail });
        } else if (err.response.data.detail.username) {
          setErrors({ username: 'Username already exists' });
        } else if (err.response.data.detail.email) {
          setErrors({ email: 'Email already registered' });
        }
      } else {
        setErrors({ general: 'Failed to create account. Please try again.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const response = await axios.get('http://localhost:8000/api/v1/auth/google');
      if (response.data.redirect_url) {
        window.location.href = response.data.redirect_url;
      }
    } catch (err: any) {
      if (err.response?.status === 503 && err.response?.data?.detail?.error === 'Google OAuth not configured') {
        setErrors({ 
          general: 'Google login is not configured. For development, you can use email/password signup instead.' 
        });
      } else {
        setErrors({ general: 'Failed to connect to Google. Please try again.' });
      }
    }
  };

  if (verificationSent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg shadow-lg">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 bg-green-500 rounded-full flex items-center justify-center mb-4">
              <FaCheck className="text-white text-xl" />
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Check your email!</h2>
            <p className="text-gray-300">
              We've sent a verification link to <strong>{formData.email}</strong>
            </p>
            <p className="text-gray-400 mt-4 text-sm">
              Please check your email and click the verification link to activate your account.
            </p>
            <div className="mt-6">
              <Link to="/login" className="text-blue-400 hover:text-blue-300">
                Back to Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Create your W.I.T. account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-400">
            Or{' '}
            <Link to="/login" className="font-medium text-blue-400 hover:text-blue-300">
              sign in to your existing account
            </Link>
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm space-y-4">
            {/* Google Sign Up Button */}
            <button
              type="button"
              onClick={handleGoogleSignup}
              className="w-full flex justify-center items-center px-4 py-3 border border-gray-600 rounded-md shadow-sm text-sm font-medium text-white bg-gray-700 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
              title="Requires Google OAuth configuration. See docs/GOOGLE_OAUTH_SETUP.md"
            >
              <FaGoogle className="mr-2" />
              Continue with Google
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-600"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-gray-900 text-gray-400">Or continue with</span>
              </div>
            </div>

            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                className={`appearance-none relative block w-full px-3 py-2 border ${
                  errors.username ? 'border-red-500' : 'border-gray-600'
                } rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Choose a username"
                value={formData.username}
                onChange={handleInputChange}
              />
              {errors.username && (
                <p className="mt-1 text-sm text-red-500">{errors.username}</p>
              )}
            </div>

            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className={`appearance-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-red-500' : 'border-gray-600'
                } rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleInputChange}
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-red-500' : 'border-gray-600'
                  } rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Create a password"
                  value={formData.password}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              
              {/* Password Strength Indicator */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-gray-400">Password strength:</span>
                    <span className={`text-xs font-medium ${passwordStrength.color}`}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4].map((level) => (
                      <div
                        key={level}
                        className={`h-1 flex-1 rounded-full ${
                          level <= passwordStrength.score
                            ? level <= 1 ? 'bg-red-500'
                            : level <= 2 ? 'bg-yellow-500'
                            : level <= 3 ? 'bg-blue-500'
                            : 'bg-green-500'
                            : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  
                  {/* Password Requirements */}
                  <div className="mt-2 space-y-1">
                    {Object.entries({
                      minLength: 'At least 8 characters',
                      hasUpperCase: 'One uppercase letter',
                      hasLowerCase: 'One lowercase letter',
                      hasNumber: 'One number',
                      hasSpecial: 'One special character'
                    }).map(([key, label]) => (
                      <div key={key} className="flex items-center text-xs">
                        {passwordRules[key as keyof typeof passwordRules] ? (
                          <FaCheck className="mr-1 text-green-500" />
                        ) : (
                          <FaTimes className="mr-1 text-gray-500" />
                        )}
                        <span className={passwordRules[key as keyof typeof passwordRules] ? 'text-green-500' : 'text-gray-500'}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {errors.password && (
                <p className="mt-1 text-sm text-red-500">{errors.password}</p>
              )}
            </div>

            {/* Confirm Password Input */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  className={`appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-600'
                  } rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm`}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <FaEyeSlash className="h-5 w-5 text-gray-400" />
                  ) : (
                    <FaEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-red-500">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          {errors.general && (
            <div className="rounded-md bg-red-900/50 p-4">
              <p className="text-sm text-red-400">{errors.general}</p>
            </div>
          )}
          
          {/* reCAPTCHA Placeholder */}
          <div className="bg-gray-700 p-4 rounded-md border border-gray-600">
            <div className="flex items-center justify-center">
              <input
                type="checkbox"
                id="recaptcha"
                checked={recaptchaVerified}
                onChange={(e) => setRecaptchaVerified(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="recaptcha" className="ml-2 block text-sm text-gray-300">
                I'm not a robot (reCAPTCHA placeholder)
              </label>
            </div>
            <p className="text-xs text-gray-500 text-center mt-2">
              This is a temporary placeholder. In production, use Google reCAPTCHA.
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={isLoading || !recaptchaVerified}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </button>
          </div>

          <div className="text-center text-sm text-gray-400">
            By creating an account, you agree to our{' '}
            <a href="/terms" className="text-blue-400 hover:text-blue-300">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="/privacy" className="text-blue-400 hover:text-blue-300">
              Privacy Policy
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;