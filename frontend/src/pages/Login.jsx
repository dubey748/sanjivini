import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pill, Mail, Phone, Lock } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

function formatErr(detail) {
  if (!detail) return "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map((e) => e?.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}

export default function Login() {
  const { login, otpRequest, otpVerify } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const doLogin = async (e) => {
    e.preventDefault(); setBusy(true);
    try { await login(email, password); toast.success("Welcome back!"); navigate("/"); }
    catch (err) { toast.error(formatErr(err?.response?.data?.detail)); }
    setBusy(false);
  };

  const sendOtp = async () => {
    if (!phone) { toast.error("Enter phone"); return; }
    setBusy(true);
    try { const r = await otpRequest(phone); setOtpSent(true); toast.success(r.message); }
    catch (err) { toast.error(formatErr(err?.response?.data?.detail)); }
    setBusy(false);
  };

  const verifyOtp = async () => {
    setBusy(true);
    try { await otpVerify(phone, otp); toast.success("Welcome!"); navigate("/"); }
    catch (err) { toast.error(formatErr(err?.response?.data?.detail)); }
    setBusy(false);
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-80px)] max-w-7xl items-center gap-10 px-6 py-10 md:grid-cols-2 md:px-8" data-testid="login-page">
      <div className="hidden md:block">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-[#0F4C3A] text-white"><Pill className="h-6 w-6" /></div>
        <h2 className="font-display mt-5 text-4xl font-bold tracking-tight">Welcome to Sanjeevni</h2>
        <p className="mt-3 max-w-md text-muted-foreground">Sign in to track orders, save addresses, refill medicines, and use your wallet & loyalty points.</p>
        <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
          <li>• 20-minute medicine delivery</li>
          <li>• AI prescription reading</li>
          <li>• Free home lab sample collection</li>
          <li>• 5-min doctor video consults</li>
        </ul>
      </div>
      <Card className="rounded-3xl">
        <CardContent className="p-8">
          <h3 className="font-display text-2xl font-bold">Sign in</h3>
          <p className="mt-1 text-sm text-muted-foreground">Don't have an account? <Link to="/register" className="font-semibold text-[#0F4C3A] underline" data-testid="goto-register">Create one</Link></p>

          <Tabs defaultValue="email" className="mt-6">
            <TabsList className="grid w-full grid-cols-2 rounded-full bg-muted">
              <TabsTrigger value="email" className="rounded-full" data-testid="tab-email-login"><Mail className="mr-1.5 h-3.5 w-3.5" /> Email</TabsTrigger>
              <TabsTrigger value="phone" className="rounded-full" data-testid="tab-phone-login"><Phone className="mr-1.5 h-3.5 w-3.5" /> Phone OTP</TabsTrigger>
            </TabsList>

            <TabsContent value="email" className="mt-5">
              <form onSubmit={doLogin} className="space-y-3">
                <div><Label>Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-full" required data-testid="login-email" /></div>
                <div><Label>Password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-full" required data-testid="login-password" /></div>
                <Button type="submit" disabled={busy} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="login-submit"><Lock className="mr-2 h-4 w-4" />{busy ? "Signing in…" : "Sign in"}</Button>
              </form>
              <div className="mt-4 rounded-xl bg-[#F0EFEB] p-3 text-xs text-muted-foreground">
                <div className="font-semibold text-[#0F4C3A]">Demo accounts</div>
                <div>Customer: user@sanjeevni.com / User@123</div>
                <div>Admin: admin@sanjeevni.com / Admin@123</div>
                <div>Pharmacy: pharmacy@sanjeevni.com / Pharma@123</div>
              </div>
            </TabsContent>

            <TabsContent value="phone" className="mt-5 space-y-3">
              <div><Label>Phone number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 9876543210" className="rounded-full" data-testid="login-phone" /></div>
              {!otpSent ? (
                <Button onClick={sendOtp} disabled={busy} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="send-otp-btn">{busy ? "Sending…" : "Send OTP"}</Button>
              ) : (
                <>
                  <div><Label>OTP (try 123456)</Label><Input value={otp} onChange={(e) => setOtp(e.target.value)} className="rounded-full" data-testid="login-otp" /></div>
                  <Button onClick={verifyOtp} disabled={busy} className="w-full rounded-full bg-[#0F4C3A] hover:bg-[#0A3629]" data-testid="verify-otp-btn">{busy ? "Verifying…" : "Verify & sign in"}</Button>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
