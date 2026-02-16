import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WPUser, getCurrentUser, isAuthenticated as checkAuth, logout as wpLogout } from '../services/auth';
import { syncPendingData } from '../services/userData';

interface AuthContextType {
  user: WPUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (user: WPUser) => void;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<WPUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      if (checkAuth()) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
          if (currentUser) {
            await syncPendingData(); // 同步待同步的数据
          }
        } catch (error) {
          console.error('Failed to get current user:', error);
          wpLogout();
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  // 定期同步数据（每5分钟）
  useEffect(() => {
    if (!user) return;

    const interval = setInterval(async () => {
      try {
        await syncPendingData();
      } catch (error) {
        console.error('Background sync failed:', error);
      }
    }, 5 * 60 * 1000); // 5分钟

    return () => clearInterval(interval);
  }, [user]);

  const login = (userData: WPUser) => {
    setUser(userData);
    syncPendingData().catch(console.error);
  };

  const logout = () => {
    wpLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    if (checkAuth()) {
      try {
        const currentUser = await getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        console.error('Failed to refresh user:', error);
        logout();
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};