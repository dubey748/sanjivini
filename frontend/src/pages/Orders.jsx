import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, Package } from "lucide-react";
import { api, inr } from "@/lib/api";

export default function Orders() {
  const [orders, setOrders] = useState([]);
  useEffect(() => { api.get("/orders").then(({ data }) => setOrders(data)); }, []);

  if (!orders.length) return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center" data-testid="no-orders">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#0F4C3A]/10"><Package className="h-9 w-9 text-[#0F4C3A]" /></div>
      <h1 className="font-display mt-5 text-3xl font-bold">No orders yet</h1>
      <Button asChild className="mt-6 rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]"><Link to="/medicines" data-testid="start-shopping-btn">Start shopping</Link></Button>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8" data-testid="orders-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your orders</h1>
      <div className="mt-6 space-y-3">
        {orders.map((o) => (
          <Link key={o.id} to={`/orders/${o.id}`} data-testid={`order-row-${o.id}`}>
            <Card className="rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-md">
              <CardContent className="flex items-center gap-4 p-5">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A]"><Package className="h-5 w-5" /></div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="font-display font-semibold">#{o.order_number}</div>
                    <Badge className="rounded-full bg-[#2D7A5D]/10 text-[#2D7A5D] hover:bg-[#2D7A5D]/10">{o.status}</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">{(o.items || []).map((i) => i.name).slice(0, 2).join(", ")}{o.items?.length > 2 ? ` +${o.items.length - 2}` : ""}</div>
                </div>
                <div className="text-right">
                  <div className="font-display text-lg font-bold text-[#0F4C3A]">{inr(o.total)}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
