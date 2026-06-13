import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store, Plus, Pencil, Trash2, Loader2, AlertTriangle, MoreHorizontal,
  CheckCircle2, XCircle, Package as PackageIcon, Clock, MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending approval" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

const fmtTime = (h) => h?.closed ? "Closed" : `${h?.open || "—"} – ${h?.close || "—"}`;

export default function PharmacyList() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const reload = () => {
    setItems(null);
    adminApi.cmsPharmacies.list({
      q: q || undefined,
      approval_status: filter === "all" ? undefined : filter,
    }).then((r) => setItems(r.items || [])).catch((err) => {
      setItems([]); showApiError(err);
    });
    adminApi.cmsPharmacies.stats().then(setStats).catch(() => {});
  };
  useEffect(reload, [filter, q]); // eslint-disable-line

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsPharmacies.remove(item.id, hard);
      toast.success(hard ? "Permanently deleted" : "Deactivated");
      setDeleteTarget(null);
      reload();
    } catch (err) { showApiError(err); }
  };

  const handleApproval = async (item, decision) => {
    try {
      await adminApi.cmsPharmacies.approval(item.id, decision, null);
      toast.success(decision === "approve" ? "Approved" : "Rejected");
      reload();
    } catch (err) { showApiError(err); }
  };

  const handleReject = async () => {
    try {
      await adminApi.cmsPharmacies.approval(rejectTarget.id, "reject", rejectReason);
      toast.success("Pharmacy rejected");
      setRejectTarget(null);
      setRejectReason("");
      reload();
    } catch (err) { showApiError(err); }
  };

  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-pharmacy-list">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <Store className="mr-1.5 h-3 w-3" /> Operations
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Pharmacies</h1>
          <p className="text-sm text-muted-foreground">
            Add and manage pharmacy stores, approval workflow, and operating details.
          </p>
        </div>
        <Button
          onClick={() => navigate("/admin/pharmacies/new")}
          className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
          data-testid="pharm-new"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New pharmacy
        </Button>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-4 md:grid-cols-5" data-testid="pharm-stats">
        <StatCard label="Total" value={stats?.total ?? "—"} />
        <StatCard label="Approved" value={stats?.approved ?? "—"} accent="emerald" />
        <StatCard label="Pending" value={stats?.pending ?? "—"} accent="amber" />
        <StatCard label="Rejected" value={stats?.rejected ?? "—"} accent="rose" />
        <StatCard label="Active" value={stats?.active ?? "—"} />
      </div>

      {/* Filters */}
      <Card className="mt-4 rounded-3xl">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center">
          <form className="flex flex-1 items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setQ(qDraft); }}>
            <Input
              value={qDraft} onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search name / phone / pincode" className="rounded-full"
              data-testid="pharm-search-input"
            />
            <Button type="submit" className="rounded-full bg-[#0F4C3A] text-white" data-testid="pharm-search-submit">
              Search
            </Button>
          </form>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-56 rounded-full" data-testid="pharm-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {items && items.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No pharmacies found.</div>
          )}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="pharm-table">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Pharmacy</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Hours (Mon)</th>
                  <th className="px-4 py-3">Approval</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-border" data-testid={`pharm-row-${p.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{p.name}</div>
                      <div className="text-[11px] text-muted-foreground">
                        <code className="rounded bg-muted px-1 py-0.5">{p.id}</code>
                        {p.phone ? ` · ${p.phone}` : ""}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="inline-flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {p.city || "—"}{p.pincode ? ` · ${p.pincode}` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">radius {p.delivery_radius_km ?? 5} km</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {fmtTime(p.operating_hours?.mon)}
                    </td>
                    <td className="px-4 py-3">
                      {p.approval_status === "approved" && (
                        <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Approved</Badge>
                      )}
                      {p.approval_status === "pending" && (
                        <Badge className="rounded-full bg-amber-500/20 text-amber-700 hover:bg-amber-500/20">Pending</Badge>
                      )}
                      {p.approval_status === "rejected" && (
                        <Badge className="rounded-full bg-rose-500/20 text-rose-700 hover:bg-rose-500/20">Rejected</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {p.is_active
                        ? <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">Active</Badge>
                        : <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">Inactive</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {p.approval_status === "pending" && (
                          <>
                            <Button size="sm" variant="outline" className="rounded-full text-xs"
                              onClick={() => handleApproval(p, "approve")}
                              data-testid={`pharm-approve-${p.id}`}>
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-full text-xs text-rose-600"
                              onClick={() => setRejectTarget(p)}
                              data-testid={`pharm-reject-${p.id}`}>
                              <XCircle className="mr-1 h-3 w-3" /> Reject
                            </Button>
                          </>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`pharm-actions-${p.id}`}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => navigate(`/admin/pharmacies/${p.id}/edit`)}>
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => navigate(`/admin/pharmacies/${p.id}/inventory`)}>
                              <PackageIcon className="mr-2 h-4 w-4" /> Inventory
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => setDeleteTarget(p)}>
                              <Trash2 className="mr-2 h-4 w-4" /> Delete…
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Delete dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="pharm-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete pharmacy?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong>
              <br />Deactivate hides it from order routing. Permanently delete only if no orders reference it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)} data-testid="pharm-delete-soft">Deactivate</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => handleDelete(deleteTarget, true)} data-testid="pharm-delete-hard">
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent data-testid="pharm-reject-dialog">
          <DialogHeader>
            <DialogTitle>Reject pharmacy</DialogTitle>
            <DialogDescription>
              Reason will be stored on the record and the pharmacy will be set inactive.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Drug license expired"
            data-testid="pharm-reject-reason"
          />
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRejectTarget(null)}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={handleReject} data-testid="pharm-reject-confirm">
              Reject pharmacy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const StatCard = ({ label, value, accent }) => {
  const color = accent === "emerald" ? "text-emerald-600"
    : accent === "amber" ? "text-amber-600"
    : accent === "rose" ? "text-rose-600" : "text-[#0F4C3A]";
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
      </CardContent>
    </Card>
  );
};
