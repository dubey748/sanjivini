import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Star, Video, Languages, Award } from "lucide-react";
import { api, inr } from "@/lib/api";
import { toast } from "sonner";

export default function Doctors() {
  const [docs, setDocs] = useState([]);
  const [open, setOpen] = useState(null);
  const [slot, setSlot] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => { api.get("/doctors").then(({ data }) => setDocs(data)); }, []);

  const book = async () => {
    try {
      const { data } = await api.post("/consultations", { doctor_id: open.id, slot, reason });
      toast.success(`Consultation booked with ${data.doctor.name}`);
      setOpen(null); setSlot(""); setReason("");
    } catch { toast.error("Please sign in to book"); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="doctors-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Consult a doctor</h1>
      <p className="mt-2 text-muted-foreground">Connect with verified doctors in under 5 minutes via secure video call.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {docs.map((d) => (
          <Card key={d.id} className="rounded-3xl medicine-card-shadow" data-testid={`doctor-${d.id}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <img src={d.image} alt={d.name} className="h-16 w-16 rounded-full border border-border object-cover" />
                <div>
                  <h3 className="font-display font-semibold">{d.name}</h3>
                  <div className="text-xs text-muted-foreground">{d.specialty}</div>
                  <div className="mt-1 flex items-center gap-1 text-xs"><Star className="h-3 w-3 fill-[#D9933A] text-[#D9933A]" /> {d.rating}</div>
                </div>
              </div>
              <div className="mt-4 space-y-1 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><Award className="h-3.5 w-3.5" /> {d.experience} years experience</div>
                <div className="flex items-center gap-2 text-muted-foreground"><Languages className="h-3.5 w-3.5" /> {d.languages}</div>
              </div>
              <div className="mt-5 flex items-center justify-between">
                <div><span className="font-display text-xl font-bold text-[#0F4C3A]">{inr(d.fee)}</span><span className="text-xs text-muted-foreground"> / consult</span></div>
                <Dialog open={open?.id === d.id} onOpenChange={(o) => setOpen(o ? d : null)}>
                  <DialogTrigger asChild>
                    <Button className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid={`consult-${d.id}`}><Video className="mr-1 h-3.5 w-3.5" /> Consult</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Book with {d.name}</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">Pick a slot</div>
                      <div className="flex flex-wrap gap-2">
                        {d.slots.map((s) => (
                          <Badge key={s} onClick={() => setSlot(s)} className={`cursor-pointer rounded-full px-3 py-1.5 ${slot === s ? "bg-[#0F4C3A] text-white" : "bg-card text-foreground hover:bg-muted"}`} data-testid={`slot-${s}`}>{s}</Badge>
                        ))}
                      </div>
                      <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's the concern? (optional)" className="w-full rounded-2xl border border-border bg-card p-3 text-sm" data-testid="consult-reason" />
                      <Button onClick={book} disabled={!slot} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="confirm-book-btn">Confirm booking · {inr(d.fee)}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
