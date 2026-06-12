import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Pill, Plus, Search, Upload, Download, FileSpreadsheet, History, IndianRupee,
  Boxes, Pencil, Trash2, Loader2, AlertTriangle, MoreHorizontal, ShieldCheck, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";
import { inr } from "@/lib/api";

const PAGE_SIZE = 25;

export default function MedicineList() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [rxFilter, setRxFilter] = useState("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  // Bulk modal
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMode, setBulkMode] = useState("price"); // 'price' | 'stock'
  const [bulkKey, setBulkKey] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const openBulk = (mode) => {
    setBulkMode(mode);
    setBulkKey((k) => k + 1);
    setBulkOpen(true);
  };

  // Load categories once.
  useEffect(() => {
    adminApi.categories().then(setCategories).catch(() => {});
    adminApi.medicines.stats().then(setStats).catch(() => {});
  }, []);

  // Build params memoised so we can reuse them for export URLs.
  const params = useMemo(() => {
    const p = { page, page_size: PAGE_SIZE };
    if (q) p.q = q;
    if (categoryFilter !== "all") p.category = categoryFilter;
    if (activeFilter !== "all") p.is_active = activeFilter === "active";
    if (rxFilter !== "all") p.prescription_required = rxFilter === "rx";
    if (lowStockOnly) p.low_stock = true;
    return p;
  }, [q, categoryFilter, activeFilter, rxFilter, lowStockOnly, page]);

  const reload = () => {
    setLoading(true);
    setSelectedIds(new Set());
    adminApi.medicines
      .list(params)
      .then((r) => {
        setItems(r.items || []);
        setTotal(r.total || 0);
      })
      .catch((err) => showApiError(err, "Failed to load medicines"))
      .finally(() => setLoading(false));
    adminApi.medicines.stats().then(setStats).catch(() => {});
  };

  useEffect(reload, [params]); // eslint-disable-line

  // ---- Selection helpers ----
  const allOnPageSelected = items.length > 0 && items.every((m) => selectedIds.has(m.id));
  const toggleAllOnPage = () => {
    const next = new Set(selectedIds);
    if (allOnPageSelected) items.forEach((m) => next.delete(m.id));
    else items.forEach((m) => next.add(m.id));
    setSelectedIds(next);
  };
  const toggleOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ---- Actions ----
  const handleDelete = async (item, hard = false) => {
    try {
      await adminApi.medicines.remove(item.id, hard);
      toast.success(hard ? "Medicine permanently deleted" : "Medicine deactivated");
      setDeleteTarget(null);
      reload();
    } catch (err) {
      showApiError(err, "Delete failed");
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl" data-testid="admin-medicine-list">
      <Header stats={stats} />

      {/* Action bar */}
      <Card className="mt-6 rounded-3xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => navigate("/admin/medicines/new")}
              className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
              data-testid="med-new"
            >
              <Plus className="mr-1.5 h-4 w-4" /> New medicine
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate("/admin/medicines/import")}
              className="rounded-full"
              data-testid="med-import"
            >
              <Upload className="mr-1.5 h-4 w-4" /> Import
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full" data-testid="med-export">
                  <Download className="mr-1.5 h-4 w-4" /> Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Current filter</DropdownMenuLabel>
                <DropdownMenuItem asChild>
                  <a
                    href={adminApi.exports.xlsxUrl({
                      q, category: categoryFilter !== "all" ? categoryFilter : undefined,
                      is_active: activeFilter === "all" ? undefined : activeFilter === "active",
                      prescription_required: rxFilter === "all" ? undefined : rxFilter === "rx",
                    })}
                    data-testid="med-export-xlsx"
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" /> Excel (.xlsx)
                  </a>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a
                    href={adminApi.exports.csvUrl({
                      q, category: categoryFilter !== "all" ? categoryFilter : undefined,
                      is_active: activeFilter === "all" ? undefined : activeFilter === "active",
                      prescription_required: rxFilter === "all" ? undefined : rxFilter === "rx",
                    })}
                    data-testid="med-export-csv"
                  >
                    <Download className="mr-2 h-4 w-4" /> CSV (.csv)
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => openBulk("price")}
              data-testid="med-bulk-price"
            >
              <IndianRupee className="mr-1.5 h-4 w-4" /> Bulk price
            </Button>
            <Button
              variant="outline"
              className="rounded-full"
              onClick={() => openBulk("stock")}
              data-testid="med-bulk-stock"
            >
              <Boxes className="mr-1.5 h-4 w-4" /> Bulk stock
            </Button>
            <Button
              variant="ghost"
              className="rounded-full"
              onClick={() => navigate("/admin/medicines/jobs")}
              data-testid="med-import-jobs"
            >
              <History className="mr-1.5 h-4 w-4" /> Import history
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="mt-4 rounded-3xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <form
            className="flex flex-1 items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setPage(1); setQ(qDraft); }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                placeholder="Search by name, composition, SKU, brand…"
                className="rounded-full pl-9"
                data-testid="med-search-input"
              />
            </div>
            <Button type="submit" className="rounded-full bg-[#0F4C3A] text-white" data-testid="med-search-submit">
              Search
            </Button>
          </form>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setPage(1); }}>
              <SelectTrigger className="w-44 rounded-full" data-testid="med-filter-category">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={activeFilter} onValueChange={(v) => { setActiveFilter(v); setPage(1); }}>
              <SelectTrigger className="w-32 rounded-full" data-testid="med-filter-active">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
            <Select value={rxFilter} onValueChange={(v) => { setRxFilter(v); setPage(1); }}>
              <SelectTrigger className="w-36 rounded-full" data-testid="med-filter-rx">
                <SelectValue placeholder="Prescription" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="rx">Rx only</SelectItem>
                <SelectItem value="otc">OTC only</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5">
              <Switch
                checked={lowStockOnly}
                onCheckedChange={(v) => { setLowStockOnly(v); setPage(1); }}
                data-testid="med-filter-lowstock"
              />
              <Label className="cursor-pointer text-xs">Low stock</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card className="mt-4 overflow-hidden rounded-3xl">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm" data-testid="med-table">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">
                    <Checkbox
                      checked={allOnPageSelected}
                      onCheckedChange={toggleAllOnPage}
                      data-testid="med-row-select-all"
                    />
                  </th>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3 text-right">Price</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                )}
                {!loading && items.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-muted-foreground">
                      No medicines match your filters.
                    </td>
                  </tr>
                )}
                {!loading && items.map((m) => (
                  <tr key={m.id} className="border-t border-border" data-testid={`med-row-${m.id}`}>
                    <td className="px-4 py-3">
                      <Checkbox
                        checked={selectedIds.has(m.id)}
                        onCheckedChange={() => toggleOne(m.id)}
                        data-testid={`med-row-select-${m.id}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-muted">
                          {m.image || (m.images && m.images[0]) ? (
                            <img
                              src={m.image || m.images[0]}
                              alt={m.name}
                              className="h-full w-full object-cover"
                              loading="lazy"
                              onError={(e) => { e.currentTarget.style.display = "none"; }}
                            />
                          ) : null}
                        </div>
                        <div className="min-w-0">
                          <Link
                            to={`/admin/medicines/${m.id}/edit`}
                            className="truncate font-semibold text-foreground hover:text-[#0F4C3A]"
                          >
                            {m.name}
                          </Link>
                          <div className="truncate text-xs text-muted-foreground">
                            {m.composition}{m.brand ? ` · ${m.brand}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{m.category}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="font-semibold">{inr(m.price)}</div>
                      {m.mrp && m.mrp !== m.price && (
                        <div className="text-xs text-muted-foreground line-through">{inr(m.mrp)}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className={
                          (m.stock ?? 0) <= 0
                            ? "font-semibold text-rose-600"
                            : (m.stock ?? 0) <= 10
                            ? "font-semibold text-amber-600"
                            : "font-semibold"
                        }
                      >
                        {m.stock ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {m.prescription_required ? (
                        <Badge className="rounded-full bg-rose-100 text-rose-700 hover:bg-rose-100">Rx</Badge>
                      ) : (
                        <Badge className="rounded-full bg-emerald-100 text-emerald-700 hover:bg-emerald-100">OTC</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {m.is_active === false ? (
                        <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">Inactive</Badge>
                      ) : (
                        <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">Active</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`med-row-actions-${m.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/medicines/${m.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/medicines/${m.id}`} target="_blank" rel="noreferrer">
                              <Eye className="mr-2 h-4 w-4" /> View on storefront
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-rose-600 focus:text-rose-700"
                            onClick={() => setDeleteTarget(m)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Delete…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col items-center justify-between gap-3 border-t border-border bg-muted/30 px-4 py-3 md:flex-row">
            <div className="text-xs text-muted-foreground">
              {selectedIds.size > 0
                ? `${selectedIds.size} selected · `
                : ""}
              {total} medicine{total === 1 ? "" : "s"} · page {page} / {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                data-testid="med-page-prev"
              >Previous</Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
                data-testid="med-page-next"
              >Next</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk modal */}
      <BulkDialog
        key={bulkKey}
        open={bulkOpen}
        mode={bulkMode}
        onClose={() => setBulkOpen(false)}
        selectedIds={[...selectedIds]}
        categoryFilter={categoryFilter}
        categories={categories}
        onDone={reload}
      />

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="med-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete medicine?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong>
              <br />Choose how to delete — &quot;Deactivate&quot; hides it from the
              storefront but keeps the record. &quot;Permanently delete&quot; cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button
              variant="outline"
              onClick={() => handleDelete(deleteTarget, false)}
              data-testid="med-delete-soft"
            >
              Deactivate
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleDelete(deleteTarget, true)}
              data-testid="med-delete-hard"
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ----- Header --------------------------------------------------------------

const Header = ({ stats }) => (
  <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
    <div>
      <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
        <Pill className="mr-1.5 h-3 w-3" /> Catalog
      </Badge>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Medicines</h1>
      <p className="text-sm text-muted-foreground">
        Manage your medicine catalog. Changes reflect on the storefront instantly.
      </p>
    </div>
    {stats && (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={stats.total} />
        <Stat label="Active" value={stats.active} accent />
        <Stat label="Low stock" value={stats.low_stock} warn />
        <Stat label="Rx only" value={stats.rx_only} />
      </div>
    )}
  </div>
);

const Stat = ({ label, value, accent, warn }) => (
  <div
    className={`rounded-2xl border px-4 py-3 ${
      accent ? "border-[#0F4C3A]/30 bg-[#0F4C3A]/5" : warn ? "border-amber-300/50 bg-amber-50" : "border-border bg-card"
    }`}
  >
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display text-xl font-bold">{value ?? "—"}</div>
  </div>
);

// ----- Bulk dialog (price + stock) -----------------------------------------

function BulkDialog({ open, mode, onClose, selectedIds, categoryFilter, categories, onDone }) {
  const isPrice = mode === "price";
  const [scope, setScope] = useState(
    selectedIds.length > 0 ? "selected" : (categoryFilter !== "all" ? "category" : "all")
  );
  const [scopeCategory, setScopeCategory] = useState(categoryFilter !== "all" ? categoryFilter : (categories[0]?.id || ""));
  const [target, setTarget] = useState("price");
  const [opMode, setOpMode] = useState(isPrice ? "percent" : "set");
  const [value, setValue] = useState(isPrice ? "10" : "50");
  const [busy, setBusy] = useState(false);
  const [onlyActive, setOnlyActive] = useState(true);

  const submit = async () => {
    const body = {
      only_active: onlyActive,
      mode: opMode,
      value: Number(value),
    };
    if (scope === "selected") body.ids = selectedIds;
    if (scope === "category") body.category = scopeCategory;
    if (isPrice) body.target = target;
    setBusy(true);
    try {
      const r = isPrice ? await adminApi.medicines.bulkPrice(body) : await adminApi.medicines.bulkStock(body);
      toast.success(`Updated ${r.updated}/${r.matched} medicines`);
      onClose();
      onDone?.();
    } catch (err) {
      showApiError(err, "Bulk update failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md" data-testid="med-bulk-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isPrice ? <IndianRupee className="h-5 w-5 text-[#0F4C3A]" /> : <Boxes className="h-5 w-5 text-[#0F4C3A]" />}
            Bulk {isPrice ? "price" : "stock"} update
          </DialogTitle>
          <DialogDescription>
            Apply changes to many medicines at once. Operations are logged in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Scope</Label>
            <Select value={scope} onValueChange={setScope}>
              <SelectTrigger className="mt-1.5" data-testid="bulk-scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="selected" disabled={!selectedIds.length}>
                  Selected rows ({selectedIds.length})
                </SelectItem>
                <SelectItem value="category">By category</SelectItem>
                <SelectItem value="all">All active medicines</SelectItem>
              </SelectContent>
            </Select>
            {scope === "category" && (
              <Select value={scopeCategory} onValueChange={setScopeCategory}>
                <SelectTrigger className="mt-2" data-testid="bulk-scope-category"><SelectValue placeholder="Pick category" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          {isPrice && (
            <div>
              <Label>Field</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="mt-1.5" data-testid="bulk-target"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="price">Selling price</SelectItem>
                  <SelectItem value="mrp">MRP</SelectItem>
                  <SelectItem value="discount_pct">Discount %</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Operation</Label>
              <Select value={opMode} onValueChange={setOpMode}>
                <SelectTrigger className="mt-1.5" data-testid="bulk-mode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {isPrice ? (
                    <>
                      <SelectItem value="percent">Adjust by % (e.g. -10)</SelectItem>
                      <SelectItem value="fixed">Add/subtract value</SelectItem>
                      <SelectItem value="set">Set exact value</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="set">Set stock to</SelectItem>
                      <SelectItem value="delta">Add/subtract delta</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                type="number"
                step={isPrice ? "0.01" : "1"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="mt-1.5"
                data-testid="bulk-value"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={onlyActive} onCheckedChange={setOnlyActive} data-testid="bulk-onlyactive" />
            <Label className="cursor-pointer text-sm">Only apply to active medicines</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            onClick={submit}
            disabled={busy || value === ""}
            className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
            data-testid="bulk-submit"
          >
            {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-1.5 h-4 w-4" />}
            Apply update
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
