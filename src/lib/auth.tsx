"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { api, setUnauthorizedHandler, tokens } from "./api";
import type { Me, Role } from "./types";

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  data: { id: number; name: string; email: string; role: Role };
}

interface AuthState {
  user: Me | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<Me>;
  logout: (callServer?: boolean) => Promise<void>;
  reload: () => Promise<void>;
  isAdmin: boolean;
  isStaff: boolean; // admin ຫຼື staff
  isStudent: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!tokens.access && !tokens.refresh) {
      setUser(null);
      return;
    }
    try {
      const res = await api.get<{ data: Me }>("/auth/me");
      setUser(res.data);
    } catch {
      tokens.clear();
      setUser(null);
    }
  }, []);

  const clearSession = useCallback(() => {
    tokens.clear();
    setUser(null);
    // ລ້າງ cache ຂໍ້ມູນທັງໝົດ ກັນຜູ້ໃຊ້ຄົນຕໍ່ໄປເຫັນຂໍ້ມູນເກົ່າ
    void mutate(() => true, undefined, { revalidate: false });
  }, []);

  useEffect(() => {
    loadMe().finally(() => setLoading(false));
  }, [loadMe]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      router.replace("/login?expired=1");
    });
    return () => setUnauthorizedHandler(null);
  }, [clearSession, router]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post<LoginResponse>("/auth/login", { email, password });
    tokens.set(res.accessToken, res.refreshToken);
    const me = await api.get<{ data: Me }>("/auth/me");
    setUser(me.data);
    return me.data;
  }, []);

  const logout = useCallback(
    async (callServer = true) => {
      const refresh = tokens.refresh;
      if (callServer && refresh) {
        try {
          await api.post("/auth/logout", { refreshToken: refresh });
        } catch {
          /* ignore */
        }
      }
      clearSession();
      router.replace("/login");
    },
    [clearSession, router]
  );

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      login,
      logout,
      reload: loadMe,
      isAdmin: user?.role === "admin",
      isStaff: user?.role === "admin" || user?.role === "staff",
      isStudent: user?.role === "student",
    }),
    [user, loading, login, logout, loadMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth ຕ້ອງໃຊ້ພາຍໃນ <AuthProvider>");
  return ctx;
}
