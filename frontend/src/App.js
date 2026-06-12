import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Landing from "@/pages/Landing";
import Medicines from "@/pages/Medicines";
import MedicineDetail from "@/pages/MedicineDetail";
import Cart from "@/pages/Cart";
import Checkout from "@/pages/Checkout";
import Orders from "@/pages/Orders";
import OrderTracking from "@/pages/OrderTracking";
import Prescriptions from "@/pages/Prescriptions";
import Doctors from "@/pages/Doctors";
import LabTests from "@/pages/LabTests";
import Profile from "@/pages/Profile";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import PharmacyPanel from "@/pages/PharmacyPanel";
import AdminLayout, { AdminComingSoon } from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";

// Customer-facing layout (shared chrome) — wraps every public route so the
// admin portal can render without the customer Navbar/Footer.
function StorefrontLayout({ children }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <Routes>
            {/* Hidden admin portal — no link in nav/footer; reachable only by URL. */}
            <Route path="/admin" element={<AdminLayout />}>
              <Route index element={<AdminDashboard />} />
              {/* Phase 2-5 placeholders — render shared "Coming soon" panel. */}
              <Route path="medicines/*" element={<AdminComingSoon />} />
              <Route path="categories/*" element={<AdminComingSoon />} />
              <Route path="brands/*" element={<AdminComingSoon />} />
              <Route path="banners/*" element={<AdminComingSoon />} />
              <Route path="homepage/*" element={<AdminComingSoon />} />
              <Route path="doctors/*" element={<AdminComingSoon />} />
              <Route path="lab-tests/*" element={<AdminComingSoon />} />
              <Route path="pharmacies/*" element={<AdminComingSoon />} />
              <Route path="coupons/*" element={<AdminComingSoon />} />
              <Route path="offers/*" element={<AdminComingSoon />} />
              <Route path="notifications/*" element={<AdminComingSoon />} />
              <Route path="faqs/*" element={<AdminComingSoon />} />
              <Route path="blogs/*" element={<AdminComingSoon />} />
              <Route path="pages/*" element={<AdminComingSoon />} />
              {/* Orders & Users live links — render dashboard with the matching tab. */}
              <Route path="orders" element={<AdminDashboard />} />
              <Route path="users" element={<AdminDashboard />} />
            </Route>

            {/* Customer storefront */}
            <Route
              path="/*"
              element={
                <StorefrontLayout>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/medicines" element={<Medicines />} />
                    <Route path="/medicines/:id" element={<MedicineDetail />} />
                    <Route path="/cart" element={<Cart />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/orders" element={<Orders />} />
                    <Route path="/orders/:id" element={<OrderTracking />} />
                    <Route path="/prescriptions" element={<Prescriptions />} />
                    <Route path="/doctors" element={<Doctors />} />
                    <Route path="/lab-tests" element={<LabTests />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/pharmacy" element={<PharmacyPanel />} />
                  </Routes>
                </StorefrontLayout>
              }
            />
          </Routes>
          <Toaster position="top-right" richColors closeButton />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
