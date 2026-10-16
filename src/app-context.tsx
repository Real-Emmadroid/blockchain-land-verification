import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, setUnauthorizedHandler, tokenStore } from "./lib/api";
import type { AppConfig, SessionUser } from "./lib/types";

interface AuthValue {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<SessionUser>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);
const ConfigContext = createContext<AppConfig | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(Boolean(tokenStore.get()));
  const [config, setConfig] = useState<AppConfig | null>(null);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.config().then(setConfig).catch(() => setConfig(null));
    if (tokenStore.get()) {
      api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false));
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
    tokenStore.set(res.token);
    setUser(res.user);
    return res.user;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);
  return (
    <AuthContext.Provider value={value}>
      <ConfigContext.Provider value={config}>{children}</ConfigContext.Provider>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const v = useContext(AuthContext);
  if (!v) throw new Error("useAuth must be used inside AppProvider");
  return v;
}

export const useConfig = () => useContext(ConfigContext);
