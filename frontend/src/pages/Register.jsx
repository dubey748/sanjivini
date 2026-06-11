import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Pill } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function formatErr(detail) {
  if (!detail) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "" });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await register(form); toast.success("Welcome to Sanjeevni!"); navigate("/"); }
    catch (err) { toast.error(formatErr(err?.response?.data?.detail)); }
    setBusy(false);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-8" data-testid="register-page">
      <div className="hidden md:block">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#E26D5C] text-white"><Pill className="h-6 w-6" /></div>
        <h2 className="font-display mt-5 text-4xl font-bold tracking-tight">Create your account</h2>
        <p className="mt-3 max-w-md text-muted-foreground">Get ₹100 welcome wallet credit instantly. Free delivery on first order.</p>
      </div>
      <Card className="rounded-3xl">
        <CardContent className="p-8">
          <h3 className="font-display text-2xl font-bold">Sign up</h3>
          <p className="mt-1 text-sm text-muted-foreground">Already have an account? <Link to="/login" className="font-semibold text-[#0F4C3A] underline" data-testid="goto-login">Sign in</Link></p>
          <form onSubmit={submit} className="mt-6 space-y-3">
            <div><Label>Full name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-full" required data-testid="reg-name" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="rounded-full" required data-testid="reg-email" /></div>
            <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="rounded-full" data-testid="reg-phone" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="rounded-full" required minLength={6} data-testid="reg-password" /></div>
            <Button type="submit" disabled={busy} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="reg-submit">{busy ? "Creating…" : "Create account"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
