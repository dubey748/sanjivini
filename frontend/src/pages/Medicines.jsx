import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Filter } from "lucide-react";
import { api } from "@/lib/api";
import MedicineCard from "@/components/MedicineCard";

export default function Medicines() {
  const [params, setParams] = useSearchParams();
  const [meds, setMeds] = useState([]);
  const [cats, setCats] = useState([]);
  const [q, setQ] = useState(params.get("q") || "");
  const [cat, setCat] = useState(params.get("category") || "");
  const [rxOnly, setRxOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/categories").then(({ data }) => setCats(data)); }, []);

  useEffect(() => {
    setLoading(true);
    const qs = new URLSearchParams();
    if (q) qs.append("q", q);
    if (cat) qs.append("category", cat);
    if (rxOnly) qs.append("prescription_only", "true");
    api.get(`/medicines?${qs.toString()}`).then(({ data }) => setMeds(data)).finally(() => setLoading(false));
    setParams(qs);
  }, [q, cat, rxOnly, setParams]);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 md:px-8" data-testid="medicines-page">
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">All medicines</h1>
      <p className="mt-2 text-muted-foreground">Search by brand, composition or symptom.</p>

      <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Try 'paracetamol', 'fever', 'diabetes'..."
            className="h-12 rounded-full border-border bg-card pl-11 pr-4"
            data-testid="medicine-search-input"
          />
        </div>
        <Button
          variant={rxOnly ? "default" : "outline"}
          className={`rounded-full ${rxOnly ? "bg-[#0F4C3A] hover:bg-[#0A3629]" : "border-border"}`}
          onClick={() => setRxOnly((v) => !v)}
          data-testid="rx-only-toggle"
        >
          <Filter className="mr-2 h-4 w-4" /> Rx Only
        </Button>
      </div>

      <div className="mt-5 flex flex-wrap gap-2" data-testid="category-filter-list">
        <Badge
          onClick={() => setCat("")}
          className={`cursor-pointer rounded-full px-4 py-1.5 text-sm ${cat === "" ? "bg-[#0F4C3A] text-white" : "bg-card text-foreground hover:bg-muted"}`}
        >All</Badge>
        {cats.map((c) => (
          <Badge
            key={c.id}
            onClick={() => setCat(c.id === cat ? "" : c.id)}
            className={`cursor-pointer rounded-full px-4 py-1.5 text-sm ${cat === c.id ? "bg-[#0F4C3A] text-white" : "bg-card text-foreground hover:bg-muted"}`}
            data-testid={`cat-chip-${c.id}`}
          >{c.name}</Badge>
        ))}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="medicines-grid">
        {loading ? <div className="col-span-full py-12 text-center text-muted-foreground">Loading…</div> :
         meds.length === 0 ? <div className="col-span-full py-12 text-center text-muted-foreground">No medicines found</div> :
         meds.map((m) => <MedicineCard key={m.id} medicine={m} />)}
      </div>
    </div>
  );
}
