import React, { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setUser(data);
    return data;
  };
  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setUser(data);
    return data;
  };
  const otpRequest = async (phone) => (await api.post("/auth/otp/request", { phone })).data;
  const otpVerify = async (phone, otp, name) => {
    const { data } = await api.post("/auth/otp/verify", { phone, otp, name });
    setUser(data);
    return data;
  };
  const logout = async () => {
    await api.post("/auth/logout");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, otpRequest, otpVerify, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
