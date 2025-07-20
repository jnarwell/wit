// src/utils/auth-utils.ts
// Complete authentication utilities for W.I.T.

// API base URL configuration
const API_BASE_URL = process.env.NODE_ENV === 'development' 
  ? 'http://localhost:8000'
  : '';

// Types
export interface User {
  username: string;
  email?: string;
  full_name?: string;
  disabled?: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

// Token management
export const AuthTokens = {
  getToken: (): string | null => {
    return localStorage.getItem('access_token');
  },
  
  setToken: (token: string): void => {
    localStorage.setItem('access_token', token);
  },
  
  removeToken: (): void => {
    localStorage.removeItem('access_token');
  },
  
  isAuthenticated: (): boolean => {
    return !!AuthTokens.getToken();
  }
};

// Auth headers helper
export const getAuthHeaders = (): HeadersInit => {
  const token = AuthTokens.getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return headers;
};

// Auth API functions
export const AuthAPI = {
  login: async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      if (response.ok) {
        const data: LoginResponse = await response.json();
        AuthTokens.setToken(data.access_token);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  },
  
  logout: (): void => {
    AuthTokens.removeToken();
    // Optionally redirect to home or login page
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  },
  
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/me`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        return await response.json();
      }
      
      // If 401, token is invalid
      if (response.status === 401) {
        AuthTokens.removeToken();
      }
      
      return null;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  },
  
  register: async (username: string, password: string, email?: string, fullName?: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          password,
          email,
          full_name: fullName
        })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Register error:', error);
      return false;
    }
  }
};

// Auth hooks for React (optional - if using hooks)
export const useAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = React.useState(AuthTokens.isAuthenticated());
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const checkAuth = async () => {
      if (AuthTokens.isAuthenticated()) {
        const currentUser = await AuthAPI.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username: string, password: string): Promise<boolean> => {
    const success = await AuthAPI.login(username, password);
    if (success) {
      const currentUser = await AuthAPI.getCurrentUser();
      setUser(currentUser);
      setIsAuthenticated(true);
    }
    return success;
  };

  const logout = () => {
    AuthAPI.logout();
    setUser(null);
    setIsAuthenticated(false);
  };

  return {
    isAuthenticated,
    user,
    loading,
    login,
    logout
  };
};

// Protected route component (optional - for React Router)
export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    // Redirect to login or show login prompt
    return <div>Please login to continue</div>;
  }

  return <>{children}</>;
};

// Axios interceptor setup (optional - if using axios)
export const setupAxiosInterceptors = (axios: any) => {
  // Request interceptor to add auth token
  axios.interceptors.request.use(
    (config: any) => {
      const token = AuthTokens.getToken();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error: any) => Promise.reject(error)
  );

  // Response interceptor to handle 401
  axios.interceptors.response.use(
    (response: any) => response,
    (error: any) => {
      if (error.response?.status === 401) {
        AuthTokens.removeToken();
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );
};

// Utility to check if token is expired (if you include exp in JWT)
export const isTokenExpired = (): boolean => {
  const token = AuthTokens.getToken();
  if (!token) return true;

  try {
    // Decode JWT without verification (for client-side exp check)
    const payload = JSON.parse(atob(token.split('.')[1]));
    const exp = payload.exp;
    if (!exp) return false;
    
    // Check if expired (exp is in seconds)
    return Date.now() >= exp * 1000;
  } catch (error) {
    return true;
  }
};

// Re-export everything for convenience
export default {
  AuthTokens,
  AuthAPI,
  getAuthHeaders,
  useAuth,
  ProtectedRoute,
  setupAxiosInterceptors,
  isTokenExpired
};