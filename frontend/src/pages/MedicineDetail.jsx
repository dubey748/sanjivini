import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, ShieldCheck, Truck, ShoppingCart, Star } from "lucide-react";
import { api, inr } from "@/lib/api";
import { toast } from "sonner";
import { useCart } from "@/context/CartContext";
import MedicineCard from "@/components/MedicineCard";

export default function MedicineDetail() {
  const { id } = useParams();
  const { add } = useCart();
  const navigate = useNavigate();
  const [med, setMed] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [qty, setQty] = useState(1);

  useEffect(() => {
    api.get(`/medicines/${id}`).then(({ data }) => setMed(data));
    api.get(`/medicines/${id}/reviews`).then(({ data }) => setReviews(data));
  }, [id]);

  if (!med) return <div className="mx-auto max-w-7xl px-6 py-20 text-center text-muted-foreground" data-testid="medicine-detail-loading">Loading…</div>;

  const discount = Math.round(((med.mrp - med.price) / med.mrp) * 100);

  const handleAdd = async () => {
    try { await add(med.id, qty); toast.success("Added to cart"); navigate("/cart"); }
    catch { toast.error("Please sign in to add to cart"); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="medicine-detail-page">
      <div className="grid gap-10 md:grid-cols-2">
        <div className="rounded-3xl border border-border bg-card p-6">
          <div className="aspect-square overflow-hidden rounded-2xl bg-[#F0EFEB]">
            {med.image ? <img src={med.image} alt={med.name} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center"><Pill className="h-16 w-16 text-[#0F4C3A]/30" /></div>}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{med.brand} · {med.manufacturer}</div>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight sm:text-4xl">{med.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{med.pack}</p>
          {med.prescription_required && <Badge className="mt-3 rounded-full bg-[#E26D5C]/15 text-[#9B3F30] hover:bg-[#E26D5C]/15">Prescription required</Badge>}

          <div className="mt-6 flex items-end gap-3">
            <span className="font-display text-4xl font-bold text-[#0F4C3A]">{inr(med.price)}</span>
            {med.mrp > med.price && <span className="text-lg text-muted-foreground line-through">{inr(med.mrp)}</span>}
            {discount > 0 && <Badge className="rounded-full bg-[#2D7A5D] text-white hover:bg-[#2D7A5D]">{discount}% OFF</Badge>}
          </div>

          <div className="mt-6 flex items-center gap-2" data-testid="qty-controls">
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setQty(Math.max(1, qty - 1))} data-testid="qty-dec">−</Button>
            <span className="w-10 text-center font-display text-lg font-semibold">{qty}</span>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => setQty(qty + 1)} data-testid="qty-inc">+</Button>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={handleAdd} className="rounded-full bg-[#0F4C3A] px-6 hover:bg-[#0A3629]" data-testid="add-to-cart-detail-btn">
              <ShoppingCart className="mr-2 h-4 w-4" /> Add to cart
            </Button>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: Truck, t: "20-min delivery" },
              { icon: ShieldCheck, t: "100% authentic" },
              { icon: Star, t: "Best price" },
            ].map((b) => (
              <div key={b.t} className="flex items-center gap-2 rounded-2xl border border-border bg-card p-3 text-sm">
                <b.icon className="h-4 w-4 text-[#0F4C3A]" /> {b.t}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Tabs defaultValue="info" className="mt-12">
        <TabsList className="rounded-full bg-muted">
          <TabsTrigger value="info" className="rounded-full" data-testid="tab-info">Information</TabsTrigger>
          <TabsTrigger value="alts" className="rounded-full" data-testid="tab-alts">Generic Alternatives</TabsTrigger>
          <TabsTrigger value="rev" className="rounded-full" data-testid="tab-reviews">Reviews</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="mt-6">
          <Card className="rounded-2xl"><CardContent className="space-y-3 p-6 text-sm">
            <Row k="Composition" v={med.composition} />
            <Row k="Manufacturer" v={med.manufacturer} />
            <Row k="Used for" v={med.symptoms} />
            <Row k="Stock" v={`${med.stock} units available`} />
          </CardContent></Card>
        </TabsContent>
        <TabsContent value="alts" className="mt-6">
          {(med.alternatives || []).length === 0
            ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">No generic alternatives in stock right now.</div>
            : <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">{med.alternatives.map((a) => <MedicineCard key={a.id} medicine={a} />)}</div>}
        </TabsContent>
        <TabsContent value="rev" className="mt-6">
          {reviews.length === 0
            ? <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">No reviews yet. Be the first to review!</div>
            : <div className="space-y-3">{reviews.map((r) => (
                <Card key={r.id} className="rounded-2xl"><CardContent className="p-4">
                  <div className="flex items-center justify-between"><div className="font-semibold">{r.user_name}</div><div className="flex items-center gap-1 text-[#D9933A]"><Star className="h-4 w-4 fill-current" /> {r.rating}</div></div>
                  <p className="mt-2 text-sm text-muted-foreground">{r.comment}</p>
                </CardContent></Card>))}</div>}
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Row = ({ k, v }) => (
  <div className="flex flex-col gap-1 border-b border-border py-2 last:border-0 sm:flex-row sm:justify-between">
    <div className="text-muted-foreground">{k}</div><div className="font-medium">{v}</div>
  </div>
);
