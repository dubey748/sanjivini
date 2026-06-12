import React, { useEffect, useState } from "react";
import {
  Layout, Plus, Trash2, ArrowUp, ArrowDown, Loader2, Save, Pencil,
  X as XIcon, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

// Block-type metadata: label, helper, default config.
const TYPES = {
  hero_banner:         { label: "Hero banner",         help: "Pull banner(s) tagged position=hero",            defaults: { position: "hero" } },
  featured_categories: { label: "Featured categories", help: "Category tiles (uses sort_order)",                defaults: { limit: 8 } },
  trending_medicines:  { label: "Trending medicines",  help: "Top medicines (optionally filtered by category)", defaults: { limit: 8, category: null } },
  banner_strip:        { label: "Banner strip",        help: "Pull banner(s) tagged position=mid",              defaults: { position: "mid" } },
  brands_strip:        { label: "Brands strip",        help: "Active brands carousel",                          defaults: { limit: 10 } },
  custom_html:         { label: "Custom HTML",         help: "Free-form HTML block (no scripts)",               defaults: { html: "<p>Hello</p>" } },
};

export default function HomepageCMS() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);   // block being edited (modal)
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setItems(null);
    adminApi.cmsHomepage.list()
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err, "Failed to load blocks"); });
  };
  useEffect(reload, []); // eslint-disable-line

  const move = async (idx, dir) => {
    if (!items) return;
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
    try {
      await adminApi.cmsHomepage.reorder(next.map((b) => b.id));
      toast.success("Reordered");
    } catch (err) {
      showApiError(err, "Reorder failed");
      reload();
    }
  };

  const handleSave = async (block) => {
    setSaving(true);
    try {
      if (block.id) {
        await adminApi.cmsHomepage.update(block.id, {
          type: block.type, title: block.title, config: block.config,
          sort_order: block.sort_order, is_active: block.is_active,
        });
        toast.success("Block updated");
      } else {
        await adminApi.cmsHomepage.create({
          type: block.type, title: block.title, config: block.config,
          sort_order: block.sort_order, is_active: block.is_active,
        });
        toast.success("Block added");
      }
      setEditing(null);
      reload();
    } catch (err) {
      showApiError(err, "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsHomepage.remove(item.id, hard);
      toast.success(hard ? "Block permanently deleted" : "Block hidden");
      setDeleteTarget(null);
      reload();
    } catch (err) { showApiError(err, "Delete failed"); }
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-homepage-cms">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <Layout className="mr-1.5 h-3 w-3" /> Content
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Homepage CMS</h1>
          <p className="text-sm text-muted-foreground">
            Compose the storefront homepage from re-orderable blocks.
          </p>
        </div>
        <Button
          onClick={() => setEditing({
            id: null, type: "trending_medicines",
            title: "Trending now", config: { limit: 8 },
            sort_order: ((items?.[items.length - 1]?.sort_order ?? 0) + 10),
            is_active: true,
          })}
          className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
          data-testid="hb-new"
        >
          <Plus className="mr-1.5 h-4 w-4" /> Add block
        </Button>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="p-0">
          {items === null && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {items && items.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">
              No homepage blocks yet. The storefront will fall back to its built-in default layout.
            </div>
          )}
          {items && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((b, idx) => (
                <li key={b.id} className="flex items-center gap-3 p-4" data-testid={`hb-row-${b.id}`}>
                  <div className="flex flex-col">
                    <Button type="button" size="icon" variant="ghost" disabled={idx === 0} onClick={() => move(idx, -1)} data-testid={`hb-up-${b.id}`}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" disabled={idx === items.length - 1} onClick={() => move(idx, +1)} data-testid={`hb-down-${b.id}`}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#0F4C3A]/10 text-xs font-bold text-[#0F4C3A]">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">{TYPES[b.type]?.label || b.type}</Badge>
                      <span className="font-semibold">{b.title || "(untitled)"}</span>
                      {b.is_active === false && (
                        <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">Hidden</Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{JSON.stringify(b.config || {}).slice(0, 90)}</code>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(b)} data-testid={`hb-edit-${b.id}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-rose-600" onClick={() => setDeleteTarget(b)} data-testid={`hb-delete-${b.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <div className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {items?.length || 0} block(s) · drag arrows on the left to reorder
          </div>
        </CardContent>
      </Card>

      <BlockEditor
        key={editing?.id || (editing ? "new" : "closed")}
        open={!!editing}
        block={editing}
        saving={saving}
        onCancel={() => setEditing(null)}
        onSave={handleSave}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="hb-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete block?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.title || deleteTarget?.type}</strong>
              <br />Hide keeps the row but removes from storefront. Permanently delete cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)} data-testid="hb-delete-soft">
              Hide
            </Button>
            <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => handleDelete(deleteTarget, true)} data-testid="hb-delete-hard">
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BlockEditor({ open, block, saving, onCancel, onSave }) {
  const [form, setForm] = useState(block || {});

  if (!open || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setConfig = (k, v) => setForm((f) => ({ ...f, config: { ...(f.config || {}), [k]: v } }));

  const switchType = (t) => {
    setForm((f) => ({ ...f, type: t, config: { ...TYPES[t].defaults } }));
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl" data-testid="hb-editor">
        <DialogHeader>
          <DialogTitle>{form.id ? "Edit block" : "Add block"}</DialogTitle>
          <DialogDescription>Configure the block then save to update the homepage.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Block type">
              <Select value={form.type} onValueChange={switchType}>
                <SelectTrigger data-testid="hb-editor-type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">{TYPES[form.type]?.help}</p>
            </Field>
            <Field label="Sort order">
              <Input
                type="number" min="0"
                value={form.sort_order ?? 100}
                onChange={(e) => set("sort_order", Number(e.target.value) || 0)}
                data-testid="hb-editor-sort"
              />
            </Field>
          </div>
          <Field label="Title (public heading)">
            <Input
              value={form.title || ""}
              onChange={(e) => set("title", e.target.value)}
              data-testid="hb-editor-title"
            />
          </Field>

          <TypeConfigEditor type={form.type} config={form.config || {}} onChange={setConfig} />

          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div>
              <div className="text-sm font-semibold">Active</div>
              <div className="text-xs text-muted-foreground">Off = block hidden on storefront</div>
            </div>
            <Switch
              checked={form.is_active !== false}
              onCheckedChange={(v) => set("is_active", v)}
              data-testid="hb-editor-active"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}><XIcon className="mr-1.5 h-4 w-4" /> Cancel</Button>
          <Button
            disabled={saving}
            onClick={() => onSave(form)}
            className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
            data-testid="hb-editor-save"
          >
            {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Save className="mr-1.5 h-4 w-4" />}
            Save block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TypeConfigEditor({ type, config, onChange }) {
  if (type === "hero_banner" || type === "banner_strip") {
    return (
      <Field label="Banner position">
        <Select
          value={config.position || (type === "hero_banner" ? "hero" : "mid")}
          onValueChange={(v) => onChange("position", v)}
        >
          <SelectTrigger data-testid="hb-cfg-position"><SelectValue /></SelectTrigger>
          <SelectContent>
            {["hero", "mid", "sidebar", "footer", "popup"].map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    );
  }
  if (type === "featured_categories" || type === "brands_strip") {
    return (
      <Field label="Max items">
        <Input
          type="number" min="1" max="50"
          value={config.limit ?? 8}
          onChange={(e) => onChange("limit", Number(e.target.value) || 8)}
          data-testid="hb-cfg-limit"
        />
      </Field>
    );
  }
  if (type === "trending_medicines") {
    return (
      <>
        <Field label="Max items">
          <Input
            type="number" min="1" max="50"
            value={config.limit ?? 8}
            onChange={(e) => onChange("limit", Number(e.target.value) || 8)}
            data-testid="hb-cfg-limit"
          />
        </Field>
        <Field label="Category id (optional, e.g. c-fever)">
          <Input
            value={config.category || ""}
            onChange={(e) => onChange("category", e.target.value || null)}
            placeholder="leave empty for all"
            data-testid="hb-cfg-category"
          />
        </Field>
      </>
    );
  }
  if (type === "custom_html") {
    return (
      <Field label="HTML">
        <Textarea
          rows={6}
          value={config.html || ""}
          onChange={(e) => onChange("html", e.target.value)}
          placeholder="<div>...</div>"
          data-testid="hb-cfg-html"
        />
      </Field>
    );
  }
  return null;
}

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);
