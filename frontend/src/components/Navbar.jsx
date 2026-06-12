import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { ShoppingCart, User, LogOut, Pill, Stethoscope, FlaskConical, Sparkles, Menu } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  const links = [
    { to: "/medicines", label: "Medicines", icon: Pill },
    { to: "/doctors", label: "Doctors", icon: Stethoscope },
    { to: "/lab-tests", label: "Lab Tests", icon: FlaskConical },
    { to: "/prescriptions", label: "Prescriptions", icon: Sparkles },
  ];

  return (
    <header className="glass-nav sticky top-0 z-40 border-b border-border" data-testid="site-navbar">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 md:px-8">
        <Link to="/" className="flex items-center gap-2" data-testid="brand-logo-link">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-[#0F4C3A] text-white">
            <Pill className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="font-display text-xl font-bold tracking-tight text-[#0F4C3A]">Sanjeevni</span>
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">20-min care</span>
          </div>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              data-testid={`nav-${l.label.toLowerCase().replace(/\s+/g, "-")}`}
              className={({ isActive }) =>
                `flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive ? "bg-[#0F4C3A] text-white" : "text-foreground hover:bg-muted"
                }`
              }
            >
              <l.icon className="h-4 w-4" />
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/cart" className="relative rounded-full p-2 hover:bg-muted" data-testid="nav-cart-button">
            <ShoppingCart className="h-5 w-5" />
            {count > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-[#E26D5C] text-[11px] font-bold text-white" data-testid="cart-count">
                {count}
              </span>
            )}
          </Link>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" data-testid="nav-user-menu">
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-display">
                  {user.name}
                  <div className="text-xs font-normal text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/profile")} data-testid="menu-profile">Profile</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/orders")} data-testid="menu-orders">My Orders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/prescriptions")} data-testid="menu-prescriptions">Prescriptions</DropdownMenuItem>
                {(user.role === "pharmacy" || user.role === "admin") && (
                  <DropdownMenuItem onClick={() => navigate("/pharmacy")} data-testid="menu-pharmacy">Pharmacy Panel</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { logout(); navigate("/"); }} data-testid="menu-logout">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button className="hidden rounded-full bg-[#0F4C3A] hover:bg-[#0A3629] md:inline-flex" onClick={() => navigate("/login")} data-testid="nav-login-button">
              Sign in
            </Button>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full md:hidden" data-testid="mobile-menu-btn">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="mt-6 flex flex-col gap-1">
                {links.map((l) => (
                  <NavLink key={l.to} to={l.to} className="rounded-md px-3 py-2 hover:bg-muted" data-testid={`mobile-nav-${l.label.toLowerCase()}`}>
                    {l.label}
                  </NavLink>
                ))}
                {!user && (
                  <Button className="mt-4 rounded-full bg-[#0F4C3A]" onClick={() => navigate("/login")} data-testid="mobile-login-btn">
                    Sign in
                  </Button>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
