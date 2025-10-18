import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api, setAuthToken, setRefreshToken } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('access_token') || null);
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    // Sync axios with existing token on mount
    setAuthToken(token);
  }, []);

  const isAuthenticated = !!token;

  const login = async ({ email, password }) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (!data?.access_token) {
      throw new Error('Login failed: missing access token');
    }
    setAuthToken(data.access_token);
    setToken(data.access_token);
    if (data?.refresh_token) {
      setRefreshToken(data.refresh_token);
    }
    if (data.user) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  };

  const signup = async ({ email, password, username }) => {
    const { data } = await api.post('/auth/signup', { email, password, username });
    if (data?.access_token) {
      setAuthToken(data.access_token);
      setToken(data.access_token);
    }
    if (data?.refresh_token) {
      setRefreshToken(data.refresh_token);
    }
    if (data?.user) {
      setUser(data.user);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    // If email confirmation required, API may not return token; caller should handle message
    return data;
  };

  const logout = () => {
    setAuthToken(null);
    setRefreshToken(null);
    setToken(null);
    setUser(null);
    localStorage.removeItem('user');
  };

  const value = useMemo(() => ({
    token,
    user,
    isAuthenticated,
    login,
    signup,
    logout,
  }), [token, user, isAuthenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}

// Simple guard for protected routes
export function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
}