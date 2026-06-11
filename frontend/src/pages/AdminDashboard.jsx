import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, ShoppingBag, Pill, IndianRupee, TrendingUp, Store } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { api, inr } from "@/lib/api";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!user || user.role !== "admin") return;
    api.get("/admin/stats").then(({ data }) => setStats(data));
    api.get("/admin/orders").then(({ data }) => setOrders(data));
    api.get("/admin/users").then(({ data }) => setUsers(data));
  }, [user]);

  if (user === false) return <Navigate to="/login" />;
  if (user && user.role !== "admin") return <Navigate to="/" />;
  if (!stats) return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground" data-testid="admin-loading">Loading admin…</div>;

  const statusData = Object.entries(stats.status_counts || {}).map(([k, v]) => ({ status: k, count: v }));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="admin-page">
      <div className="flex flex-col items-start justify-between gap-3 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">Admin</Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Business Intelligence</h1>
          <p className="text-muted-foreground">Sanjeevni · Real-time operations dashboard</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4" data-testid="admin-kpis">
        <Kpi icon={IndianRupee} label="Revenue" value={inr(stats.revenue)} color="#0F4C3A" />
        <Kpi icon={ShoppingBag} label="Orders" value={stats.total_orders} color="#E26D5C" />
        <Kpi icon={Users} label="Users" value={stats.total_users} color="#2D7A5D" />
        <Kpi icon={Pill} label="SKUs" value={stats.total_medicines} color="#D9933A" />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl lg:col-span-2">
          <CardContent className="p-6">
            <h3 className="font-display flex items-center gap-2 text-lg font-semibold"><TrendingUp className="h-4 w-4 text-[#0F4C3A]" /> Revenue (last 7 days)</h3>
            <div className="mt-4 h-64 min-h-[256px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.revenue_chart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="date" stroke="#5C6B64" fontSize={12} />
                  <YAxis stroke="#5C6B64" fontSize={12} />
                  <Tooltip formatter={(v) => inr(v)} />
                  <Line type="monotone" dataKey="revenue" stroke="#0F4C3A" strokeWidth={3} dot={{ r: 4, fill: "#E26D5C" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl">
          <CardContent className="p-6">
            <h3 className="font-display flex items-center gap-2 text-lg font-semibold"><Store className="h-4 w-4 text-[#0F4C3A]" /> Order status</h3>
            <div className="mt-4 h-64 min-h-[256px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E5E0" />
                  <XAxis dataKey="status" stroke="#5C6B64" fontSize={12} />
                  <YAxis stroke="#5C6B64" fontSize={12} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0F4C3A" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="orders" className="mt-10">
        <TabsList className="rounded-full bg-muted">
          <TabsTrigger value="orders" className="rounded-full" data-testid="admin-tab-orders">All Orders</TabsTrigger>
          <TabsTrigger value="users" className="rounded-full" data-testid="admin-tab-users">Users</TabsTrigger>
        </TabsList>
        <TabsContent value="orders" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Order #</th><th className="px-4 py-3">Items</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Placed</th></tr></thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-t border-border" data-testid={`admin-order-${o.id}`}>
                    <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                    <td className="px-4 py-3 text-muted-foreground">{(o.items || []).length}</td>
                    <td className="px-4 py-3">{inr(o.total)}</td>
                    <td className="px-4 py-3"><Badge className="rounded-full bg-[#2D7A5D]/10 text-[#2D7A5D] hover:bg-[#2D7A5D]/10">{o.status}</Badge></td>
                    <td className="px-4 py-3 text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</td>
                  </tr>
                ))}
                {!orders.length && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No orders yet</td></tr>}
              </tbody>
            </table>
          </div>
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Role</th><th className="px-4 py-3">Wallet</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-border" data-testid={`admin-user-${u.id}`}>
                    <td className="px-4 py-3 font-semibold">{u.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-4 py-3"><Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{u.role}</Badge></td>
                    <td className="px-4 py-3">{inr(u.wallet_balance || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
