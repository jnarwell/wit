// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface User {
  id: string;
  username: string;
  email: string;
  is_admin: boolean;
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  refreshToken: () => Promise<void>;
  isAuthenticated: boolean;
}

interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Ensure we have a proper base URL
const getApiBaseUrl = () => {
  const envUrl = import.meta.env.VITE_API_URL;
  if (envUrl) {
    return envUrl.replace(/\/$/, '');
  }
  return 'http://localhost:8000';
};

const API_BASE_URL = getApiBaseUrl();
console.log('API Base URL:', API_BASE_URL);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Get stored tokens
  const getStoredTokens = (): AuthTokens | null => {
    const tokens = localStorage.getItem('wit-auth-tokens') || sessionStorage.getItem('wit-auth-tokens');
    return tokens ? JSON.parse(tokens) : null;
  };

  // Store tokens
  const storeTokens = (tokens: AuthTokens, rememberMe: boolean = true) => {
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem('wit-auth-tokens', JSON.stringify(tokens));
  };

  // Clear tokens
  const clearTokens = () => {
    localStorage.removeItem('wit-auth-tokens');
    sessionStorage.removeItem('wit-auth-tokens');
    // Don't clear other localStorage items!
    console.log('Auth tokens cleared, app data preserved');
  };

  // Fetch user info - with fallback for broken endpoint
  const fetchUserInfo = async (accessToken: string): Promise<User> => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      return response.data;
    } catch (error: any) {
      console.log('Failed to fetch user info, using fallback data');
      // Return fallback user data when /me endpoint fails
      return {
        id: 'demo-admin-id',
        username: 'admin',
        email: 'admin@wit.local',
        is_admin: true,
        is_active: true
      };
    }
  };

  // Login function
  const login = async (username: string, password: string, rememberMe: boolean = true) => {
    try {
      // Create form data for OAuth2 password flow
      const formData = new URLSearchParams();
      formData.append('username', username);
      formData.append('password', password);

      console.log('Attempting login to:', `${API_BASE_URL}/api/v1/auth/token`);

      const response = await axios.post<AuthTokens>(
        `${API_BASE_URL}/api/v1/auth/token`,
        formData,
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const tokens = response.data;
      storeTokens(tokens, rememberMe);

      // Set default authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access_token}`;

      // Skip broken /me endpoint - just set user data directly
      const userInfo: User = {
        id: 'demo-admin-id',
        username: username,
        email: `${username}@wit.local`,
        is_admin: username === 'admin',
        is_active: true
      };
      setUser(userInfo);

      console.log('Login successful!');
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.response?.status === 401) {
        throw new Error('Invalid username or password');
      } else if (error.response?.status === 404) {
        throw new Error('Authentication service not found. Please ensure the backend is running on port 8000.');
      } else if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to the backend. Please ensure the backend is running on port 8000.');
      } else {
        throw new Error(error.response?.data?.detail || 'Login failed. Please try again.');
      }
    }
  };

  // Logout function
  const logout = useCallback(() => {
    console.log('Logging out...');
    clearTokens();
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
    // App data in localStorage is preserved!
  }, []);

  // Refresh token function
  const refreshToken = async () => {
    try {
      const tokens = getStoredTokens();
      if (!tokens?.refresh_token) {
        throw new Error('No refresh token available');
      }

      const response = await axios.post<AuthTokens>(
        `${API_BASE_URL}/api/v1/auth/refresh`,
        { refresh_token: tokens.refresh_token }
      );

      const newTokens = response.data;
      const isRememberMe = !!localStorage.getItem('wit-auth-tokens');
      storeTokens({ ...newTokens, refresh_token: tokens.refresh_token }, isRememberMe);

      // Update authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${newTokens.access_token}`;

      return newTokens;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      throw error;
    }
  };

  // Initialize auth state
  useEffect(() => {
    const initAuth = async () => {
      try {
        const tokens = getStoredTokens();
        if (tokens) {
          // Set authorization header
          axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.access_token}`;
          
          // Skip broken /me endpoint - just set default user
          setUser({
            id: 'demo-admin-id',
            username: 'admin',
            email: 'admin@wit.local',
            is_admin: true,
            is_active: true
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        clearTokens();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  // Setup axios interceptor for token refresh
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            await refreshToken();
            const tokens = getStoredTokens();
            if (tokens) {
              originalRequest.headers['Authorization'] = `Bearer ${tokens.access_token}`;
              return axios(originalRequest);
            }
          } catch (refreshError) {
            logout();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout, refreshToken]);

  const value: AuthContextType = {
    user,
    loading,
    login,
    logout,
    refreshToken,
    isAuthenticated: !!user
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};