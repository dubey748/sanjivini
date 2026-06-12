import React, { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Loader2, Menu, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { adminApi } from "@/lib/adminApi";
import AdminSidebar from "./AdminSidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export default function AdminLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [verified, setVerified] = useState(false);
  const [verifyError, setVerifyError] = useState(null);

  // Server-side handshake: even if local AuthContext says admin, ask backend
  // to confirm. This guards against stale cookies / role tampering.
  useEffect(() => {
    let cancelled = false;
    if (loading) return;
    if (!user || user === false) return;
    if (user?.role !== "admin") return;
    adminApi
      .whoami()
      .then(() => { if (!cancelled) setVerified(true); })
      .catch((err) => {
        if (cancelled) return;
        setVerifyError(err?.response?.status || "network");
        setVerified(false);
      });
    return () => { cancelled = true; };
  }, [user, loading]);

  // While AuthContext is still booting.
  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-testid="admin-loading">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F4C3A]" />
      </div>
    );
  }

  // Anonymous → bounce to /login with return path.
  if (user === false || user === null) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  // Logged in but not admin → bounce home (no flash of admin shell).
  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  // Server says NO → bounce home.
  if (verifyError) {
    return <Navigate to="/" replace />;
  }

  // Wait for the server handshake before painting the shell.
  if (!verified) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center" data-testid="admin-verifying">
        <Loader2 className="h-6 w-6 animate-spin text-[#0F4C3A]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#F7F6F2]" data-testid="admin-portal">
      <div className="hidden md:block">
        <AdminSidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="flex items-center justify-between border-b border-border bg-white px-4 py-3 md:px-6"
          data-testid="admin-topbar"
        >
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  data-testid="admin-mobile-menu-trigger"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-[#0F4C3A] p-0">
                <AdminSidebar />
              </SheetContent>
            </Sheet>
            <div className="flex flex-col leading-none">
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                Admin · {user.name}
              </span>
              <span className="font-display text-base font-semibold text-[#0F4C3A]">
                Operations & CMS
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => navigate("/")}
            data-testid="admin-go-storefront"
          >
            View storefront
          </Button>
        </header>

        <main className="flex-1 overflow-x-auto px-4 py-6 md:px-8" data-testid="admin-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// Stub component used for sections that are wired in later phases.
export function AdminComingSoon() {
  const params = useParams();
  const location = useLocation();
  const label = location.pathname.replace("/admin/", "").replace("-", " ") || "section";
  return (
    <div className="mx-auto max-w-3xl" data-testid="admin-coming-soon">
      <div className="rounded-3xl border border-dashed border-[#0F4C3A]/30 bg-white p-10 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A]">
          <X className="h-5 w-5" />
        </div>
        <h2 className="font-display mt-4 text-2xl font-bold capitalize text-[#0F4C3A]">
          {label}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This module is scheduled for a later phase. Phase 1 only ships the
          authentication, layout and dashboard skeleton.
        </p>
      </div>
    </div>
  );
}
