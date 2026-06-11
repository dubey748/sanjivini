import React, { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FlaskConical, Home, Clock } from "lucide-react";
import { api, inr } from "@/lib/api";
import { toast } from "sonner";

const SLOTS = ["Tomorrow 7:00 AM", "Tomorrow 9:00 AM", "Tomorrow 11:00 AM", "Day After 7:00 AM", "Day After 10:00 AM"];

export default function LabTests() {
  const [tests, setTests] = useState([]);
  const [open, setOpen] = useState(null);
  const [slot, setSlot] = useState("");

  useEffect(() => { api.get("/lab-tests").then(({ data }) => setTests(data)); }, []);

  const book = async () => {
    try {
      const { data } = await api.post("/lab-bookings", { test_id: open.id, slot });
      toast.success(`${data.test.name} booked for ${slot}`);
      setOpen(null); setSlot("");
    } catch { toast.error("Please sign in"); }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="lab-tests-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Lab tests at home</h1>
      <p className="mt-2 text-muted-foreground">Free home sample collection. NABL accredited labs. Digital reports.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tests.map((t) => {
          const off = Math.round(((t.mrp - t.price) / t.mrp) * 100);
          return (
            <Card key={t.id} className="rounded-3xl medicine-card-shadow" data-testid={`labtest-${t.id}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#0F4C3A]/10"><FlaskConical className="h-5 w-5 text-[#0F4C3A]" /></div>
                  <Badge className="rounded-full bg-[#E26D5C] hover:bg-[#E26D5C]">{off}% OFF</Badge>
                </div>
                <h3 className="font-display mt-4 text-lg font-semibold">{t.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">{t.category} · {t.tests_included} parameters</div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Home className="h-3 w-3" /> Home collection</span>
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Report in {t.report_in}</span>
                  {t.fasting && <Badge variant="outline" className="rounded-full">Fasting required</Badge>}
                </div>
                <div className="mt-5 flex items-end justify-between">
                  <div>
                    <span className="font-display text-2xl font-bold text-[#0F4C3A]">{inr(t.price)}</span>
                    <span className="ml-2 text-sm text-muted-foreground line-through">{inr(t.mrp)}</span>
                  </div>
                  <Dialog open={open?.id === t.id} onOpenChange={(o) => setOpen(o ? t : null)}>
                    <DialogTrigger asChild><Button className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid={`book-lab-${t.id}`}>Book</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Book {t.name}</DialogTitle></DialogHeader>
                      <div className="space-y-3">
                        <div className="text-sm text-muted-foreground">Pick a slot for home collection</div>
                        <div className="flex flex-wrap gap-2">
                          {SLOTS.map((s) => (
                            <Badge key={s} onClick={() => setSlot(s)} className={`cursor-pointer rounded-full px-3 py-1.5 ${slot === s ? "bg-[#0F4C3A] text-white" : "bg-card text-foreground hover:bg-muted"}`} data-testid={`lab-slot-${s}`}>{s}</Badge>
                          ))}
                        </div>
                        <Button onClick={book} disabled={!slot} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="confirm-lab-btn">Confirm · {inr(t.price)}</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
