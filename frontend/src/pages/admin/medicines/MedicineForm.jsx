import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Save, Plus, Trash2, ImageIcon, Loader2, AlertCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const EMPTY = {
  name: "", brand: "", composition: "", category: "",
  price: 0, mrp: 0, pack: "", prescription_required: false, stock: 0,
  symptoms: "", manufacturer: "",
  images: [], sku: "", hsn_code: "", gst_pct: 12, discount_pct: 0,
  tags: [], is_active: true,
};

export default function MedicineForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [imageInput, setImageInput] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Initial load.
  useEffect(() => {
    adminApi.categories().then(setCategories).catch(() => {});
    if (!isEdit) return;
    adminApi.medicines.get(id)
      .then((m) => {
        setForm({
          name: m.name || "", brand: m.brand || "", composition: m.composition || "",
          category: m.category || "", price: m.price ?? 0, mrp: m.mrp ?? 0,
          pack: m.pack || "", prescription_required: !!m.prescription_required,
          stock: m.stock ?? 0, symptoms: m.symptoms || "", manufacturer: m.manufacturer || "",
          images: m.images && m.images.length ? m.images : (m.image ? [m.image] : []),
          sku: m.sku || "", hsn_code: m.hsn_code || "", gst_pct: m.gst_pct ?? 12,
          discount_pct: m.discount_pct ?? 0, tags: m.tags || [],
          is_active: m.is_active !== false,
          subcategory_id: m.subcategory_id || null, brand_id: m.brand_id || null,
        });
        setTagsInput((m.tags || []).join(", "));
      })
      .catch((err) => { setError(err); showApiError(err, "Failed to load medicine"); })
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    if (form.images.includes(url)) { toast.error("Already added"); return; }
    set("images", [...form.images, url]);
    setImageInput("");
  };
  const removeImage = (idx) => set("images", form.images.filter((_, i) => i !== idx));
  const moveFirst = (idx) => {
    if (idx === 0) return;
    const next = [...form.images];
    const [m] = next.splice(idx, 1);
    next.unshift(m);
    set("images", next);
  };

  const valid = useMemo(() => {
    return form.name.trim() && form.composition.trim() && form.category && Number(form.price) >= 0;
  }, [form]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!valid) {
      toast.error("Please fill name, composition, category, and a valid price");
      return;
    }
    const body = {
      ...form,
      tags: tagsInput.split(",").map((s) => s.trim()).filter(Boolean),
      sku: form.sku ? form.sku.trim() : null,
      hsn_code: form.hsn_code ? form.hsn_code.trim() : null,
      gst_pct: form.gst_pct === "" ? null : Number(form.gst_pct),
      discount_pct: form.discount_pct === "" ? 0 : Number(form.discount_pct),
      price: Number(form.price),
      mrp: form.mrp === "" || form.mrp == null ? Number(form.price) : Number(form.mrp),
      stock: Number(form.stock) || 0,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminApi.medicines.update(id, body);
        toast.success("Medicine updated");
      } else {
        const r = await adminApi.medicines.create(body);
        toast.success("Medicine created");
        navigate(`/admin/medicines/${r.id}/edit`, { replace: true });
        return;
      }
      navigate("/admin/medicines");
    } catch (err) {
      showApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground" data-testid="med-form-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-5xl space-y-6" data-testid="med-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/medicines")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
              {isEdit ? "Edit" : "New"}
            </Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">
              {isEdit ? form.name || "Medicine" : "Add medicine"}
            </h1>
          </div>
        </div>
        <Button
          type="submit"
          disabled={saving || !valid}
          className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
          data-testid="med-form-save"
        >
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Save changes" : "Create medicine"}
        </Button>
      </div>

      {error && (
        <Card className="rounded-2xl border-rose-200 bg-rose-50">
          <CardContent className="flex items-center gap-2 p-3 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" /> Failed to load medicine.
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main */}
        <Card className="rounded-3xl lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <h3 className="font-display text-lg font-semibold">Basic information</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Name *">
                <Input
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  required
                  data-testid="med-form-name"
                />
              </Field>
              <Field label="Brand">
                <Input value={form.brand} onChange={(e) => set("brand", e.target.value)} data-testid="med-form-brand" />
              </Field>
              <Field label="Composition *" className="md:col-span-2">
                <Input
                  value={form.composition}
                  onChange={(e) => set("composition", e.target.value)}
                  required
                  data-testid="med-form-composition"
                />
              </Field>
              <Field label="Category *">
                <Select value={form.category} onValueChange={(v) => set("category", v)}>
                  <SelectTrigger data-testid="med-form-category"><SelectValue placeholder="Pick category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Manufacturer">
                <Input value={form.manufacturer} onChange={(e) => set("manufacturer", e.target.value)} data-testid="med-form-manufacturer" />
              </Field>
              <Field label="Pack" className="md:col-span-2">
                <Input
                  value={form.pack}
                  onChange={(e) => set("pack", e.target.value)}
                  placeholder="e.g. Strip of 15 tablets"
                  data-testid="med-form-pack"
                />
              </Field>
              <Field label="Symptoms / search keywords" className="md:col-span-2">
                <Textarea
                  value={form.symptoms}
                  onChange={(e) => set("symptoms", e.target.value)}
                  rows={2}
                  placeholder="fever, headache, body pain"
                  data-testid="med-form-symptoms"
                />
              </Field>
              <Field label="Tags (comma-separated)" className="md:col-span-2">
                <Input
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                  placeholder="fever; otc; trending"
                  data-testid="med-form-tags"
                />
              </Field>
            </div>

            <Separator className="my-2" />

            <h3 className="font-display text-lg font-semibold">Images</h3>
            <p className="text-xs text-muted-foreground">
              Paste image URLs (https://...). The first image is the primary display. Storage stays
              provider-agnostic — swap to a CDN later without changing this UI.
            </p>
            <div className="flex gap-2">
              <Input
                value={imageInput}
                onChange={(e) => setImageInput(e.target.value)}
                placeholder="https://example.com/medicine.jpg"
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addImage(); } }}
                data-testid="med-form-image-input"
              />
              <Button type="button" onClick={addImage} variant="outline" className="shrink-0" data-testid="med-form-image-add">
                <Plus className="mr-1 h-4 w-4" /> Add URL
              </Button>
            </div>
            {form.images.length === 0 ? (
              <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-muted/30 p-6 text-xs text-muted-foreground">
                <ImageIcon className="h-5 w-5" /> No images yet
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {form.images.map((url, idx) => (
                  <div
                    key={`${url}-${idx}`}
                    className="group relative overflow-hidden rounded-2xl border border-border bg-card"
                    data-testid={`med-form-image-${idx}`}
                  >
                    <div className="aspect-square bg-muted">
                      <img
                        src={url}
                        alt=""
                        className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.opacity = "0.2"; }}
                      />
                    </div>
                    {idx === 0 && (
                      <Badge className="absolute left-2 top-2 rounded-full bg-[#0F4C3A] text-white">Primary</Badge>
                    )}
                    <div className="flex items-center justify-between gap-1 p-1">
                      {idx !== 0 ? (
                        <Button type="button" variant="ghost" size="sm" className="text-[10px]" onClick={() => moveFirst(idx)}>
                          Set primary
                        </Button>
                      ) : <span />}
                      <Button
                        type="button" variant="ghost" size="icon"
                        onClick={() => removeImage(idx)}
                        data-testid={`med-form-image-remove-${idx}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Side */}
        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-display text-lg font-semibold">Pricing & stock</h3>
              <Field label="Price (₹) *">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.price}
                  onChange={(e) => set("price", e.target.value)}
                  required
                  data-testid="med-form-price"
                />
              </Field>
              <Field label="MRP (₹)">
                <Input
                  type="number" min="0" step="0.01"
                  value={form.mrp}
                  onChange={(e) => set("mrp", e.target.value)}
                  data-testid="med-form-mrp"
                />
              </Field>
              <Field label="Stock">
                <Input
                  type="number" min="0"
                  value={form.stock}
                  onChange={(e) => set("stock", e.target.value)}
                  data-testid="med-form-stock"
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Discount %">
                  <Input
                    type="number" min="0" max="100"
                    value={form.discount_pct}
                    onChange={(e) => set("discount_pct", e.target.value)}
                  />
                </Field>
                <Field label="GST %">
                  <Input
                    type="number" min="0" max="28"
                    value={form.gst_pct ?? ""}
                    onChange={(e) => set("gst_pct", e.target.value)}
                  />
                </Field>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-display text-lg font-semibold">Compliance</h3>
              <Field label="SKU">
                <Input
                  value={form.sku ?? ""}
                  onChange={(e) => set("sku", e.target.value)}
                  placeholder="Optional unique identifier"
                  data-testid="med-form-sku"
                />
              </Field>
              <Field label="HSN code">
                <Input
                  value={form.hsn_code ?? ""}
                  onChange={(e) => set("hsn_code", e.target.value)}
                  data-testid="med-form-hsn"
                />
              </Field>
              <div className="flex items-center justify-between rounded-2xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">Prescription required</div>
                  <div className="text-xs text-muted-foreground">Shown as Rx on the storefront</div>
                </div>
                <Switch
                  checked={form.prescription_required}
                  onCheckedChange={(v) => set("prescription_required", v)}
                  data-testid="med-form-rx"
                />
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">Active</div>
                  <div className="text-xs text-muted-foreground">Inactive medicines hide from the storefront</div>
                </div>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => set("is_active", v)}
                  data-testid="med-form-active"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

const Field = ({ label, children, className = "" }) => (
  <div className={className}>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);
