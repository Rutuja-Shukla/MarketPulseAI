import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, getToken, setToken } from "@/lib/api";
import type { AuthResponse, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: { email: string; password: string; full_name: string; company_name?: string }) => Promise<void>;
  demoLogin: () => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<User>("/auth/me");
      setUser(me);
    } catch {
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const applyAuth = useCallback((response: AuthResponse) => {
    setToken(response.access_token);
    setUser(response.user);
    setError(null);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const response = await api.post<AuthResponse>("/auth/login", { email, password });
        applyAuth(response);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Sign in failed");
        throw err;
      }
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: { email: string; password: string; full_name: string; company_name?: string }) => {
      setError(null);
      try {
        const response = await api.post<AuthResponse>("/auth/register", input);
        applyAuth(response);
      } catch (err) {
        setError(err instanceof ApiError ? err.detail : "Registration failed");
        throw err;
      }
    },
    [applyAuth],
  );

  const demoLogin = useCallback(async () => {
    setError(null);
    try {
      const response = await api.post<AuthResponse>("/auth/demo");
      applyAuth(response);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Demonstration access is unavailable");
      throw err;
    }
  }, [applyAuth]);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, error, login, register, demoLogin, logout, refresh }),
    [user, loading, error, login, register, demoLogin, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
