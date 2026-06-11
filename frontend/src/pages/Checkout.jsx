import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { MapPin, CreditCard, Banknote, Wallet, Smartphone, ShieldCheck, Clock, Sparkles } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/context/AuthContext";
import { api, inr } from "@/lib/api";
import { toast } from "sonner";

export default function Checkout() {
  const { cart, refresh } = useCart();
  const { user, refresh: refreshUser } = useAuth();
  const navigate = useNavigate();
  const { state } = useLocation();
  const [addresses, setAddresses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [pm, setPm] = useState("upi");
  const [useWallet, setUseWallet] = useState(false);
  const [form, setForm] = useState({ label: "Home", line1: "", line2: "", city: "Mumbai", state: "MH", pincode: "" });
  const [loading, setLoading] = useState(false);
  const [rzpConfig, setRzpConfig] = useState({ enabled: false, razorpay_key_id: "" });

  const [cartLoaded, setCartLoaded] = useState(false);
  const [localCart, setLocalCart] = useState(null);

  useEffect(() => { api.get("/addresses").then(({ data }) => { setAddresses(data); if (data[0]) setSelected(data[0].id); }); }, []);
  useEffect(() => { api.get("/payments/config").then(({ data }) => setRzpConfig(data)).catch(() => {}); }, []);
  useEffect(() => {
    api.get("/cart")
      .then(({ data }) => { setLocalCart(data); setCartLoaded(true); })
      .catch(() => setCartLoaded(true));
  }, []);

  // Load Razorpay Checkout.js once
  useEffect(() => {
    if (document.getElementById("razorpay-checkout-js")) return;
    const s = document.createElement("script");
    s.id = "razorpay-checkout-js";
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    document.body.appendChild(s);
  }, []);

  if (user === false) { navigate("/login"); return null; }
  if (!user || !cartLoaded) return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground" data-testid="checkout-loading">Loading…</div>;
  const activeCart = localCart || cart;
  if (!activeCart.items?.length) return (
    <div className="mx-auto max-w-3xl px-6 py-20 text-center" data-testid="checkout-empty">
      <h1 className="font-display text-2xl font-bold">Your cart is empty</h1>
      <Button className="mt-6 rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" onClick={() => navigate("/medicines")} data-testid="go-shop-btn">Browse medicines</Button>
    </div>
  );

  const saveAddress = async () => {
    if (!form.line1 || !form.pincode) { toast.error("Address line 1 and pincode required"); return; }
    const { data } = await api.post("/addresses", { ...form, is_default: !addresses.length });
    setAddresses([data, ...addresses]); setSelected(data.id); toast.success("Address saved");
    setForm({ ...form, line1: "", line2: "" });
  };

  const placeOrder = async () => {
    if (!selected) { toast.error("Add a delivery address"); return; }
    setLoading(true);
    try {
      // 1. Create Sanjeevni order in our backend first
      const { data: order } = await api.post("/orders/checkout", {
        address_id: selected, payment_method: pm, coupon_code: state?.coupon, use_wallet: useWallet,
      });

      // 2. If Razorpay selected and configured, open Razorpay checkout
      if (pm === "razorpay" && rzpConfig.enabled && order.total > 0) {
        const { data: rzp } = await api.post("/payments/create-order", {
          amount: order.total, receipt: order.order_number,
        });
        await new Promise((resolve, reject) => {
          if (!window.Razorpay) { reject(new Error("Razorpay script not loaded")); return; }
          const opts = {
            key: rzp.key_id,
            amount: rzp.amount,
            currency: rzp.currency,
            order_id: rzp.order_id,
            name: "Sanjeevni",
            description: `Order ${order.order_number}`,
            prefill: { name: user.name, email: user.email, contact: user.phone || "" },
            theme: { color: "#0F4C3A" },
            handler: async (resp) => {
              try {
                await api.post("/payments/verify", {
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature,
                  sanjeevni_order_id: order.id,
                });
                resolve();
              } catch (e) { reject(e); }
            },
            modal: { ondismiss: () => reject(new Error("Payment cancelled")) },
          };
          new window.Razorpay(opts).open();
        });
      }

      await refresh(); await refreshUser();
      toast.success("Order placed! Rider on the way.");
      navigate(`/orders/${order.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || e.message || "Failed to place order");
    }
    finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="checkout-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Checkout</h1>
      <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#2D7A5D]/10 px-3 py-1 text-sm text-[#0F4C3A]"><Clock className="h-4 w-4" /> ETA ~ 18 min once placed</div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="space-y-6 md:col-span-2">
          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h3 className="font-display flex items-center gap-2 text-lg font-semibold"><MapPin className="h-4 w-4 text-[#0F4C3A]" /> Delivery address</h3>
              {addresses.length > 0 && (
                <RadioGroup value={selected || ""} onValueChange={setSelected} className="mt-4 space-y-2" data-testid="address-list">
                  {addresses.map((a) => (
                    <label key={a.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selected === a.id ? "border-[#0F4C3A] bg-[#0F4C3A]/5" : "border-border"}`} data-testid={`address-${a.id}`}>
                      <RadioGroupItem value={a.id} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2"><Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{a.label}</Badge></div>
                        <div className="mt-1 text-sm">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} - {a.pincode}</div>
                      </div>
                    </label>
                  ))}
                </RadioGroup>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <Input placeholder="Label (Home/Office)" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} className="rounded-full" data-testid="addr-label" />
                <Input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} className="rounded-full" data-testid="addr-pincode" />
                <Input placeholder="Address line 1" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} className="rounded-full md:col-span-2" data-testid="addr-line1" />
                <Input placeholder="Address line 2 (optional)" value={form.line2} onChange={(e) => setForm({ ...form, line2: e.target.value })} className="rounded-full md:col-span-2" data-testid="addr-line2" />
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="rounded-full" data-testid="addr-city" />
                <Input placeholder="State" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className="rounded-full" data-testid="addr-state" />
              </div>
              <Button onClick={saveAddress} variant="outline" className="mt-4 rounded-full border-[#0F4C3A]/30" data-testid="save-address-btn">Save address</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-6">
              <h3 className="font-display flex items-center gap-2 text-lg font-semibold"><CreditCard className="h-4 w-4 text-[#0F4C3A]" /> Payment method</h3>
              <RadioGroup value={pm} onValueChange={setPm} className="mt-4 grid gap-2 sm:grid-cols-2" data-testid="payment-methods">
                {rzpConfig.enabled && <PMOption value="razorpay" current={pm} icon={Sparkles} label="Razorpay (UPI / Card / Net Banking)" />}
                <PMOption value="upi" current={pm} icon={Smartphone} label={rzpConfig.enabled ? "UPI (Demo)" : "UPI (Mock)"} />
                <PMOption value="card" current={pm} icon={CreditCard} label="Card (Mock)" />
                <PMOption value="cod" current={pm} icon={Banknote} label="Cash on Delivery" />
                <PMOption value="wallet" current={pm} icon={Wallet} label="Sanjeevni Wallet" />
              </RadioGroup>
              {!rzpConfig.enabled && (
                <div className="mt-3 rounded-xl bg-[#F0EFEB] p-3 text-xs text-muted-foreground">
                  💡 Razorpay isn't configured yet. Add <code className="font-mono">RAZORPAY_KEY_ID</code> &amp; <code className="font-mono">RAZORPAY_KEY_SECRET</code> to <code>backend/.env</code> to enable live UPI / cards / net-banking.
                </div>
              )}
              {user?.wallet_balance > 0 && pm !== "wallet" && (
                <label className="mt-4 flex items-center gap-2 text-sm" data-testid="use-wallet-toggle">
                  <Checkbox checked={useWallet} onCheckedChange={setUseWallet} />
                  Use Sanjeevni Wallet ({inr(user.wallet_balance)})
                </label>
              )}
            </CardContent>
          </Card>
        </div>

        <div>
          <Card className="rounded-2xl">
            <CardContent className="p-6 text-sm">
              <h3 className="font-display text-lg font-semibold">Order summary</h3>
              <div className="mt-3 space-y-1.5">
                {activeCart.items.map((i) => <div key={i.medicine_id} className="flex justify-between"><span className="line-clamp-1">{i.medicine.name} × {i.qty}</span><span>{inr(i.line_total)}</span></div>)}
              </div>
              <div className="my-3 h-px bg-border" />
              <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{inr(activeCart.subtotal)}</span></div>
              <div className="flex justify-between text-muted-foreground"><span>Delivery</span><span>{activeCart.delivery_fee === 0 ? "FREE" : inr(activeCart.delivery_fee)}</span></div>
              <div className="my-3 h-px bg-border" />
              <div className="flex justify-between"><span className="font-display text-base font-semibold">Total</span><span className="font-display text-xl font-bold text-[#0F4C3A]">{inr(activeCart.total)}</span></div>
              <Button onClick={placeOrder} disabled={loading} className="mt-4 w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="place-order-btn">
                {loading ? "Placing…" : "Place order"}
              </Button>
              <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> 100% secure · authentic medicines · SLA-backed delivery</div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

const PMOption = ({ value, current, icon: Icon, label }) => (
  <label className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${current === value ? "border-[#0F4C3A] bg-[#0F4C3A]/5" : "border-border"}`} data-testid={`pm-${value}`}>
    <RadioGroupItem value={value} />
    <Icon className="h-4 w-4 text-[#0F4C3A]" />
    <span className="text-sm">{label}</span>
  </label>
);
