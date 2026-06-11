import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Phone, MapPin, Truck, Pill } from "lucide-react";
import { api, inr } from "@/lib/api";

export default function OrderTracking() {
  const { id } = useParams();
  const [o, setO] = useState(null);
  const [eta, setEta] = useState(0);

  useEffect(() => {
    api.get(`/orders/${id}`).then(({ data }) => {
      setO(data);
      setEta(data.eta_minutes || 18);
    });
  }, [id]);

  useEffect(() => {
    const t = setInterval(() => setEta((e) => Math.max(0, e - 1)), 60000);
    return () => clearInterval(t);
  }, []);

  if (!o) return <div className="mx-auto max-w-3xl px-6 py-20 text-center text-muted-foreground" data-testid="track-loading">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8" data-testid="order-tracking-page">
      <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Order #{o.order_number}</div>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Out for delivery</h1>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <Card className="rounded-3xl md:col-span-2">
          <CardContent className="p-0">
            <div className="relative h-64 overflow-hidden rounded-t-3xl">
              <img src="https://images.pexels.com/photos/6759307/pexels-photo-6759307.jpeg?auto=compress&w=1200" alt="map" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07231A]/40 via-transparent to-transparent" />
              <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0F4C3A]"><span className="live-dot" /> Live tracking · ETA {eta} min</div>
            </div>
            <div className="p-6">
              <h3 className="font-display text-lg font-semibold">Delivery timeline</h3>
              <div className="mt-4 space-y-3">
                {(o.timeline || []).map((s, i) => (
                  <div key={s.status} className="flex items-start gap-3" data-testid={`timeline-${s.status}`}>
                    <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#2D7A5D]" />
                    <div>
                      <div className="font-display font-semibold">{s.label}</div>
                      <div className="text-xs text-muted-foreground">{new Date(s.at).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
                <div className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-5 w-5 text-[#D9933A]" />
                  <div><div className="font-display font-semibold">Arriving in ~{eta} minutes</div><div className="text-xs text-muted-foreground">Rider is on the way</div></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="rounded-3xl bg-[#0F4C3A] text-white">
            <CardContent className="p-6">
              <div className="text-xs uppercase tracking-[0.15em] text-white/70">Your rider</div>
              <div className="font-display mt-1 text-xl font-bold">{o.rider?.name}</div>
              <div className="mt-1 text-sm text-white/80">{o.rider?.vehicle}</div>
              <div className="mt-4 flex items-center gap-3">
                <a href={`tel:${o.rider?.phone}`} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25" data-testid="call-rider-btn"><Phone className="h-3.5 w-3.5" /> Call</a>
                <div className="text-xs text-white/70">{o.rider?.phone}</div>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold"><Truck className="h-4 w-4 text-[#0F4C3A]" /> Fulfilled by</h3>
              <div className="mt-2 text-sm">{o.pharmacy?.name}</div>
              <div className="text-xs text-muted-foreground">{o.pharmacy?.address}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-display flex items-center gap-2 text-base font-semibold"><MapPin className="h-4 w-4 text-[#0F4C3A]" /> Delivering to</h3>
              <div className="mt-2 text-sm">{o.address ? `${o.address.line1}, ${o.address.city} - ${o.address.pincode}` : "Address pending"}</div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-display text-base font-semibold">Order items</h3>
              <div className="mt-3 space-y-2">
                {(o.items || []).map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2"><Pill className="h-3.5 w-3.5 text-[#0F4C3A]" />{i.name} × {i.qty}</span>
                    <span>{inr(i.price * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="my-3 h-px bg-border" />
              <div className="flex justify-between"><span className="font-display font-semibold">Total</span><span className="font-display text-lg font-bold text-[#0F4C3A]">{inr(o.total)}</span></div>
              <Badge className="mt-2 rounded-full bg-[#2D7A5D]/10 text-[#2D7A5D] hover:bg-[#2D7A5D]/10">{o.payment_method?.toUpperCase()} · {o.payment_status}</Badge>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
