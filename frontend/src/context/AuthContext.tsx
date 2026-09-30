import { createContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { getMe, logout as apiLogout } from '../services/api';

interface AuthCtxValue {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
  setToken: (t: string) => void;
}

export const AuthContext = createContext<AuthCtxValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = async () => {
    try {
      const data = await getMe();
      setUser(data);
    } catch (err) {
      console.error("failed to fetch user", err);
      localStorage.removeItem('token');
    } finally {
      setLoading(false);
    }
  };

  // check token on mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, []);

  const login = () => {
    window.location.href = 'http://localhost:4000/api/auth/google';
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch(e) {
      // quiet fail if network issue during logout
    }
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/';
  };

  const setToken = (t: string) => {
    localStorage.setItem('token', t);
    setLoading(true);
    fetchUser();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setToken }}>
      {children}
    </AuthContext.Provider>
  );
};
