import React, { useEffect, useMemo, useState } from "react";
import {
  ShoppingBag, Loader2, X as XIcon, ChevronRight, CheckCircle2, Truck,
  Package, Clock, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";
import { inr } from "@/lib/api";

const TABS = [
  { value: "active", label: "Active" },
  { value: "placed", label: "Confirmed" },
  { value: "accepted", label: "Accepted" },
  { value: "preparing", label: "Preparing" },
  { value: "ready_for_pickup", label: "Ready" },
  { value: "out_for_delivery", label: "Out for delivery" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const STATUS_PILL = {
  placed: { label: "Confirmed", cls: "bg-sky-500/15 text-sky-700" },
  accepted: { label: "Accepted", cls: "bg-violet-500/15 text-violet-700" },
  preparing: { label: "Preparing", cls: "bg-amber-500/15 text-amber-700" },
  ready_for_pickup: { label: "Ready", cls: "bg-indigo-500/15 text-indigo-700" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-blue-500/15 text-blue-700" },
  delivered: { label: "Delivered", cls: "bg-emerald-500/15 text-emerald-700" },
  cancelled: { label: "Cancelled", cls: "bg-rose-500/15 text-rose-700" },
  confirmed: { label: "Confirmed (legacy)", cls: "bg-sky-500/15 text-sky-700" },
  packed: { label: "Preparing (legacy)", cls: "bg-amber-500/15 text-amber-700" },
};

const NEXT_BY = {
  placed: ["accepted", "cancelled"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready_for_pickup", "cancelled"],
  ready_for_pickup: ["out_for_delivery", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  confirmed: ["accepted", "cancelled"],
  packed: ["ready_for_pickup", "cancelled"],
};

export default function OrdersList() {
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState("active");
  const [items, setItems] = useState(null);
  const [activeOrder, setActiveOrder] = useState(null);

  const reload = () => {
    setItems(null);
    adminApi.cmsOrders.list({ status: tab }).then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err); });
    adminApi.cmsOrders.stats().then(setStats).catch(() => {});
  };
  useEffect(reload, [tab]); // eslint-disable-line

  return (
    <div className="mx-auto max-w-7xl" data-testid="admin-orders-list">
      <div>
        <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
          <ShoppingBag className="mr-1.5 h-3 w-3" /> Operations
        </Badge>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Orders</h1>
        <p className="text-sm text-muted-foreground">Manage and track customer orders end-to-end.</p>
      </div>

      {/* Stats */}
      <div className="mt-6 grid gap-3 md:grid-cols-4 lg:grid-cols-8" data-testid="order-stats">
        <StatTile label="All" value={stats?.total} accent="" />
        <StatTile label="Active" value={stats?.active} accent="emerald" />
        <StatTile label="Confirmed" value={stats?.placed} accent="sky" />
        <StatTile label="Accepted" value={stats?.accepted} accent="violet" />
        <StatTile label="Preparing" value={stats?.preparing} accent="amber" />
        <StatTile label="OFD" value={stats?.out_for_delivery} accent="blue" />
        <StatTile label="Delivered" value={stats?.delivered} accent="emerald" />
        <StatTile label="Cancelled" value={stats?.cancelled} accent="rose" />
      </div>

      {/* Tabs (custom — Shadcn tabs render labels poorly w/ 9 entries) */}
      <div className="mt-6 flex flex-wrap items-center gap-2" data-testid="order-tabs">
        {TABS.map((t) => (
          <Button key={t.value} type="button"
            variant={tab === t.value ? "default" : "outline"}
            className={`rounded-full text-xs ${tab === t.value ? "bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" : ""}`}
            onClick={() => setTab(t.value)}
            data-testid={`order-tab-${t.value}`}
          >
            {t.label}
          </Button>
        ))}
      </div>

      <Card className="mt-4 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>}
          {items && items.length === 0 && <div className="p-10 text-center text-muted-foreground">No orders in this view.</div>}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="order-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Order #</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Items</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3">Placed</th><th className="px-4 py-3">Pharmacy</th><th className="px-4 py-3">Rider</th><th /></tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const sp = STATUS_PILL[o.status] || { label: o.status, cls: "bg-muted text-muted-foreground" };
                  return (
                    <tr key={o.id} className="border-t border-border hover:bg-muted/30 cursor-pointer"
                      onClick={() => adminApi.cmsOrders.get(o.id).then(setActiveOrder).catch((e) => showApiError(e))}
                      data-testid={`order-row-${o.id}`}>
                      <td className="px-4 py-3 font-mono text-xs">{o.order_number || o.id}</td>
                      <td className="px-4 py-3"><Badge className={`rounded-full ${sp.cls} hover:${sp.cls}`}>{sp.label}</Badge></td>
                      <td className="px-4 py-3 text-xs">{(o.items || []).length}</td>
                      <td className="px-4 py-3 text-right text-xs">{inr(o.total)}</td>
                      <td className="px-4 py-3 text-[11px] text-muted-foreground">{fmtDate(o.placed_at)}</td>
                      <td className="px-4 py-3 text-xs">{o.pharmacy?.name || (o.pharmacy_id ? <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{o.pharmacy_id}</code> : "—")}</td>
                      <td className="px-4 py-3 text-xs">{o.rider?.name || (o.rider_id ? <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{o.rider_id}</code> : "—")}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground"><ChevronRight className="h-4 w-4" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <OrderDrawer
        order={activeOrder}
        onClose={() => setActiveOrder(null)}
        onChange={(updated) => { setActiveOrder(updated); reload(); }}
      />
    </div>
  );
}

const fmtDate = (s) => s ? new Date(s).toLocaleString() : "—";

const StatTile = ({ label, value, accent }) => {
  const colorMap = {
    emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600",
    sky: "text-sky-600", violet: "text-violet-600", blue: "text-blue-600",
  };
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-3">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className={`mt-0.5 text-xl font-bold ${colorMap[accent] || "text-[#0F4C3A]"}`}>{value ?? "—"}</div>
      </CardContent>
    </Card>
  );
};

function OrderDrawer({ order, onClose, onChange }) {
  const [pharmacies, setPharmacies] = useState([]);
  const [riders, setRiders] = useState([]);
  const [selPharm, setSelPharm] = useState("");
  const [selRider, setSelRider] = useState("");
  const [statusNote, setStatusNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    if (!order) return;
    adminApi.cmsPharmacies.list({ approval_status: "approved" })
      .then((r) => setPharmacies(r.items || [])).catch(() => {});
    adminApi.cmsRiders.list({ is_active: true })
      .then((r) => setRiders(r.items || [])).catch(() => {});
    setSelPharm(order.pharmacy_id || "");
    setSelRider(order.rider_id || "");
    setStatusNote("");
  }, [order]);

  const allowed = useMemo(() => NEXT_BY[order?.status] || [], [order]);

  if (!order) return null;
  const sp = STATUS_PILL[order.status] || { label: order.status, cls: "bg-muted text-muted-foreground" };

  const doStatusChange = async (newStatus) => {
    if (newStatus === "cancelled" && !confirmCancel) {
      setConfirmCancel(true);
      return;
    }
    setActing(true);
    try {
      const updated = await adminApi.cmsOrders.changeStatus(order.id, newStatus, statusNote || null);
      toast.success(`Status → ${newStatus}`);
      setConfirmCancel(false); setStatusNote("");
      onChange(updated);
    } catch (err) { showApiError(err); }
    finally { setActing(false); }
  };

  const doAssignPharmacy = async () => {
    if (!selPharm || selPharm === order.pharmacy_id) return;
    setActing(true);
    try {
      const updated = await adminApi.cmsOrders.assignPharmacy(order.id, selPharm);
      toast.success("Pharmacy assigned");
      onChange(updated);
    } catch (err) { showApiError(err); }
    finally { setActing(false); }
  };

  const doAssignRider = async () => {
    if (!selRider || selRider === order.rider_id) return;
    setActing(true);
    try {
      await adminApi.cmsRiders.assign(order.id, selRider);
      toast.success("Rider assigned");
      const updated = await adminApi.cmsOrders.get(order.id);
      onChange(updated);
    } catch (err) { showApiError(err); }
    finally { setActing(false); }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="order-drawer">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="font-mono text-base">{order.order_number || order.id}</span>
            <Badge className={`rounded-full ${sp.cls} hover:${sp.cls}`}>{sp.label}</Badge>
          </DialogTitle>
          <DialogDescription>{fmtDate(order.placed_at)}</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-2">
          {/* Items */}
          <div className="rounded-2xl border border-border">
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Items ({(order.items || []).length})</div>
            <ul className="divide-y divide-border text-sm">
              {(order.items || []).map((i, idx) => (
                <li key={idx} className="flex items-center justify-between px-3 py-2">
                  <span>{i.name} <span className="text-xs text-muted-foreground">×{i.qty || 1}</span></span>
                  <span className="text-xs text-muted-foreground">{inr((i.price || 0) * (i.qty || 1))}</span>
                </li>
              ))}
            </ul>
            <div className="flex items-center justify-between border-t border-border px-3 py-2 text-sm font-semibold">
              <span>Total</span><span>{inr(order.total)}</span>
            </div>
          </div>

          {/* Status history */}
          <div className="rounded-2xl border border-border">
            <div className="border-b border-border px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">Timeline</div>
            <ul className="space-y-2 px-3 py-3 text-xs">
              <TimelineRow label="Confirmed" icon={CheckCircle2} at={order.placed_at} active />
              <TimelineRow label="Accepted by pharmacy" icon={Package} at={order.accepted_at} active={!!order.accepted_at} />
              <TimelineRow label="Preparing" icon={Clock} at={order.accepted_at} active={["preparing","ready_for_pickup","out_for_delivery","delivered","packed"].includes(order.status)} />
              <TimelineRow label="Out for delivery" icon={Truck} at={order.picked_up_at} active={!!order.picked_up_at} />
              <TimelineRow label="Delivered" icon={CheckCircle2} at={order.delivered_at} active={!!order.delivered_at} />
              {order.cancelled_at && (
                <TimelineRow label={`Cancelled — ${order.cancellation_reason || "no reason"}`} icon={AlertTriangle} at={order.cancelled_at} active danger />
              )}
            </ul>
          </div>
        </div>

        {/* Pharmacy assignment */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Pharmacy</div>
              <Select value={selPharm} onValueChange={setSelPharm}>
                <SelectTrigger data-testid="order-assign-pharm"><SelectValue placeholder="Select pharmacy" /></SelectTrigger>
                <SelectContent>{pharmacies.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={acting || !selPharm || selPharm === order.pharmacy_id}
                onClick={doAssignPharmacy}
                className="w-full rounded-full bg-[#0F4C3A] text-white text-xs"
                data-testid="order-assign-pharm-save">
                Assign pharmacy
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rider</div>
              <Select value={selRider} onValueChange={setSelRider}>
                <SelectTrigger data-testid="order-assign-rider"><SelectValue placeholder="Select rider" /></SelectTrigger>
                <SelectContent>{riders.map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.phone}</SelectItem>)}</SelectContent>
              </Select>
              <Button disabled={acting || !selRider || selRider === order.rider_id}
                onClick={doAssignRider}
                className="w-full rounded-full bg-[#0F4C3A] text-white text-xs"
                data-testid="order-assign-rider-save">
                Assign rider
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Status actions */}
        <Card className="rounded-2xl">
          <CardContent className="space-y-3 p-3">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Change status</div>
            {allowed.length === 0 && <div className="text-xs text-muted-foreground">Order is in a terminal state.</div>}
            {allowed.length > 0 && (
              <>
                <Textarea rows={2} value={statusNote} onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional note (cancellation reason etc.)" data-testid="order-status-note" />
                <div className="flex flex-wrap gap-2">
                  {allowed.map((s) => {
                    const lbl = STATUS_PILL[s]?.label || s;
                    return (
                      <Button key={s} type="button" disabled={acting}
                        onClick={() => doStatusChange(s)}
                        variant={s === "cancelled" ? "outline" : "default"}
                        className={`rounded-full text-xs ${s === "cancelled" ? "text-rose-600" : "bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"}`}
                        data-testid={`order-status-${s}`}>
                        → {lbl}
                      </Button>
                    );
                  })}
                </div>
                {confirmCancel && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                    Confirm cancellation by clicking <strong>→ Cancelled</strong> again.
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}><XIcon className="mr-1.5 h-4 w-4" /> Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const TimelineRow = ({ label, icon: Icon, at, active, danger }) => (
  <li className={`flex items-center gap-2 ${active ? "" : "opacity-50"}`}>
    <Icon className={`h-3.5 w-3.5 ${danger ? "text-rose-600" : active ? "text-emerald-600" : "text-muted-foreground"}`} />
    <span className="font-medium">{label}</span>
    <span className="ml-auto text-[10px] text-muted-foreground">{at ? fmtDate(at) : "—"}</span>
  </li>
);
