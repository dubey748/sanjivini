import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, Truck, ShieldCheck, Stethoscope, FlaskConical, Sparkles, Pill, Star, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import MedicineCard from "@/components/MedicineCard";

export default function Landing() {
  const [meds, setMeds] = useState([]);
  const [cats, setCats] = useState([]);

  useEffect(() => {
    api.get("/medicines?limit=8").then(({ data }) => setMeds(data)).catch(() => {});
    api.get("/categories").then(({ data }) => setCats(data)).catch(() => {});
  }, []);

  return (
    <div data-testid="landing-page">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="dotted-bg absolute inset-0 opacity-60" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-6 py-16 md:grid-cols-12 md:gap-8 md:py-24 md:px-8">
          <div className="md:col-span-7 scroll-fade-in">
            <Badge className="rounded-full bg-[#E26D5C]/15 text-[#9B3F30] hover:bg-[#E26D5C]/15"><span className="live-dot" />Live in Lucknow</Badge>
            <h1 className="font-display mt-5 text-4xl font-bold tracking-tight text-[#0F4C3A] sm:text-5xl lg:text-6xl">
              Medicines delivered in <span className="brand-gradient-text">20 minutes</span>, day or night.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
              India's fastest healthcare super-app. Order medicines, book doctors, schedule lab tests — all from one place,
              backed by a hyperlocal network of pharmacies and dark stores.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/medicines"><Button size="lg" className="rounded-full bg-[#0F4C3A] px-6 hover:bg-[#0A3629]" data-testid="hero-shop-now-btn">Shop Medicines <ArrowRight className="ml-1.5 h-4 w-4" /></Button></Link>
              <Link to="/prescriptions"><Button size="lg" variant="outline" className="rounded-full border-[#0F4C3A]/30 px-6 hover:bg-[#0F4C3A]/5" data-testid="hero-upload-rx-btn"><Sparkles className="mr-2 h-4 w-4" />Upload Prescription</Button></Link>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: Clock, k: "20", l: "min delivery" },
                { icon: Truck, k: "850+", l: "dark stores" },
                { icon: ShieldCheck, k: "100%", l: "authentic" },
                { icon: Star, k: "4.8★", l: "rated" },
              ].map((s) => (
                <div key={s.l} className="rounded-2xl border border-border bg-card p-4">
                  <s.icon className="h-5 w-5 text-[#0F4C3A]" />
                  <div className="font-display mt-2 text-2xl font-bold">{s.k}</div>
                  <div className="text-xs text-muted-foreground">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative md:col-span-5">
            <div className="relative overflow-hidden rounded-3xl border border-border bg-[#0F4C3A]">
              <img
                src="https://images.unsplash.com/photo-1695654390723-479197a8c4a3?crop=entropy&cs=srgb&fm=jpg&q=85&w=900"
                alt="20-minute medicine delivery"
                className="h-[460px] w-full object-cover opacity-95"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07231A]/60 via-transparent to-transparent" />
              <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 text-xs font-semibold text-[#0F4C3A]">
                <span className="live-dot" /> Rider 1.2km away · ETA 14 min
              </div>
              <Card className="absolute -bottom-2 left-4 right-4 rounded-2xl border-border bg-card/95 backdrop-blur">
                <CardContent className="flex items-center gap-3 p-4">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0F4C3A] text-white">
                    <Truck className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs text-muted-foreground">Order #SJ-489201</div>
                    <div className="font-display font-semibold">Out for delivery</div>
                  </div>
                  <Badge className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]">14 min</Badge>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* QUICK ACTIONS */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">What do you need today?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: "/medicines", title: "Medicines", desc: "Order from 10,000+ medicines", icon: Pill, bg: "bg-[#0F4C3A] text-white" },
            { to: "/doctors", title: "Doctors", desc: "Video consult in 5 minutes", icon: Stethoscope, bg: "bg-[#E26D5C] text-white" },
            { to: "/lab-tests", title: "Lab Tests", desc: "Home sample collection", icon: FlaskConical, bg: "bg-[#1A4535] text-white" },
            { to: "/prescriptions", title: "Upload Rx", desc: "AI reads your prescription", icon: Sparkles, bg: "bg-[#D9933A] text-white" },
          ].map((a) => (
            <Link key={a.to} to={a.to} className="group rounded-3xl border border-border bg-card p-6 transition-all hover:-translate-y-0.5 hover:shadow-md" data-testid={`quick-${a.title.toLowerCase().replace(/\s+/g,'-')}`}>
              <div className={`grid h-12 w-12 place-items-center rounded-2xl ${a.bg}`}><a.icon className="h-6 w-6" /></div>
              <h3 className="font-display mt-4 text-lg font-semibold">{a.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
              <div className="mt-3 inline-flex items-center text-sm font-semibold text-[#0F4C3A] group-hover:gap-2">Explore <ChevronRight className="ml-1 h-4 w-4" /></div>
            </Link>
          ))}
        </div>
      </section>

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-6 py-8 md:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Shop by category</h2>
          <Link to="/medicines" className="text-sm font-semibold text-[#0F4C3A] hover:underline">View all</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {cats.map((c) => (
            <Link key={c.id} to={`/medicines?category=${c.id}`} className="rounded-2xl border border-border bg-card p-4 text-center transition-all hover:bg-[#F0EFEB]" data-testid={`cat-${c.id}`}>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A]">
                <Pill className="h-5 w-5" />
              </div>
              <div className="mt-2 text-sm font-medium">{c.name}</div>
            </Link>
          ))}
        </div>
      </section>

      {/* TRENDING */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:px-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">Trending medicines</h2>
          <Link to="/medicines" className="text-sm font-semibold text-[#0F4C3A] hover:underline">See all</Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {meds.map((m) => <MedicineCard key={m.id} medicine={m} />)}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-[#F0EFEB] py-16">
        <div className="mx-auto max-w-7xl px-6 md:px-8">
          <h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">The 20-minute promise</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Smart routing connects you to the nearest dark store with real-time inventory and an SLA-backed rider — every single time.</p>
          <div className="mt-10 grid gap-6 md:grid-cols-4">
            {[
              { n: "01", t: "Search & Add", d: "10,000+ medicines, generics & wellness." },
              { n: "02", t: "Nearest store", d: "AI picks the closest dark store with stock." },
              { n: "03", t: "Smart rider", d: "Auto-assigned. Live GPS. Live ETA." },
              { n: "04", t: "At your door", d: "Sealed, verified, in under 20 minutes." },
            ].map((s) => (
              <div key={s.n} className="rounded-3xl border border-border bg-card p-6">
                <div className="font-display text-3xl font-bold text-[#0F4C3A]/30">{s.n}</div>
                <h3 className="font-display mt-2 text-lg font-semibold">{s.t}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
