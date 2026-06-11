import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, AlertTriangle, IndianRupee, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, inr } from "@/lib/api";

export default function PharmacyPanel() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!user || (user.role !== "pharmacy" && user.role !== "admin")) return;
    api.get("/pharmacy/dashboard").then(({ data }) => setData(data));
  }, [user]);

  if (user === false) return <Navigate to="/login" />;
  if (user && user.role !== "pharmacy" && user.role !== "admin") return <Navigate to="/" />;
  if (!data) return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground" data-testid="pharmacy-loading">Loading…</div>;

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="pharmacy-page">
      <Badge className="rounded-full bg-[#E26D5C]/15 text-[#9B3F30] hover:bg-[#E26D5C]/15">Pharmacy partner</Badge>
      <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Pharmacy operations</h1>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi icon={IndianRupee} label="GMV" value={inr(data.revenue)} color="#0F4C3A" />
        <Kpi icon={Package} label="Total orders" value={data.orders.length} color="#2D7A5D" />
        <Kpi icon={ClipboardCheck} label="Pending" value={data.pending_orders} color="#D9933A" />
        <Kpi icon={AlertTriangle} label="Low stock SKUs" value={data.low_stock.length} color="#C94A4A" />
      </div>

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList className="rounded-full bg-muted">
          <TabsTrigger value="orders" className="rounded-full" data-testid="ph-tab-orders">Orders</TabsTrigger>
          <TabsTrigger value="inv" className="rounded-full" data-testid="ph-tab-inventory">Inventory</TabsTrigger>
          <TabsTrigger value="low" className="rounded-full" data-testid="ph-tab-low">Low stock</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Order #</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th></tr></thead>
              <tbody>
                {data.orders.map((o) => (
                  <tr key={o.id} className="border-t border-border" data-testid={`ph-order-${o.id}`}>
                    <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(o.items || []).map((i) => i.name).slice(0, 2).join(", ")}</td>
                    <td className="px-4 py-3">{inr(o.total)}</td>
                    <td className="px-4 py-3"><Badge className="rounded-full bg-[#2D7A5D]/10 text-[#2D7A5D] hover:bg-[#2D7A5D]/10">{o.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="inv" className="mt-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {data.inventory.map((m) => (
              <Card key={m.id} className="rounded-2xl" data-testid={`inv-${m.id}`}>
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="h-12 w-12 overflow-hidden rounded-xl bg-muted">{m.image && <img src={m.image} className="h-full w-full object-cover" alt="" />}</div>
                  <div className="flex-1"><div className="font-semibold">{m.name}</div><div className="text-xs text-muted-foreground">{m.brand} · {inr(m.price)}</div></div>
                  <Badge className={`rounded-full ${m.stock < 10 ? "bg-[#C94A4A]/15 text-[#C94A4A]" : "bg-[#2D7A5D]/10 text-[#2D7A5D]"} hover:bg-current/10`}>{m.stock}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        <TabsContent value="low" className="mt-4">
          {data.low_stock.length === 0
            ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">All stock levels healthy 🎉</div>
            : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{data.low_stock.map((m) => (
                <Card key={m.id} className="rounded-2xl border-[#C94A4A]/40">
                  <CardContent className="p-4"><div className="font-semibold">{m.name}</div><div className="text-xs text-muted-foreground">{m.brand}</div><Badge className="mt-2 rounded-full bg-[#C94A4A]/15 text-[#C94A4A] hover:bg-[#C94A4A]/15">Only {m.stock} left</Badge></CardContent>
                </Card>))}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Kpi = ({ icon: Icon, label, value, color }) => (
  <Card className="rounded-3xl"><CardContent className="p-5">
    <div className="grid h-9 w-9 place-items-center rounded-xl" style={{ backgroundColor: `${color}1a`, color }}><Icon className="h-4 w-4" /></div>
    <div className="font-display mt-3 text-2xl font-bold">{value}</div>
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
  </CardContent></Card>
);
