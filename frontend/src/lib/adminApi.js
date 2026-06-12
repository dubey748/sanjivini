import { api } from "@/lib/api";
import { toast } from "sonner";

const formatErr = (err, fallback = "Something went wrong") => {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
};

export const showApiError = (err, fallback) => {
  toast.error(formatErr(err, fallback));
};

// Build a full URL for raw fetch (needed for blob downloads since axios is
// configured with the /api base).
const rawBase = () => {
  const root = process.env.REACT_APP_BACKEND_URL || "";
  return `${root}/api`;
};

export const adminApi = {
  // ---- Phase 1 ----
  whoami: () => api.get("/admin/whoami").then((r) => r.data),
  health: () => api.get("/admin/health").then((r) => r.data),
  stats: () => api.get("/admin/stats").then((r) => r.data),
  orders: () => api.get("/admin/orders").then((r) => r.data),
  users: () => api.get("/admin/users").then((r) => r.data),

  // ---- Phase 2 — Medicines CRUD ----
  medicines: {
    list: (params = {}) => api.get("/admin/cms/medicines", { params }).then((r) => r.data),
    stats: () => api.get("/admin/cms/medicines/stats").then((r) => r.data),
    get: (id) => api.get(`/admin/cms/medicines/${id}`).then((r) => r.data),
    create: (body) => api.post("/admin/cms/medicines", body).then((r) => r.data),
    update: (id, body) => api.put(`/admin/cms/medicines/${id}`, body).then((r) => r.data),
    remove: (id, hard = false) =>
      api.delete(`/admin/cms/medicines/${id}`, { params: { hard } }).then((r) => r.data),
    bulkPrice: (body) => api.post("/admin/cms/medicines/bulk/price", body).then((r) => r.data),
    bulkStock: (body) => api.post("/admin/cms/medicines/bulk/stock", body).then((r) => r.data),
  },

  // ---- Phase 2 — Imports & Exports ----
  imports: {
    schema: () => api.get("/admin/imports/medicines/schema").then((r) => r.data),
    templateUrl: () => `${rawBase()}/admin/imports/medicines/template`,
    list: () => api.get("/admin/imports/medicines").then((r) => r.data),
    get: (jobId) => api.get(`/admin/imports/medicines/${jobId}`).then((r) => r.data),
    dryRun: (file) => {
      const fd = new FormData();
      fd.append("file", file);
      return api
        .post("/admin/imports/medicines/dry-run", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        })
        .then((r) => r.data);
    },
    commit: (file, opts = {}) => {
      const fd = new FormData();
      fd.append("file", file);
      return api
        .post("/admin/imports/medicines/commit", fd, {
          headers: { "Content-Type": "multipart/form-data" },
          params: { skip_errors: opts.skipErrors ?? true },
        })
        .then((r) => r.data);
    },
  },
  exports: {
    xlsxUrl: (params = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
      ).toString();
      return `${rawBase()}/admin/exports/medicines.xlsx${qs ? `?${qs}` : ""}`;
    },
    csvUrl: (params = {}) => {
      const qs = new URLSearchParams(
        Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
      ).toString();
      return `${rawBase()}/admin/exports/medicines.csv${qs ? `?${qs}` : ""}`;
    },
  },

  // ---- Public ref data (categories used by the admin form) ----
  categories: () => api.get("/categories").then((r) => r.data),
};
