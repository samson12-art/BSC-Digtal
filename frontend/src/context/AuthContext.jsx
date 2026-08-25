import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      api.get('/auth/me')
        .then(res => setUser(res.data))
        .catch(() => { localStorage.removeItem('token'); localStorage.removeItem('user'); setToken(null); setUser(null); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  };

  const completeOAuthLogin = useCallback(async (code) => {
    const res = await api.post('/auth/oauth/exchange', { code });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setToken(res.data.token);
    setUser(res.data.user);
    return res.data;
  }, []);

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    localStorage.setItem('user', JSON.stringify(res.data));
  };

  const isRole = (...roles) => user && roles.includes(user.role);
  const canApprove = () => user && ['DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO', 'BOARD_MEMBER'].includes(user.role);
  const isManager = () => user && ['DEPARTMENT_MANAGER', 'EXECUTIVE_MANAGER', 'CEO'].includes(user.role);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, completeOAuthLogin, logout, refreshUser, isRole, canApprove, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
