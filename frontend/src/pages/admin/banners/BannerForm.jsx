import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2, Image as ImageIcon } from "lucide-react";
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
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const POSITIONS = ["hero", "mid", "sidebar", "footer", "popup"];

const EMPTY = {
  title: "", subtitle: "", image_url: "", link_url: "", cta_label: "",
  position: "hero", sort_order: 100, starts_at: "", ends_at: "", is_active: true,
};

// HTML datetime-local <-> ISO conversion
const toLocal = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
};
const toIso = (local) => (local ? new Date(local).toISOString() : null);

export default function BannerForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    adminApi.cmsBanners.get(id)
      .then((b) => setForm({
        title: b.title || "", subtitle: b.subtitle || "",
        image_url: b.image_url || "", link_url: b.link_url || "", cta_label: b.cta_label || "",
        position: b.position || "hero", sort_order: b.sort_order ?? 100,
        starts_at: toLocal(b.starts_at), ends_at: toLocal(b.ends_at),
        is_active: b.is_active !== false,
      }))
      .catch((err) => showApiError(err, "Failed to load banner"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.image_url.trim()) {
      toast.error("Title and image URL are required");
      return;
    }
    const body = {
      ...form,
      subtitle: form.subtitle?.trim() || null,
      link_url: form.link_url?.trim() || null,
      cta_label: form.cta_label?.trim() || null,
      sort_order: Number(form.sort_order) || 100,
      starts_at: toIso(form.starts_at),
      ends_at: toIso(form.ends_at),
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminApi.cmsBanners.update(id, body);
        toast.success("Banner updated");
      } else {
        await adminApi.cmsBanners.create(body);
        toast.success("Banner created");
      }
      navigate("/admin/banners");
    } catch (err) {
      showApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground" data-testid="banner-form-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-4xl space-y-6" data-testid="banner-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/banners")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">{isEdit ? "Edit" : "New"}</Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">{isEdit ? form.title || "Banner" : "Add banner"}</h1>
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" data-testid="banner-form-save">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Save changes" : "Create banner"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="rounded-3xl lg:col-span-2">
          <CardContent className="space-y-4 p-6">
            <Field label="Title *">
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} required data-testid="banner-form-title" />
            </Field>
            <Field label="Subtitle">
              <Input value={form.subtitle} onChange={(e) => set("subtitle", e.target.value)} data-testid="banner-form-subtitle" />
            </Field>
            <Field label="Image URL *">
              <Input
                value={form.image_url}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://..."
                required
                data-testid="banner-form-image"
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Link URL">
                <Input
                  value={form.link_url}
                  onChange={(e) => set("link_url", e.target.value)}
                  placeholder="/medicines or https://..."
                  data-testid="banner-form-link"
                />
              </Field>
              <Field label="CTA label">
                <Input
                  value={form.cta_label}
                  onChange={(e) => set("cta_label", e.target.value)}
                  placeholder="Shop now"
                  data-testid="banner-form-cta"
                />
              </Field>
            </div>
            {form.image_url && (
              <div className="rounded-2xl border border-border bg-muted/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Preview</div>
                <div className="mt-2 overflow-hidden rounded-xl bg-muted">
                  <img src={form.image_url} alt="" className="max-h-48 w-full object-cover"
                    onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-display text-lg font-semibold">Placement</h3>
              <Field label="Position">
                <Select value={form.position} onValueChange={(v) => set("position", v)}>
                  <SelectTrigger data-testid="banner-form-position"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sort order">
                <Input
                  type="number" min="0"
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                  data-testid="banner-form-sort"
                />
              </Field>
            </CardContent>
          </Card>

          <Card className="rounded-3xl">
            <CardContent className="space-y-4 p-6">
              <h3 className="font-display text-lg font-semibold">Schedule</h3>
              <Field label="Starts at (optional)">
                <Input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => set("starts_at", e.target.value)}
                  data-testid="banner-form-starts"
                />
              </Field>
              <Field label="Ends at (optional)">
                <Input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => set("ends_at", e.target.value)}
                  data-testid="banner-form-ends"
                />
              </Field>
              <div className="flex items-center justify-between rounded-2xl border border-border p-3">
                <div>
                  <div className="text-sm font-semibold">Active</div>
                  <div className="text-xs text-muted-foreground">Off = banner hidden everywhere</div>
                </div>
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} data-testid="banner-form-active" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </form>
  );
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);
