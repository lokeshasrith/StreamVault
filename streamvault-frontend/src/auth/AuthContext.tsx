import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getMe as apiGetMe, login as apiLogin, register as apiRegister } from "../api/authApi";
import type { LoginDto, RegisterDto } from "../api/authApi";
import type { AuthUserProfile } from "../api/authApi";

type AuthContextType = {
  token: string | null;
  userKey: string | null;
  profile: AuthUserProfile | null;
  isAuthenticated: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

const STORAGE_KEY = "streamvault_jwt";
const USER_KEY_STORAGE = "streamvault_user_key";
const USER_PROFILE_STORAGE = "streamvault_user_profile";

function readStoredProfile(): AuthUserProfile | null {
  const raw = localStorage.getItem(USER_PROFILE_STORAGE);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as AuthUserProfile;
  } catch {
    localStorage.removeItem(USER_PROFILE_STORAGE);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [userKey, setUserKey] = useState<string | null>(() => localStorage.getItem(USER_KEY_STORAGE));
  const [profile, setProfile] = useState<AuthUserProfile | null>(() => readStoredProfile());

  const clearAuthState = () => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY_STORAGE);
    localStorage.removeItem(USER_PROFILE_STORAGE);
    setToken(null);
    setUserKey(null);
    setProfile(null);
  };

  const login = async (dto: LoginDto) => {
    const { token, userKey, user } = await apiLogin(dto);
    localStorage.setItem(STORAGE_KEY, token);
    localStorage.setItem(USER_KEY_STORAGE, userKey);
    if (user) {
      localStorage.setItem(USER_PROFILE_STORAGE, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_PROFILE_STORAGE);
    }

    setToken(token);
    setUserKey(userKey);
    setProfile(user ?? null);
  };

  const register = async (dto: RegisterDto) => {
    await apiRegister(dto);
  };

  const logout = () => {
    clearAuthState();
  };

  useEffect(() => {
    if (!token || userKey) return;

    let cancelled = false;

    const hydrateIdentity = async () => {
      try {
        const me = await apiGetMe(token);
        if (cancelled) return;

        localStorage.setItem(USER_KEY_STORAGE, me.userKey);
        const hydratedProfile: AuthUserProfile = {
          email: me.email,
          displayName: me.displayName
        };
        localStorage.setItem(USER_PROFILE_STORAGE, JSON.stringify(hydratedProfile));
        setUserKey(me.userKey);
        setProfile(hydratedProfile);
      } catch {
        if (cancelled) return;
        clearAuthState();
      }
    };

    hydrateIdentity();
    return () => { cancelled = true; };
  }, [token, userKey]);

  // Listen for 401 events from the http layer
  useEffect(() => {
    const onExpired = () => clearAuthState();
    window.addEventListener("auth-expired", onExpired);
    return () => window.removeEventListener("auth-expired", onExpired);
  }, []);

  const value = useMemo(() => ({
    token,
    userKey,
    profile,
    isAuthenticated: !!token,
    login, register, logout
  }), [token, userKey, profile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}