import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [cart, setCart] = useState({ items: [], subtotal: 0, total: 0, delivery_fee: 0 });

  const refresh = useCallback(async () => {
    if (!user) { setCart({ items: [], subtotal: 0, total: 0, delivery_fee: 0 }); return; }
    try {
      const { data } = await api.get("/cart");
      setCart(data);
    } catch {}
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  const add = async (medicine_id, qty = 1) => {
    const { data } = await api.post("/cart/add", { medicine_id, qty });
    setCart(data);
  };
  const update = async (medicine_id, qty) => {
    const { data } = await api.post("/cart/update", { medicine_id, qty });
    setCart(data);
  };
  const clear = async () => {
    const { data } = await api.post("/cart/clear");
    setCart(data);
  };

  const count = (cart.items || []).reduce((s, i) => s + i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, add, update, clear, refresh, count }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
