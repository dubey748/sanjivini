import { api } from "@/lib/api";
import { toast } from "sonner";

// Thin wrapper around the existing axios instance. Auto-prefixes /admin
// and surfaces backend error messages via the existing toaster.
const formatErr = (err, fallback = "Something went wrong") => {
  const detail = err?.response?.data?.detail;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
};

export const adminApi = {
  whoami: () => api.get("/admin/whoami").then((r) => r.data),
  health: () => api.get("/admin/health").then((r) => r.data),
  stats: () => api.get("/admin/stats").then((r) => r.data),
  orders: () => api.get("/admin/orders").then((r) => r.data),
  users: () => api.get("/admin/users").then((r) => r.data),
};

export const showApiError = (err, fallback) => {
  toast.error(formatErr(err, fallback));
};
