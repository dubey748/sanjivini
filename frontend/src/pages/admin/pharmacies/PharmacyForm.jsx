import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const DAYS = [
  ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"],
  ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"],
];

const DEFAULT_HOURS = Object.fromEntries(DAYS.map(([k]) => [k, { open: "09:00", close: "22:00", closed: false }]));

const EMPTY = {
  name: "", owner_name: "", license_no: "", gst_number: "",
  phone: "", email: "", address: "", city: "Mumbai", state: "Maharashtra", pincode: "",
  latitude: "", longitude: "", delivery_radius_km: 5,
  operating_hours: { ...DEFAULT_HOURS },
  dark_store: false, is_active: true,
};

export default function PharmacyForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.cmsPharmacies.get(id)
      .then((p) => setForm({
        ...EMPTY, ...p,
        latitude: p.latitude ?? "", longitude: p.longitude ?? "",
        operating_hours: { ...DEFAULT_HOURS, ...(p.operating_hours || {}) },
      }))
      .catch((err) => showApiError(err))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setHour = (day, k, v) =>
    setForm((f) => ({ ...f, operating_hours: { ...f.operating_hours, [day]: { ...f.operating_hours[day], [k]: v } } }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const body = {
      ...form,
      latitude: form.latitude === "" ? null : Number(form.latitude),
      longitude: form.longitude === "" ? null : Number(form.longitude),
      delivery_radius_km: Number(form.delivery_radius_km) || 5,
    };
    setSaving(true);
    try {
      if (isEdit) { await adminApi.cmsPharmacies.update(id, body); toast.success("Updated"); }
      else { await adminApi.cmsPharmacies.create(body); toast.success("Created — pending approval"); }
      navigate("/admin/pharmacies");
    } catch (err) {
      showApiError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex h-60 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl space-y-6" data-testid="pharm-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/pharmacies")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{isEdit ? "Edit" : "New"}</Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">{isEdit ? form.name || "Pharmacy" : "New pharmacy"}</h1>
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" data-testid="pharm-form-save">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Save changes" : "Create pharmacy"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="rounded-3xl">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Store details</h3>
            <Field label="Pharmacy name *"><Input value={form.name} onChange={(e) => set("name", e.target.value)} required data-testid="pharm-form-name" /></Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Owner name"><Input value={form.owner_name || ""} onChange={(e) => set("owner_name", e.target.value)} data-testid="pharm-form-owner" /></Field>
              <Field label="Drug license #"><Input value={form.license_no || ""} onChange={(e) => set("license_no", e.target.value)} data-testid="pharm-form-license" /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="GST number"><Input value={form.gst_number || ""} onChange={(e) => set("gst_number", e.target.value)} data-testid="pharm-form-gst" /></Field>
              <div className="flex items-center justify-between rounded-2xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">Dark store</div>
                  <div className="text-xs text-muted-foreground">Fulfilment-only, no walk-ins</div>
                </div>
                <Switch checked={form.dark_store} onCheckedChange={(v) => set("dark_store", v)} data-testid="pharm-form-dark" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-3xl">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Contact</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Phone"><Input value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} data-testid="pharm-form-phone" /></Field>
              <Field label="Email"><Input type="email" value={form.email || ""} onChange={(e) => set("email", e.target.value)} data-testid="pharm-form-email" /></Field>
            </div>
            <Field label="Address">
              <Textarea rows={2} value={form.address || ""} onChange={(e) => set("address", e.target.value)} data-testid="pharm-form-address" />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="City"><Input value={form.city || ""} onChange={(e) => set("city", e.target.value)} data-testid="pharm-form-city" /></Field>
              <Field label="State"><Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} data-testid="pharm-form-state" /></Field>
              <Field label="Pincode"><Input value={form.pincode || ""} onChange={(e) => set("pincode", e.target.value)} data-testid="pharm-form-pincode" /></Field>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Latitude"><Input type="number" step="0.000001" value={form.latitude} onChange={(e) => set("latitude", e.target.value)} data-testid="pharm-form-lat" /></Field>
              <Field label="Longitude"><Input type="number" step="0.000001" value={form.longitude} onChange={(e) => set("longitude", e.target.value)} data-testid="pharm-form-lng" /></Field>
              <Field label="Delivery radius (km)"><Input type="number" min="0" step="0.5" value={form.delivery_radius_km} onChange={(e) => set("delivery_radius_km", e.target.value)} data-testid="pharm-form-radius" /></Field>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">Operating hours</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="py-2 text-left">Day</th>
                  <th className="py-2 text-left">Opens</th>
                  <th className="py-2 text-left">Closes</th>
                  <th className="py-2 text-left">Closed</th>
                </tr>
              </thead>
              <tbody>
                {DAYS.map(([k, label]) => (
                  <tr key={k} className="border-t border-border" data-testid={`pharm-form-hours-${k}`}>
                    <td className="py-2 pr-3 text-sm font-semibold">{label}</td>
                    <td className="py-2 pr-3">
                      <Input type="time" value={form.operating_hours[k].open || ""}
                        disabled={form.operating_hours[k].closed}
                        onChange={(e) => setHour(k, "open", e.target.value)} className="max-w-[120px]" />
                    </td>
                    <td className="py-2 pr-3">
                      <Input type="time" value={form.operating_hours[k].close || ""}
                        disabled={form.operating_hours[k].closed}
                        onChange={(e) => setHour(k, "close", e.target.value)} className="max-w-[120px]" />
                    </td>
                    <td className="py-2 pr-3">
                      <Switch checked={form.operating_hours[k].closed}
                        onCheckedChange={(v) => setHour(k, "closed", v)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl">
        <CardContent className="flex items-center justify-between p-6">
          <div>
            <div className="text-sm font-semibold">Active</div>
            <div className="text-xs text-muted-foreground">Off = pharmacy hidden from order routing</div>
          </div>
          <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} data-testid="pharm-form-active" />
        </CardContent>
      </Card>
    </form>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);
