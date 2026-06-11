import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pill, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { inr } from "@/lib/api";
import { toast } from "sonner";

export default function MedicineCard({ medicine }) {
  const navigate = useNavigate();
  const { add } = useCart();
  const discount = Math.round(((medicine.mrp - medicine.price) / medicine.mrp) * 100);

  return (
    <Card
      className="group cursor-pointer overflow-hidden rounded-2xl border-border bg-card medicine-card-shadow transition-all hover:-translate-y-0.5 hover:shadow-lg"
      onClick={() => navigate(`/medicines/${medicine.id}`)}
      data-testid={`medicine-card-${medicine.id}`}
    >
      <div className="relative h-36 overflow-hidden bg-[#F0EFEB]">
        {medicine.image ? (
          <img src={medicine.image} alt={medicine.name} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        ) : (
          <div className="grid h-full place-items-center"><Pill className="h-10 w-10 text-[#0F4C3A]/40" /></div>
        )}
        {discount > 0 && (
          <Badge className="absolute left-3 top-3 rounded-full bg-[#E26D5C] text-white hover:bg-[#E26D5C]">{discount}% OFF</Badge>
        )}
        {medicine.prescription_required && (
          <Badge variant="outline" className="absolute right-3 top-3 rounded-full border-[#0F4C3A]/30 bg-white/80 text-[10px] text-[#0F4C3A]">Rx</Badge>
        )}
      </div>
      <CardContent className="p-4">
        <div className="text-xs uppercase tracking-[0.15em] text-muted-foreground">{medicine.brand}</div>
        <h3 className="font-display mt-1 line-clamp-1 text-base font-semibold">{medicine.name}</h3>
        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{medicine.pack}</p>
        <div className="mt-3 flex items-end justify-between">
          <div>
            <div className="font-display text-lg font-bold text-[#0F4C3A]">{inr(medicine.price)}</div>
            {medicine.mrp > medicine.price && (
              <div className="text-xs text-muted-foreground line-through">{inr(medicine.mrp)}</div>
            )}
          </div>
          <Button
            size="sm"
            className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]"
            onClick={async (e) => {
              e.stopPropagation();
              try { await add(medicine.id, 1); toast.success(`${medicine.name} added to cart`); }
              catch { toast.error("Please sign in to add to cart"); }
            }}
            data-testid={`add-to-cart-${medicine.id}`}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
