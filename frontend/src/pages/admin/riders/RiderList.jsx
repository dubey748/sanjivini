import React, { useEffect, useState } from "react";
import {
  Truck, Plus, Pencil, Trash2, Loader2, AlertTriangle, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const STATUS_PILL = {
  available: "bg-emerald-500/15 text-emerald-700",
  on_delivery: "bg-blue-500/15 text-blue-700",
  offline: "bg-muted text-muted-foreground",
};

export default function RiderList() {
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignments, setAssignments] = useState(null);
  const [showAssign, setShowAssign] = useState(false);

  const reload = () => {
    setItems(null);
    adminApi.cmsRiders.list({ q: q || undefined })
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err); });
  };
  useEffect(reload, [q]); // eslint-disable-line

  useEffect(() => {
    if (showAssign) adminApi.cmsRiders.assignments().then((r) => setAssignments(r.items || [])).catch(() => {});
  }, [showAssign]);

  const handleSave = async (b) => {
    try {
      if (b.id) await adminApi.cmsRiders.update(b.id, b);
      else await adminApi.cmsRiders.create(b);
      toast.success(b.id ? "Updated" : "Created");
      setEditing(null); reload();
    } catch (err) { showApiError(err); }
  };

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsRiders.remove(item.id, hard);
      toast.success("Done");
      setDeleteTarget(null); reload();
    } catch (err) { showApiError(err); }
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-rider-list">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <Truck className="mr-1.5 h-3 w-3" /> Operations
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Riders</h1>
          <p className="text-sm text-muted-foreground">
            Maintain delivery rider records. Manual assignment happens from each order.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full"
            onClick={() => setShowAssign(true)} data-testid="rider-assignments-open">
            Assignment history
          </Button>
          <Button
            onClick={() => setEditing({ name: "", phone: "", vehicle_no: "", license_no: "", is_active: true, current_status: "available" })}
            className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
            data-testid="rider-new"
          >
            <Plus className="mr-1.5 h-4 w-4" /> New rider
          </Button>
        </div>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="p-4">
          <form className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setQ(qDraft); }}>
            <Input value={qDraft} onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search name / phone / vehicle" className="rounded-full" data-testid="rider-search-input" />
            <Button type="submit" className="rounded-full bg-[#0F4C3A] text-white" data-testid="rider-search-submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {items && items.length === 0 && <div className="p-10 text-center text-muted-foreground">No riders.</div>}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="rider-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Rider</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Vehicle</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Active runs</th><th className="px-4 py-3">Active</th><th /></tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className="border-t border-border" data-testid={`rider-row-${r.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.name}</div>
                      <div className="text-[10px] text-muted-foreground"><code className="rounded bg-muted px-1 py-0.5">{r.id}</code> · {r.license_no || "no licence"}</div>
                    </td>
                    <td className="px-4 py-3 text-xs">{r.phone}</td>
                    <td className="px-4 py-3 text-xs">{r.vehicle_no || "—"}</td>
                    <td className="px-4 py-3"><Badge className={`rounded-full ${STATUS_PILL[r.current_status] || "bg-muted text-muted-foreground"} hover:${STATUS_PILL[r.current_status] || ""}`}>{r.current_status}</Badge></td>
                    <td className="px-4 py-3 text-right text-xs">{r.active_assignments || 0}</td>
                    <td className="px-4 py-3 text-xs">{r.is_active ? "✓" : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`rider-actions-${r.id}`}><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditing(r)}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => setDeleteTarget(r)}><Trash2 className="mr-2 h-4 w-4" /> Delete…</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <RiderEditor open={!!editing} rider={editing} onCancel={() => setEditing(null)} onSave={handleSave} key={editing?.id || (editing ? "new-rider" : "closed-rider")} />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="rider-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Delete rider?</DialogTitle>
            <DialogDescription><strong>{deleteTarget?.name}</strong> — deactivate first if any history exists.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)}>Deactivate</Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => handleDelete(deleteTarget, true)}>Permanently delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssign} onOpenChange={(o) => !o && setShowAssign(false)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto" data-testid="rider-assignments-dialog">
          <DialogHeader><DialogTitle>Assignment history</DialogTitle></DialogHeader>
          {assignments === null && <div className="flex h-32 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {assignments && assignments.length === 0 && <div className="p-6 text-center text-muted-foreground">No assignments yet.</div>}
          {assignments && assignments.length > 0 && (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Order</th><th className="px-3 py-2">Rider</th><th className="px-3 py-2">By</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-t border-border">
                    <td className="px-3 py-2 text-[11px]">{new Date(a.assigned_at).toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.order_id}</td>
                    <td className="px-3 py-2 font-mono text-xs">{a.rider_id}</td>
                    <td className="px-3 py-2 text-xs">{a.assigned_by_email || "—"}</td>
                    <td className="px-3 py-2 text-xs">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RiderEditor({ open, rider, onCancel, onSave }) {
  const [form, setForm] = useState(rider || {});
  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="rider-editor">
        <DialogHeader><DialogTitle>{form.id ? "Edit rider" : "New rider"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Name *"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="rider-editor-name" /></Field>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Phone *"><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} data-testid="rider-editor-phone" /></Field>
            <Field label="Vehicle #"><Input value={form.vehicle_no || ""} onChange={(e) => set("vehicle_no", e.target.value)} data-testid="rider-editor-vehicle" /></Field>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="License #"><Input value={form.license_no || ""} onChange={(e) => set("license_no", e.target.value)} data-testid="rider-editor-license" /></Field>
            <Field label="Current status">
              <Select value={form.current_status || "available"} onValueChange={(v) => set("current_status", v)}>
                <SelectTrigger data-testid="rider-editor-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="on_delivery">On delivery</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div className="text-sm font-semibold">Active</div>
            <Switch checked={form.is_active !== false} onCheckedChange={(v) => set("is_active", v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" onClick={() => onSave(form)} data-testid="rider-editor-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);
