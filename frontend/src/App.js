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
import AdminDashboard from "@/pages/AdminDashboard";
import PharmacyPanel from "@/pages/PharmacyPanel";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="flex min-h-screen flex-col bg-background text-foreground">
            <Navbar />
            <main className="flex-1">
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
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/pharmacy" element={<PharmacyPanel />} />
              </Routes>
            </main>
            <Footer />
          </div>
          <Toaster position="top-right" richColors closeButton />
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
