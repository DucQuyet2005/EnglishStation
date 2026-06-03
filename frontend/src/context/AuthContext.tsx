/**
 * AuthContext
 * Provides global authentication state and actions throughout the app.
 */
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, AuthUser } from '../api/auth';

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  googleLogin: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = 'es_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (stored) {
      setToken(stored);
      authApi.getMe(stored).then((res: any) => {
        if (res?.data?.user) setUser(res.data.user);
        else localStorage.removeItem(TOKEN_KEY);
      }).catch(() => localStorage.removeItem(TOKEN_KEY))
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  function persist(t: string, u: AuthUser) {
    localStorage.setItem(TOKEN_KEY, t);
    setToken(t);
    setUser(u);
  }

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    persist(res.token, res.user);
  };

  const register = async (email: string, password: string, fullName?: string) => {
    const res = await authApi.register(email, password, fullName);
    persist(res.token, res.user);
  };

  const googleLogin = async (idToken: string) => {
    const res = await authApi.googleAuth(idToken);
    persist(res.token, res.user);
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
