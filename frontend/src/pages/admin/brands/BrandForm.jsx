import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const EMPTY = {
  name: "", description: "", logo_url: "", website: "",
  sort_order: 100, is_active: true,
};

export default function BrandForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.cmsBrands.get(id)
      .then((b) => setForm({
        name: b.name || "", description: b.description || "", logo_url: b.logo_url || "",
        website: b.website || "", sort_order: b.sort_order ?? 100, is_active: b.is_active !== false,
      }))
      .catch((err) => showApiError(err, "Failed to load brand"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const body = {
      ...form,
      description: form.description?.trim() || null,
      logo_url: form.logo_url?.trim() || null,
      website: form.website?.trim() || null,
      sort_order: Number(form.sort_order) || 100,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminApi.cmsBrands.update(id, body);
        toast.success("Brand updated");
      } else {
        await adminApi.cmsBrands.create(body);
        toast.success("Brand created");
      }
      navigate("/admin/brands");
    } catch (err) {
      showApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground" data-testid="brand-form-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6" data-testid="brand-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/brands")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{isEdit ? "Edit" : "New"}</Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">{isEdit ? form.name || "Brand" : "Add brand"}</h1>
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" data-testid="brand-form-save">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Save changes" : "Create brand"}
        </Button>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required data-testid="brand-form-name" />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              data-testid="brand-form-description"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Logo URL">
              <Input
                value={form.logo_url}
                onChange={(e) => set("logo_url", e.target.value)}
                placeholder="https://..."
                data-testid="brand-form-logo"
              />
            </Field>
            <Field label="Website">
              <Input
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://brand.com"
                data-testid="brand-form-website"
              />
            </Field>
          </div>
          {form.logo_url && (
            <div className="rounded-2xl border border-border bg-muted/30 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Logo preview</div>
              <img src={form.logo_url} alt="" className="mt-2 h-12 object-contain"
                onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Sort order">
              <Input
                type="number" min="0"
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
                data-testid="brand-form-sort"
              />
            </Field>
            <div className="flex items-center justify-between rounded-2xl border border-border p-3">
              <div>
                <div className="text-sm font-semibold">Active</div>
                <div className="text-xs text-muted-foreground">Inactive brands hide from filters</div>
              </div>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} data-testid="brand-form-active" />
            </div>
          </div>
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
