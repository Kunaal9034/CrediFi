import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('jv_token') || null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('jv_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
          }
        } catch (err) {
          console.error('Session validation error:', err);
          logout();
        }
      }
      setIsLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.data.success) {
      localStorage.setItem('jv_token', res.data.token);
      localStorage.setItem('jv_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const register = async (userData) => {
    const res = await api.post('/auth/register', userData);
    if (res.data.success) {
      localStorage.setItem('jv_token', res.data.token);
      localStorage.setItem('jv_user', JSON.stringify(res.data.user));
      setToken(res.data.token);
      setUser(res.data.user);
      return res.data.user;
    }
  };

  const logout = () => {
    localStorage.removeItem('jv_token');
    localStorage.removeItem('jv_user');
    setToken(null);
    setUser(null);
  };

  // Quick Switcher for Hackathon Demonstrations
  const switchDemoRole = async (roleName) => {
    const emailMap = {
      ADMIN: 'admin@justicevault.gov',
      OFFICER: 'officer@justicevault.gov',
      FORENSIC: 'forensic@justicevault.gov',
      PROSECUTOR: 'prosecutor@justicevault.gov',
      JUDGE: 'judge@justicevault.gov',
    };

    const targetEmail = emailMap[roleName.toUpperCase()];
    if (targetEmail) {
      return await login(targetEmail, 'Password123!');
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        switchDemoRole
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
