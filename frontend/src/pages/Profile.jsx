import React, { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wallet, Trophy, User, Heart, Stethoscope, FlaskConical } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { api, inr } from "@/lib/api";

export default function Profile() {
  const { user, logout } = useAuth();
  const [wallet, setWallet] = useState({ balance: 0, loyalty_points: 0 });
  const [consults, setConsults] = useState([]);
  const [labs, setLabs] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    api.get("/wallet").then(({ data }) => setWallet(data));
    api.get("/consultations").then(({ data }) => setConsults(data));
    api.get("/lab-bookings").then(({ data }) => setLabs(data));
  }, [user]);

  if (user === false) return <Navigate to="/login" />;
  if (!user) return null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-10 md:px-8" data-testid="profile-page">
      <div className="flex flex-col items-start gap-4 md:flex-row md:items-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-[#0F4C3A] text-white">
          <User className="h-7 w-7" />
        </div>
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{user.name}</h1>
          <p className="text-muted-foreground">{user.email} {user.phone ? `· ${user.phone}` : ""}</p>
          <Badge className="mt-2 rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{user.role}</Badge>
        </div>
        <Button variant="outline" className="rounded-full" onClick={() => { logout(); navigate("/"); }} data-testid="logout-btn">Logout</Button>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <Card className="rounded-3xl bg-[#0F4C3A] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/70"><Wallet className="h-4 w-4" /> Sanjeevni Wallet</div>
            <div className="font-display mt-2 text-4xl font-bold">{inr(wallet.balance)}</div>
            <div className="mt-1 text-sm text-white/70">Use at checkout for instant discount</div>
          </CardContent>
        </Card>
        <Card className="rounded-3xl bg-[#E26D5C] text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.15em] text-white/80"><Trophy className="h-4 w-4" /> Loyalty Points</div>
            <div className="font-display mt-2 text-4xl font-bold">{wallet.loyalty_points}</div>
            <div className="mt-1 text-sm text-white/80">Earn 1 point per ₹50 spent</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="consults" className="mt-10">
        <TabsList className="rounded-full bg-muted">
          <TabsTrigger value="consults" className="rounded-full" data-testid="tab-consults"><Stethoscope className="mr-1.5 h-3.5 w-3.5" /> Consultations</TabsTrigger>
          <TabsTrigger value="labs" className="rounded-full" data-testid="tab-labs"><FlaskConical className="mr-1.5 h-3.5 w-3.5" /> Lab Bookings</TabsTrigger>
          <TabsTrigger value="health" className="rounded-full" data-testid="tab-health"><Heart className="mr-1.5 h-3.5 w-3.5" /> Health Records</TabsTrigger>
        </TabsList>
        <TabsContent value="consults" className="mt-4">
          {consults.length === 0 ? <Empty msg="No consultations booked yet" /> :
            <div className="space-y-2">{consults.map((c) => (
              <Card key={c.id} className="rounded-2xl"><CardContent className="flex items-center gap-3 p-4">
                <img src={c.doctor.image} alt="" className="h-10 w-10 rounded-full object-cover" />
                <div className="flex-1"><div className="font-semibold">{c.doctor.name}</div><div className="text-xs text-muted-foreground">{c.doctor.specialty} · {c.slot}</div></div>
                <Badge className="rounded-full bg-[#2D7A5D]/10 text-[#2D7A5D] hover:bg-[#2D7A5D]/10">{c.status}</Badge>
              </CardContent></Card>))}</div>}
        </TabsContent>
        <TabsContent value="labs" className="mt-4">
          {labs.length === 0 ? <Empty msg="No lab tests booked yet" /> :
            <div className="space-y-2">{labs.map((b) => (
              <Card key={b.id} className="rounded-2xl"><CardContent className="flex items-center gap-3 p-4">
                <div className="grid h-10 w-10 place-items-center rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A]"><FlaskConical className="h-4 w-4" /></div>
                <div className="flex-1"><div className="font-semibold">{b.test.name}</div><div className="text-xs text-muted-foreground">{b.slot} · {b.phlebotomist}</div></div>
                <Badge className="rounded-full bg-[#D9933A]/15 text-[#7B5418] hover:bg-[#D9933A]/15">{b.status}</Badge>
              </CardContent></Card>))}</div>}
        </TabsContent>
        <TabsContent value="health" className="mt-4">
          <Empty msg="Health records — coming soon" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const Empty = ({ msg }) => <div className="rounded-2xl border border-border bg-card p-8 text-center text-muted-foreground">{msg}</div>;
