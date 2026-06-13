import React from "react";
import { NavLink, Link, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Pill, Tag, Bookmark, Image as ImageIcon, Layout,
  Stethoscope, FlaskConical, Store, Ticket, Sparkles, Bell, HelpCircle,
  FileText, Newspaper, ShoppingBag, Users, LogOut, ShieldCheck, ChevronRight,
  MapPin, Truck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { Badge } from "@/components/ui/badge";

// Section list — items with `phase > 1` show "Coming" badge in Phase 1.
const NAV = [
  {
    group: "Overview",
    items: [
      { to: "/admin", label: "Dashboard", icon: LayoutDashboard, phase: 1, end: true },
    ],
  },
  {
    group: "Catalog",
    items: [
      { to: "/admin/medicines", label: "Medicines", icon: Pill, phase: 1 },
      { to: "/admin/categories", label: "Categories", icon: Tag, phase: 1 },
      { to: "/admin/brands", label: "Brands", icon: Bookmark, phase: 1 },
      { to: "/admin/doctors", label: "Doctors", icon: Stethoscope, phase: 5 },
      { to: "/admin/lab-tests", label: "Lab Tests", icon: FlaskConical, phase: 5 },
      { to: "/admin/pharmacies", label: "Pharmacies & Stores", icon: Store, phase: 1 },
    ],
  },
  {
    group: "Content",
    items: [
      { to: "/admin/banners", label: "Banners", icon: ImageIcon, phase: 1 },
      { to: "/admin/homepage", label: "Homepage CMS", icon: Layout, phase: 1 },
      { to: "/admin/blogs", label: "Blogs", icon: Newspaper, phase: 5 },
      { to: "/admin/faqs", label: "FAQs", icon: HelpCircle, phase: 5 },
      { to: "/admin/pages", label: "Static Pages", icon: FileText, phase: 5 },
    ],
  },
  {
    group: "Marketing",
    items: [
      { to: "/admin/coupons", label: "Coupons", icon: Ticket, phase: 5 },
      { to: "/admin/offers", label: "Offers", icon: Sparkles, phase: 5 },
      { to: "/admin/notifications", label: "Notifications", icon: Bell, phase: 5 },
    ],
  },
  {
    group: "Operations",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ShoppingBag, phase: 1, end: true },
      { to: "/admin/riders", label: "Riders", icon: Truck, phase: 1 },
      { to: "/admin/service-areas", label: "Service Areas", icon: MapPin, phase: 1 },
      { to: "/admin/users", label: "Users", icon: Users, phase: 1, end: true },
    ],
  },
];

export default function AdminSidebar({ onNavigate }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  return (
    <aside
      className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-[#0F4C3A] text-white"
      data-testid="admin-sidebar"
    >
      <Link
        to="/admin"
        className="flex items-center gap-2 border-b border-white/10 px-5 py-5"
        data-testid="admin-brand"
      >
        <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="font-display text-lg font-bold tracking-tight">Sanjeevni</span>
          <span className="text-[10px] uppercase tracking-[0.18em] text-white/60">Admin portal</span>
        </div>
      </Link>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {NAV.map((group) => (
          <div key={group.group}>
            <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/40">
              {group.group}
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const isLive = item.phase === 1;
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    {isLive ? (
                      <NavLink
                        to={item.to}
                        end={item.end}
                        onClick={onNavigate}
                        data-testid={`admin-nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "bg-white text-[#0F4C3A] font-semibold"
                              : "text-white/85 hover:bg-white/10"
                          }`
                        }
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                      </NavLink>
                    ) : (
                      <NavLink
                        to={item.to}
                        onClick={onNavigate}
                        data-testid={`admin-nav-${item.label.toLowerCase().replace(/[^a-z]+/g, "-")}`}
                        className={({ isActive }) =>
                          `flex items-center justify-between rounded-xl px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? "bg-white/15 text-white"
                              : "text-white/60 hover:bg-white/10"
                          }`
                        }
                      >
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-white/15 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wide text-white hover:bg-white/15"
                        >
                          P{item.phase}
                        </Badge>
                      </NavLink>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 px-4 py-4">
        {user && (
          <div className="mb-3 text-xs">
            <div className="font-semibold">{user.name}</div>
            <div className="text-white/60">{user.email}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          data-testid="admin-logout"
          className="flex w-full items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm text-white transition-colors hover:bg-white/10"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}
