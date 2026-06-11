import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pill, Trash2, Minus, Plus, Tag } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, inr } from "@/lib/api";
import { toast } from "sonner";

export default function Cart() {
  const { cart, update, refresh } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [coupons, setCoupons] = useState([]);
  const [applied, setApplied] = useState(null);

  useEffect(() => { api.get("/coupons").then(({ data }) => setCoupons(data)); refresh(); }, [refresh]);

  const apply = async (c) => {
    try {
      const { data } = await api.post(`/coupons/apply?code=${encodeURIComponent(c)}`);
      setApplied(data); setCode(c); toast.success(`Coupon applied: −${inr(data.discount)}`);
    } catch (e) { toast.error("Invalid coupon"); }
  };

  if (!cart.items?.length) return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center" data-testid="empty-cart">
      <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#0F4C3A]/10"><Pill className="h-9 w-9 text-[#0F4C3A]" /></div>
      <h1 className="font-display mt-5 text-3xl font-bold">Your cart is empty</h1>
      <p className="mt-2 text-muted-foreground">Browse 10,000+ medicines and add to cart.</p>
      <Button className="mt-6 rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" onClick={() => navigate("/medicines")} data-testid="browse-meds-btn">Browse medicines</Button>
    </div>
  );

  const finalTotal = Math.max(0, cart.total - (applied?.discount || 0));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="cart-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Your cart</h1>
      <div className="mt-6 grid gap-8 md:grid-cols-3">
        <div className="md:col-span-2 space-y-3">
          {cart.items.map((it) => (
            <Card key={it.medicine_id} className="rounded-2xl" data-testid={`cart-item-${it.medicine_id}`}>
              <CardContent className="flex items-center gap-4 p-4">
                <div className="h-16 w-16 overflow-hidden rounded-xl bg-[#F0EFEB]">
                  {it.medicine.image ? <img src={it.medicine.image} className="h-full w-full object-cover" alt="" /> : <Pill className="h-full w-full p-3 text-[#0F4C3A]/40" />}
                </div>
                <div className="flex-1">
                  <div className="font-display font-semibold">{it.medicine.name}</div>
                  <div className="text-xs text-muted-foreground">{it.medicine.pack}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => update(it.medicine_id, Math.max(0, it.qty - 1))} data-testid={`dec-${it.medicine_id}`}><Minus className="h-3 w-3" /></Button>
                  <span className="w-7 text-center text-sm font-semibold">{it.qty}</span>
                  <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={() => update(it.medicine_id, it.qty + 1)} data-testid={`inc-${it.medicine_id}`}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="hidden w-20 text-right font-display font-semibold sm:block">{inr(it.line_total)}</div>
                <Button size="icon" variant="ghost" onClick={() => update(it.medicine_id, 0)} data-testid={`remove-${it.medicine_id}`}><Trash2 className="h-4 w-4 text-[#C94A4A]" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <h3 className="font-display text-lg font-semibold">Apply coupon</h3>
              <div className="mt-3 flex gap-2">
                <Input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Enter code" className="rounded-full" data-testid="coupon-input" />
                <Button onClick={() => apply(code)} className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="apply-coupon-btn">Apply</Button>
              </div>
              <div className="mt-3 space-y-2">
                {coupons.map((c) => (
                  <button key={c.code} onClick={() => apply(c.code)} className="flex w-full items-start gap-3 rounded-xl border border-dashed border-[#0F4C3A]/30 bg-[#F9F8F6] p-3 text-left transition-colors hover:bg-[#F0EFEB]" data-testid={`coupon-${c.code}`}>
                    <Tag className="mt-0.5 h-4 w-4 text-[#0F4C3A]" />
                    <div>
                      <div className="font-display text-sm font-bold text-[#0F4C3A]">{c.code}</div>
                      <div className="text-xs text-muted-foreground">{c.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="space-y-2 p-5 text-sm">
              <Line k="Subtotal" v={inr(cart.subtotal)} />
              <Line k="Delivery" v={cart.delivery_fee === 0 ? <Badge className="rounded-full bg-[#2D7A5D] hover:bg-[#2D7A5D]">FREE</Badge> : inr(cart.delivery_fee)} />
              {applied && <Line k={`Coupon (${applied.coupon.code})`} v={<span className="text-[#2D7A5D]">−{inr(applied.discount)}</span>} />}
              <div className="my-2 h-px bg-border" />
              <div className="flex justify-between"><div className="font-display text-base font-semibold">Total</div><div className="font-display text-xl font-bold text-[#0F4C3A]">{inr(finalTotal)}</div></div>
              <Button className="mt-3 w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" onClick={() => navigate("/checkout", { state: { coupon: applied?.coupon?.code } })} data-testid="proceed-checkout-btn">
                {user ? "Proceed to checkout" : "Sign in to checkout"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const Line = ({ k, v }) => <div className="flex justify-between"><div className="text-muted-foreground">{k}</div><div className="font-medium">{v}</div></div>;
