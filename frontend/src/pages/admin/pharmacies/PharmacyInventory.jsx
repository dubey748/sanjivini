import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Package, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";
import { inr } from "@/lib/api";

export default function PharmacyInventory() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [pharm, setPharm] = useState(null);
  const [rows, setRows] = useState(null);
  const [onlyLow, setOnlyLow] = useState(false);
  const [edits, setEdits] = useState({}); // medicine_id -> {stock, price_override, low_stock_threshold, is_active}
  const [savingId, setSavingId] = useState(null);

  const reload = () => {
    setRows(null);
    adminApi.cmsPharmacies.inventory(id, { only_low_stock: onlyLow })
      .then((r) => setRows(r.items || []))
      .catch((err) => { setRows([]); showApiError(err); });
  };

  useEffect(() => {
    adminApi.cmsPharmacies.get(id).then(setPharm).catch((err) => showApiError(err));
  }, [id]);
  useEffect(reload, [id, onlyLow]); // eslint-disable-line

  const getValue = (row, k, fallback) =>
    edits[row.medicine_id]?.[k] !== undefined ? edits[row.medicine_id][k] : (row[k] ?? fallback);

  const setEdit = (medicine_id, k, v) =>
    setEdits((e) => ({ ...e, [medicine_id]: { ...(e[medicine_id] || {}), [k]: v } }));

  const isDirty = (medicine_id) => Boolean(edits[medicine_id]);

  const handleSave = async (row) => {
    setSavingId(row.medicine_id);
    try {
      const stock = Number(getValue(row, "stock", 0));
      const priceOverride = getValue(row, "price_override", null);
      const lowStockThreshold = Number(getValue(row, "low_stock_threshold", 10));
      const isActive = getValue(row, "is_active", true);
      await adminApi.cmsPharmacies.upsertInventory(id, {
        medicine_id: row.medicine_id,
        stock,
        price_override: priceOverride === "" || priceOverride === null ? null : Number(priceOverride),
        low_stock_threshold: lowStockThreshold,
        is_active: !!isActive,
      });
      toast.success(`Saved: ${row.name}`);
      setEdits((e) => { const n = { ...e }; delete n[row.medicine_id]; return n; });
      reload();
    } catch (err) {
      showApiError(err);
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-pharmacy-inventory">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/pharmacies")}><ArrowLeft className="h-4 w-4" /></Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
              <Package className="mr-1.5 h-3 w-3" /> Inventory
            </Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">{pharm?.name || "Pharmacy"}</h1>
            <p className="text-xs text-muted-foreground">
              Override stock and price per pharmacy. Rows without overrides use the catalog defaults.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Label className="flex items-center gap-2 rounded-full bg-amber-500/10 px-3 py-1.5 text-xs text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            Low-stock only
            <Switch checked={onlyLow} onCheckedChange={setOnlyLow} data-testid="inv-low-toggle" />
          </Label>
        </div>
      </div>

      <Card className="mt-6 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {rows === null && (
            <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          )}
          {rows && rows.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No items.</div>
          )}
          {rows && rows.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="inv-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Medicine</th>
                  <th className="px-4 py-3 text-right">Default ₹</th>
                  <th className="px-4 py-3 text-right">Override ₹</th>
                  <th className="px-4 py-3 text-right">Stock</th>
                  <th className="px-4 py-3 text-right">Low @</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const stock = Number(getValue(r, "stock", 0));
                  const thresh = Number(getValue(r, "low_stock_threshold", 10));
                  const lowFlag = stock <= thresh;
                  return (
                    <tr key={r.medicine_id} className="border-t border-border" data-testid={`inv-row-${r.medicine_id}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-muted">
                            {r.image ? <img src={r.image} alt="" className="h-full w-full object-cover"
                              onError={(e) => { e.currentTarget.style.opacity = 0.2; }} /> : null}
                          </div>
                          <div>
                            <div className="font-semibold">{r.name}</div>
                            <div className="text-[10px] text-muted-foreground"><code className="rounded bg-muted px-1 py-0.5">{r.medicine_id}</code></div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">{inr(r.default_price)}</td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number" min="0" step="0.01"
                          value={getValue(r, "price_override", "") ?? ""}
                          onChange={(e) => setEdit(r.medicine_id, "price_override", e.target.value)}
                          className="ml-auto h-8 max-w-[110px] text-right"
                          data-testid={`inv-price-${r.medicine_id}`}
                          placeholder="—"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number" min="0"
                          value={String(getValue(r, "stock", 0))}
                          onChange={(e) => setEdit(r.medicine_id, "stock", e.target.value)}
                          className={`ml-auto h-8 max-w-[90px] text-right ${lowFlag ? "border-amber-500" : ""}`}
                          data-testid={`inv-stock-${r.medicine_id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Input
                          type="number" min="0"
                          value={String(getValue(r, "low_stock_threshold", 10))}
                          onChange={(e) => setEdit(r.medicine_id, "low_stock_threshold", e.target.value)}
                          className="ml-auto h-8 max-w-[80px] text-right"
                          data-testid={`inv-thresh-${r.medicine_id}`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={!!getValue(r, "is_active", true)}
                          onCheckedChange={(v) => setEdit(r.medicine_id, "is_active", v)}
                          data-testid={`inv-active-${r.medicine_id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm" variant={isDirty(r.medicine_id) ? "default" : "outline"}
                          className={`rounded-full text-xs ${isDirty(r.medicine_id) ? "bg-[#0F4C3A] text-white" : ""}`}
                          disabled={!isDirty(r.medicine_id) || savingId === r.medicine_id}
                          onClick={() => handleSave(r)}
                          data-testid={`inv-save-${r.medicine_id}`}
                        >
                          {savingId === r.medicine_id
                            ? <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            : <Save className="mr-1 h-3 w-3" />}
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
