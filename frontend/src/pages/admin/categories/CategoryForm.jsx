import React, { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
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

const EMPTY = {
  name: "", description: "", icon: "", image_url: "",
  parent_id: null, sort_order: 100, is_active: true,
};

export default function CategoryForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState({ ...EMPTY, parent_id: searchParams.get("parent") || null });
  const [parents, setParents] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.cmsCategories.tree().then((r) => {
      setParents((r.items || []).filter((c) => !id || c.id !== id));
    }).catch(() => {});
    if (!isEdit) return;
    adminApi.cmsCategories.get(id)
      .then((c) => setForm({
        name: c.name || "", description: c.description || "", icon: c.icon || "",
        image_url: c.image_url || "", parent_id: c.parent_id || null,
        sort_order: c.sort_order ?? 100, is_active: c.is_active !== false,
      }))
      .catch((err) => showApiError(err, "Failed to load category"))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Name is required"); return; }
    const body = {
      ...form,
      icon: form.icon?.trim() || null,
      image_url: form.image_url?.trim() || null,
      description: form.description?.trim() || null,
      sort_order: Number(form.sort_order) || 100,
      parent_id: form.parent_id || null,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await adminApi.cmsCategories.update(id, body);
        toast.success("Category updated");
      } else {
        await adminApi.cmsCategories.create(body);
        toast.success("Category created");
      }
      navigate("/admin/categories");
    } catch (err) {
      showApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-muted-foreground" data-testid="cat-form-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  const isSub = !!form.parent_id;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6" data-testid="cat-form">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button type="button" variant="ghost" size="icon" onClick={() => navigate("/admin/categories")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
              {isEdit ? "Edit" : isSub ? "New subcategory" : "New category"}
            </Badge>
            <h1 className="font-display mt-1 text-2xl font-bold">{isEdit ? form.name || "Category" : isSub ? "Add subcategory" : "Add category"}</h1>
          </div>
        </div>
        <Button type="submit" disabled={saving} className="rounded-full bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" data-testid="cat-form-save">
          {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
          {isEdit ? "Save changes" : "Create"}
        </Button>
      </div>

      <Card className="rounded-3xl">
        <CardContent className="space-y-4 p-6">
          <Field label="Name *">
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} required data-testid="cat-form-name" />
          </Field>
          <Field label="Description">
            <Textarea
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Short blurb shown on the storefront category page"
              data-testid="cat-form-description"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Parent category (leave empty for top-level)">
              <Select
                value={form.parent_id || "__none__"}
                onValueChange={(v) => set("parent_id", v === "__none__" ? null : v)}
              >
                <SelectTrigger data-testid="cat-form-parent">
                  <SelectValue placeholder="Top-level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Top-level —</SelectItem>
                  {parents.filter((p) => !p.parent_id).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Sort order">
              <Input
                type="number" min="0"
                value={form.sort_order}
                onChange={(e) => set("sort_order", e.target.value)}
                data-testid="cat-form-sort"
              />
            </Field>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Icon (lucide-react name)">
              <Input
                value={form.icon}
                onChange={(e) => set("icon", e.target.value)}
                placeholder="e.g. Pill, Heart, Activity"
                data-testid="cat-form-icon"
              />
            </Field>
            <Field label="Image URL">
              <Input
                value={form.image_url}
                onChange={(e) => set("image_url", e.target.value)}
                placeholder="https://..."
                data-testid="cat-form-image"
              />
            </Field>
          </div>
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <div className="text-sm font-semibold">Active</div>
              <div className="text-xs text-muted-foreground">Inactive categories hide from the storefront</div>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} data-testid="cat-form-active" />
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
