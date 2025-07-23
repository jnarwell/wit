// src/pages/LoginPage.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FiUser, FiLock, FiTerminal, FiAlertCircle, FiEye, FiEyeOff } from 'react-icons/fi';
import { useAuth } from '../contexts/AuthContext';

const LoginPage: React.FC<{ redirectTo?: string }> = ({ redirectTo = '/' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showDemo, setShowDemo] = useState(true);

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const from = (location.state as any)?.from?.pathname || redirectTo;
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location, redirectTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(username, password, rememberMe);
      const from = (location.state as any)?.from?.pathname || redirectTo;
      navigate(from, { replace: true });
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setUsername('admin');
    setPassword('admin');
    setShowDemo(false);
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and Title */}
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600 p-4 rounded-full">
              <FiTerminal className="h-12 w-12 text-white" />
            </div>
          </div>
          <h2 className="text-4xl font-bold text-white mb-2">W.I.T. Terminal</h2>
          <p className="text-gray-400">Workshop Integrated Terminal</p>
        </div>

        {/* Login Form */}
        <div className="bg-gray-800 rounded-lg shadow-xl p-8">
          <h3 className="text-2xl font-semibold text-white mb-6 text-center">
            Sign in to your account
          </h3>

          {/* Demo Credentials Banner */}
          {showDemo && (
            <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
              <div className="flex items-start space-x-3">
                <FiAlertCircle className="text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="text-blue-300 font-medium mb-1">Demo Mode</p>
                  <p className="text-blue-200">
                    Username: <span className="font-mono bg-blue-800/50 px-1 rounded">admin</span>
                  </p>
                  <p className="text-blue-200">
                    Password: <span className="font-mono bg-blue-800/50 px-1 rounded">admin</span>
                  </p>
                  <button
                    type="button"
                    onClick={fillDemoCredentials}
                    className="mt-2 text-blue-400 hover:text-blue-300 underline text-xs"
                  >
                    Fill demo credentials
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg">
              <div className="flex items-center space-x-2">
                <FiAlertCircle className="text-red-400" />
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiUser className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-700 rounded-lg 
                           bg-gray-900 text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-colors"
                  placeholder="Enter your username"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FiLock className="h-5 w-5 text-gray-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-10 pr-10 py-3 border border-gray-700 rounded-lg 
                           bg-gray-900 text-white placeholder-gray-500
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                           transition-colors"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                >
                  {showPassword ? (
                    <FiEyeOff className="h-5 w-5 text-gray-500 hover:text-gray-400" />
                  ) : (
                    <FiEye className="h-5 w-5 text-gray-500 hover:text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember Me */}
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-700 
                           rounded bg-gray-800 focus:ring-offset-gray-900"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-300">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                  Forgot password?
                </a>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg
                       text-sm font-medium text-white bg-blue-600 hover:bg-blue-700
                       focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       focus:ring-offset-gray-900"
            >
              {isLoading ? (
                <div className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Additional Links */}
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-400">
              Don't have an account?{' '}
              <a href="/create-user" className="font-medium text-blue-400 hover:text-blue-300 transition-colors">
                Create one now
              </a>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-xs text-gray-500">
            © 2025 W.I.T. Terminal. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;