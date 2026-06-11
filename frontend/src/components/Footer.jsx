import React from "react";
import { Pill, Mail, Phone, MapPin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-border bg-[#0F4C3A] text-white" data-testid="site-footer">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-12 md:grid-cols-4 md:px-8">
        <div>
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-white/15">
              <Pill className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold">Sanjeevni</span>
          </div>
          <p className="mt-3 text-sm text-white/70">
            Hyperlocal healthcare. Medicines delivered in 20 minutes from your nearest dark store.
          </p>
        </div>
        <div>
          <h4 className="font-display font-semibold">Products</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>Medicines</li><li>Doctors</li><li>Lab Tests</li><li>Health Records</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold">Company</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li>About</li><li>Pharmacy Partner</li><li>Delivery Partner</li><li>Press</li>
          </ul>
        </div>
        <div>
          <h4 className="font-display font-semibold">Contact</h4>
          <ul className="mt-3 space-y-2 text-sm text-white/70">
            <li className="flex items-center gap-2"><Mail className="h-4 w-4" /> care@sanjeevni.com</li>
            <li className="flex items-center gap-2"><Phone className="h-4 w-4" /> 1800-123-2020</li>
            <li className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Mumbai · Delhi · Bangalore</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/60">
        © {new Date().getFullYear()} Sanjeevni Health Tech. All rights reserved.
      </div>
    </footer>
  );
}
