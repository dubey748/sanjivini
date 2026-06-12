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

  // ---- Phase 3 — Categories + Subcategories ----
  cmsCategories: {
    list: (params = {}) => api.get("/admin/cms/categories", { params }).then((r) => r.data),
    tree: () => api.get("/admin/cms/categories/tree").then((r) => r.data),
    get: (id) => api.get(`/admin/cms/categories/${id}`).then((r) => r.data),
    create: (body) => api.post("/admin/cms/categories", body).then((r) => r.data),
    update: (id, body) => api.put(`/admin/cms/categories/${id}`, body).then((r) => r.data),
    remove: (id, hard = false) =>
      api.delete(`/admin/cms/categories/${id}`, { params: { hard } }).then((r) => r.data),
    reorder: (ids) => api.post("/admin/cms/categories/reorder", { ids }).then((r) => r.data),
  },

  // ---- Phase 3 — Brands ----
  cmsBrands: {
    list: (params = {}) => api.get("/admin/cms/brands", { params }).then((r) => r.data),
    get: (id) => api.get(`/admin/cms/brands/${id}`).then((r) => r.data),
    create: (body) => api.post("/admin/cms/brands", body).then((r) => r.data),
    update: (id, body) => api.put(`/admin/cms/brands/${id}`, body).then((r) => r.data),
    remove: (id, hard = false) =>
      api.delete(`/admin/cms/brands/${id}`, { params: { hard } }).then((r) => r.data),
  },

  // ---- Phase 3 — Banners ----
  cmsBanners: {
    list: (params = {}) => api.get("/admin/cms/banners", { params }).then((r) => r.data),
    get: (id) => api.get(`/admin/cms/banners/${id}`).then((r) => r.data),
    create: (body) => api.post("/admin/cms/banners", body).then((r) => r.data),
    update: (id, body) => api.put(`/admin/cms/banners/${id}`, body).then((r) => r.data),
    remove: (id, hard = false) =>
      api.delete(`/admin/cms/banners/${id}`, { params: { hard } }).then((r) => r.data),
  },

  // ---- Phase 3 — Homepage CMS ----
  cmsHomepage: {
    list: () => api.get("/admin/cms/homepage").then((r) => r.data),
    get: (id) => api.get(`/admin/cms/homepage/${id}`).then((r) => r.data),
    create: (body) => api.post("/admin/cms/homepage", body).then((r) => r.data),
    update: (id, body) => api.put(`/admin/cms/homepage/${id}`, body).then((r) => r.data),
    remove: (id, hard = false) =>
      api.delete(`/admin/cms/homepage/${id}`, { params: { hard } }).then((r) => r.data),
    reorder: (ids) => api.post("/admin/cms/homepage/reorder", { ids }).then((r) => r.data),
  },

  // ---- Public ref data (read-only) ----
  categories: () => api.get("/categories").then((r) => r.data),
};
