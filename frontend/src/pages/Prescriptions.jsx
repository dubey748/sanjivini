import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Upload, Sparkles, Pill, ScanLine } from "lucide-react";
import { api, inr } from "@/lib/api";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

export default function Prescriptions() {
  const [list, setList] = useState([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState(null);
  const { add } = useCart();
  const navigate = useNavigate();

  const refresh = () => api.get("/prescriptions").then(({ data }) => setList(data));
  useEffect(() => { refresh(); }, []);

  const handleUpload = async (e) => {
    const f = e.target.files?.[0];
    if (f) {
      const reader = new FileReader();
      reader.onload = () => setPreview(reader.result);
      reader.readAsDataURL(f);
    }
  };

  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post("/prescriptions", { image_url: preview, note });
      toast.success(`AI detected ${data.ai_detected.length} medicines from your prescription`);
      setPreview(null); setNote("");
      refresh();
    } catch { toast.error("Please sign in to upload prescription"); }
    setBusy(false);
  };

  const addAll = async (rx) => {
    for (const d of rx.ai_detected) await add(d.medicine_id, 1);
    toast.success("All detected medicines added to cart");
    navigate("/cart");
  };

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8" data-testid="prescriptions-page">
      <div className="flex flex-col items-start gap-2">
        <Badge className="rounded-full bg-[#D9933A]/15 text-[#7B5418] hover:bg-[#D9933A]/15"><Sparkles className="mr-1 h-3 w-3" /> AI-powered Rx reading</Badge>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Upload prescription</h1>
        <p className="text-muted-foreground">Snap or upload your prescription. Our AI identifies medicines and adds them to your cart in seconds.</p>
      </div>

      <Card className="mt-6 rounded-3xl border-dashed border-[#0F4C3A]/30 bg-[#F9F8F6]">
        <CardContent className="p-8">
          {!preview ? (
            <label className="flex cursor-pointer flex-col items-center gap-3 text-center" data-testid="upload-rx-area">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-[#0F4C3A] text-white"><Upload className="h-6 w-6" /></div>
              <div className="font-display text-lg font-semibold">Drop your prescription here</div>
              <div className="text-sm text-muted-foreground">JPG, PNG · up to 10MB</div>
              <input type="file" accept="image/*" className="hidden" onChange={handleUpload} />
              <Button asChild className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="choose-file-btn"><span>Choose file</span></Button>
            </label>
          ) : (
            <div className="space-y-4">
              <img src={preview} alt="rx preview" className="mx-auto max-h-72 rounded-2xl border border-border" />
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Any note for the pharmacist? (optional)" className="rounded-2xl" data-testid="rx-note" />
              <div className="flex gap-3">
                <Button onClick={submit} disabled={busy} className="rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="submit-rx-btn"><ScanLine className="mr-2 h-4 w-4" />{busy ? "Reading with AI…" : "Analyze & save"}</Button>
                <Button variant="outline" onClick={() => setPreview(null)} className="rounded-full" data-testid="discard-rx-btn">Discard</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <h2 className="font-display mt-12 text-2xl font-semibold">Your prescriptions</h2>
      <div className="mt-4 space-y-3">
        {list.length === 0 && <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">No prescriptions yet</div>}
        {list.map((rx) => (
          <Card key={rx.id} className="rounded-2xl" data-testid={`rx-${rx.id}`}>
            <CardContent className="flex flex-col gap-4 p-5 md:flex-row">
              <img src={rx.image_url} alt="" className="h-24 w-24 rounded-xl border border-border object-cover" />
              <div className="flex-1">
                <div className="flex items-center gap-2"><Badge className="rounded-full bg-[#2D7A5D]/15 text-[#2D7A5D] hover:bg-[#2D7A5D]/15">{rx.status}</Badge><span className="text-xs text-muted-foreground">{new Date(rx.created_at).toLocaleString()}</span></div>
                <div className="font-display mt-2 text-sm font-semibold">{rx.fallback_used ? "Suggested medicines (AI couldn't read prescription clearly):" : "AI detected medicines:"}</div>
                <div className="mt-1 space-y-1 text-sm">
                  {rx.ai_detected.map((d) => (
                    <div key={d.medicine_id} className="flex items-center gap-2">
                      <Pill className="h-3.5 w-3.5 text-[#0F4C3A]" /> {d.name}
                      <Badge variant="outline" className="rounded-full">{Math.round(d.confidence * 100)}% conf</Badge>
                      {d.source === "suggestion" && <Badge variant="outline" className="rounded-full border-[#D9933A]/40 text-[#7B5418]">suggestion</Badge>}
                    </div>
                  ))}
                </div>
              </div>
              <Button onClick={() => addAll(rx)} className="self-start rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid={`add-all-${rx.id}`}>Add all to cart</Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
