import React, { useEffect, useState, useCallback } from "react";
import {
  MapPin, Plus, Pencil, Trash2, Loader2, AlertTriangle, MoreHorizontal,
  Building, Map as MapIcon, Hash, CheckCircle2, XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

export default function ServiceAreas() {
  const [tab, setTab] = useState("cities");
  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-service-areas">
      <div>
        <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
          <MapPin className="mr-1.5 h-3 w-3" /> Operations
        </Badge>
        <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Service Areas</h1>
        <p className="text-sm text-muted-foreground">Cities, zones, and serviceable pincodes for delivery coverage.</p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="rounded-full">
          <TabsTrigger value="cities" className="rounded-full" data-testid="tab-cities">
            <Building className="mr-1.5 h-3.5 w-3.5" /> Cities
          </TabsTrigger>
          <TabsTrigger value="zones" className="rounded-full" data-testid="tab-zones">
            <MapIcon className="mr-1.5 h-3.5 w-3.5" /> Zones
          </TabsTrigger>
          <TabsTrigger value="pincodes" className="rounded-full" data-testid="tab-pincodes">
            <Hash className="mr-1.5 h-3.5 w-3.5" /> Pincodes
          </TabsTrigger>
          <TabsTrigger value="coverage" className="rounded-full" data-testid="tab-coverage">Coverage check</TabsTrigger>
        </TabsList>

        <TabsContent value="cities" className="mt-4"><CitiesPane /></TabsContent>
        <TabsContent value="zones" className="mt-4"><ZonesPane /></TabsContent>
        <TabsContent value="pincodes" className="mt-4"><PincodesPane /></TabsContent>
        <TabsContent value="coverage" className="mt-4"><CoveragePane /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== CITIES ==============

function CitiesPane() {
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const reload = useCallback(() => {
    setItems(null);
    adminApi.cmsGeo.cities.list().then((r) => setItems(r.items || [])).catch((err) => { setItems([]); showApiError(err); });
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const handleSave = async (b) => {
    try {
      if (b.id) await adminApi.cmsGeo.cities.update(b.id, b);
      else await adminApi.cmsGeo.cities.create(b);
      toast.success(b.id ? "Updated" : "Created");
      setEditing(null);
      reload();
    } catch (err) { showApiError(err); }
  };
  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsGeo.cities.remove(item.id, hard);
      toast.success("Done");
      setDeleteTarget(null); reload();
    } catch (err) { showApiError(err); }
  };

  return (
    <>
      <ActionBar onAdd={() => setEditing({ name: "", state: "", sort_order: 100, is_active: true })} testid="city" />
      <Card className="mt-3 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && <Spinner />}
          {items && items.length === 0 && <Empty msg="No cities yet." />}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="city-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">City</th><th className="px-4 py-3">State</th><th className="px-4 py-3 text-right">Zones</th><th className="px-4 py-3 text-right">Pincodes</th><th className="px-4 py-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <tr key={c.id} className="border-t border-border" data-testid={`city-row-${c.id}`}>
                    <td className="px-4 py-3 font-semibold">{c.name}</td>
                    <td className="px-4 py-3 text-xs">{c.state || "—"}</td>
                    <td className="px-4 py-3 text-right text-xs">{c.zones_count}</td>
                    <td className="px-4 py-3 text-right text-xs">{c.pincodes_count}</td>
                    <td className="px-4 py-3">{c.is_active ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Active</Badge> : <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu onEdit={() => setEditing(c)} onDelete={() => setDeleteTarget(c)} testid={`city-${c.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <CityEditor open={!!editing} city={editing} onCancel={() => setEditing(null)} onSave={handleSave} key={editing?.id || (editing ? "new-city" : "closed-city")} />
      <DeleteDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onDelete={handleDelete} label="city" />
    </>
  );
}

function CityEditor({ open, city, onCancel, onSave }) {
  const [form, setForm] = useState(city || {});
  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="city-editor">
        <DialogHeader><DialogTitle>{form.id ? "Edit city" : "New city"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="City name *"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="city-editor-name" /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="State"><Input value={form.state || ""} onChange={(e) => set("state", e.target.value)} data-testid="city-editor-state" /></Field>
            <Field label="Sort order"><Input type="number" min="0" value={form.sort_order ?? 100} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} /></Field>
          </div>
          <ActiveSwitch checked={form.is_active !== false} onChange={(v) => set("is_active", v)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" onClick={() => onSave(form)} data-testid="city-editor-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== ZONES ==============

function ZonesPane() {
  const [cities, setCities] = useState([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { adminApi.cmsGeo.cities.list().then((r) => setCities(r.items || [])).catch(() => {}); }, []);

  const reload = useCallback(() => {
    setItems(null);
    adminApi.cmsGeo.zones.list(cityFilter === "all" ? undefined : cityFilter)
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err); });
  }, [cityFilter]);
  useEffect(() => { reload(); }, [reload]);

  const handleSave = async (b) => {
    try {
      if (b.id) await adminApi.cmsGeo.zones.update(b.id, b);
      else await adminApi.cmsGeo.zones.create(b);
      toast.success(b.id ? "Updated" : "Created");
      setEditing(null); reload();
    } catch (err) { showApiError(err); }
  };
  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsGeo.zones.remove(item.id, hard);
      toast.success("Done");
      setDeleteTarget(null); reload();
    } catch (err) { showApiError(err); }
  };
  const cityName = (id) => cities.find((c) => c.id === id)?.name || id;

  return (
    <>
      <div className="flex items-center justify-between">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-56 rounded-full" data-testid="zone-filter-city"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button onClick={() => setEditing({ name: "", city_id: cityFilter === "all" ? (cities[0]?.id || "") : cityFilter, sort_order: 100, is_active: true })}
          className="rounded-full bg-[#0F4C3A] text-white" data-testid="zone-new">
          <Plus className="mr-1.5 h-4 w-4" /> New zone
        </Button>
      </div>
      <Card className="mt-3 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && <Spinner />}
          {items && items.length === 0 && <Empty msg="No zones." />}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="zone-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Zone</th><th className="px-4 py-3">City</th><th className="px-4 py-3 text-right">Pincodes</th><th className="px-4 py-3">Status</th><th /></tr>
              </thead>
              <tbody>
                {items.map((z) => (
                  <tr key={z.id} className="border-t border-border" data-testid={`zone-row-${z.id}`}>
                    <td className="px-4 py-3 font-semibold">{z.name}</td>
                    <td className="px-4 py-3 text-xs">{cityName(z.city_id)}</td>
                    <td className="px-4 py-3 text-right text-xs">{z.pincodes_count}</td>
                    <td className="px-4 py-3">{z.is_active ? <Badge className="rounded-full bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15">Active</Badge> : <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">Inactive</Badge>}</td>
                    <td className="px-4 py-3 text-right">
                      <RowMenu onEdit={() => setEditing(z)} onDelete={() => setDeleteTarget(z)} testid={`zone-${z.id}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <ZoneEditor open={!!editing} zone={editing} cities={cities} onCancel={() => setEditing(null)} onSave={handleSave} key={editing?.id || (editing ? "new-zone" : "closed-zone")} />
      <DeleteDialog target={deleteTarget} onCancel={() => setDeleteTarget(null)} onDelete={handleDelete} label="zone" />
    </>
  );
}

function ZoneEditor({ open, zone, cities, onCancel, onSave }) {
  const [form, setForm] = useState(zone || {});
  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="zone-editor">
        <DialogHeader><DialogTitle>{form.id ? "Edit zone" : "New zone"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Zone name *"><Input value={form.name || ""} onChange={(e) => set("name", e.target.value)} data-testid="zone-editor-name" /></Field>
          <Field label="City *">
            <Select value={form.city_id || ""} onValueChange={(v) => set("city_id", v)}>
              <SelectTrigger data-testid="zone-editor-city"><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Sort order"><Input type="number" min="0" value={form.sort_order ?? 100} onChange={(e) => set("sort_order", Number(e.target.value) || 0)} /></Field>
          <ActiveSwitch checked={form.is_active !== false} onChange={(v) => set("is_active", v)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" onClick={() => onSave(form)} data-testid="zone-editor-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== PINCODES ==============

function PincodesPane() {
  const [cities, setCities] = useState([]);
  const [zones, setZones] = useState([]);
  const [cityFilter, setCityFilter] = useState("all");
  const [items, setItems] = useState(null);
  const [editing, setEditing] = useState(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  useEffect(() => { adminApi.cmsGeo.cities.list().then((r) => setCities(r.items || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (cityFilter === "all") { setZones([]); return; }
    adminApi.cmsGeo.zones.list(cityFilter).then((r) => setZones(r.items || [])).catch(() => {});
  }, [cityFilter]);

  const reload = useCallback(() => {
    setItems(null);
    adminApi.cmsGeo.pincodes.list(cityFilter === "all" ? {} : { city_id: cityFilter })
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err); });
  }, [cityFilter]);
  useEffect(() => { reload(); }, [reload]);

  const cityName = (id) => cities.find((c) => c.id === id)?.name || id;
  const zoneName = (id) => zones.find((z) => z.id === id)?.name || (id || "—");

  const handleSave = async (b) => {
    try {
      if (b.id) await adminApi.cmsGeo.pincodes.update(b.id, b);
      else await adminApi.cmsGeo.pincodes.create(b);
      toast.success(b.id ? "Updated" : "Created");
      setEditing(null); reload();
    } catch (err) { showApiError(err); }
  };

  const handleBulk = async (codes, city_id, zone_id) => {
    try {
      const res = await adminApi.cmsGeo.pincodes.bulk({ codes, city_id, zone_id: zone_id || null });
      toast.success(`Added ${res.created} (${res.skipped} skipped)`);
      setBulkOpen(false); reload();
    } catch (err) { showApiError(err); }
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-56 rounded-full" data-testid="pin-filter-city"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All cities</SelectItem>
            {cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setBulkOpen(true)} data-testid="pin-bulk-open">
            Bulk add
          </Button>
          <Button onClick={() => setEditing({ code: "", city_id: cityFilter === "all" ? (cities[0]?.id || "") : cityFilter, zone_id: null, is_active: true, is_serviceable: true })}
            className="rounded-full bg-[#0F4C3A] text-white" data-testid="pin-new">
            <Plus className="mr-1.5 h-4 w-4" /> New pincode
          </Button>
        </div>
      </div>
      <Card className="mt-3 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && <Spinner />}
          {items && items.length === 0 && <Empty msg="No pincodes." />}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="pin-table">
              <thead className="bg-muted text-[10px] uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-4 py-3">Pincode</th><th className="px-4 py-3">City</th><th className="px-4 py-3">Zone</th><th className="px-4 py-3">Serviceable</th><th className="px-4 py-3">Active</th></tr>
              </thead>
              <tbody>
                {items.map((p) => (
                  <tr key={p.id} className="border-t border-border" data-testid={`pin-row-${p.id}`}>
                    <td className="px-4 py-3 font-mono font-semibold">{p.code}</td>
                    <td className="px-4 py-3 text-xs">{cityName(p.city_id)}</td>
                    <td className="px-4 py-3 text-xs">{zoneName(p.zone_id)}</td>
                    <td className="px-4 py-3 text-xs">{p.is_serviceable ? "✅" : "—"}</td>
                    <td className="px-4 py-3 text-xs">{p.is_active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <PincodeEditor open={!!editing} item={editing} cities={cities} onCancel={() => setEditing(null)} onSave={handleSave} key={editing?.id || (editing ? "new-pin" : "closed-pin")} />
      <BulkPinDialog open={bulkOpen} cities={cities} onCancel={() => setBulkOpen(false)} onSave={handleBulk} />
    </>
  );
}

function PincodeEditor({ open, item, cities, onCancel, onSave }) {
  const [form, setForm] = useState(item || {});
  const [zones, setZones] = useState([]);
  useEffect(() => {
    if (form.city_id) adminApi.cmsGeo.zones.list(form.city_id).then((r) => setZones(r.items || [])).catch(() => {});
  }, [form.city_id]);
  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="pin-editor">
        <DialogHeader><DialogTitle>{form.id ? "Edit pincode" : "New pincode"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Field label="Pincode *"><Input value={form.code || ""} onChange={(e) => set("code", e.target.value)} data-testid="pin-editor-code" /></Field>
          <Field label="City *">
            <Select value={form.city_id || ""} onValueChange={(v) => set("city_id", v)}>
              <SelectTrigger data-testid="pin-editor-city"><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Zone (optional)">
            <Select value={form.zone_id || "__none__"} onValueChange={(v) => set("zone_id", v === "__none__" ? null : v)}>
              <SelectTrigger data-testid="pin-editor-zone"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center justify-between rounded-2xl border border-border p-3">
            <div className="text-sm font-semibold">Serviceable</div>
            <Switch checked={form.is_serviceable !== false} onCheckedChange={(v) => set("is_serviceable", v)} />
          </div>
          <ActiveSwitch checked={form.is_active !== false} onChange={(v) => set("is_active", v)} />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90" onClick={() => onSave(form)} data-testid="pin-editor-save">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BulkPinDialog({ open, cities, onCancel, onSave }) {
  const [city_id, setCity] = useState("");
  const [zone_id, setZone] = useState("");
  const [zones, setZones] = useState([]);
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) { setCity(""); setZone(""); setText(""); setZones([]); }
  }, [open]); // eslint-disable-line
  useEffect(() => {
    if (city_id) adminApi.cmsGeo.zones.list(city_id).then((r) => setZones(r.items || [])).catch(() => {});
  }, [city_id]);
  if (!open) return null;
  const codes = text.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent data-testid="pin-bulk-dialog">
        <DialogHeader>
          <DialogTitle>Bulk add pincodes</DialogTitle>
          <DialogDescription>Comma- or newline-separated. Existing pincodes are skipped.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="City *">
            <Select value={city_id} onValueChange={setCity}>
              <SelectTrigger data-testid="pin-bulk-city"><SelectValue placeholder="Select city" /></SelectTrigger>
              <SelectContent>{cities.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Zone (optional)">
            <Select value={zone_id || "__none__"} onValueChange={(v) => setZone(v === "__none__" ? "" : v)}>
              <SelectTrigger data-testid="pin-bulk-zone"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— None —</SelectItem>
                {zones.map((z) => <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Pincodes (${codes.length} parsed)`}>
            <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="400058, 400059&#10;400060" data-testid="pin-bulk-text" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button
            disabled={!city_id || codes.length === 0}
            className="bg-[#0F4C3A] hover:bg-[#0F4C3A]/90"
            onClick={() => onSave(codes, city_id, zone_id)}
            data-testid="pin-bulk-save"
          >
            Add {codes.length}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============== COVERAGE CHECK ==============

function CoveragePane() {
  const [pin, setPin] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const check = async (e) => {
    e?.preventDefault?.();
    setLoading(true);
    try { setResult(await adminApi.cmsGeo.coverage(pin)); }
    catch (err) { showApiError(err); setResult(null); }
    finally { setLoading(false); }
  };
  return (
    <Card className="rounded-3xl">
      <CardContent className="space-y-4 p-6">
        <form onSubmit={check} className="flex items-center gap-2">
          <Input value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter pincode" className="max-w-xs rounded-full" data-testid="coverage-input" />
          <Button type="submit" disabled={!pin || loading} className="rounded-full bg-[#0F4C3A] text-white" data-testid="coverage-check">
            {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null} Check coverage
          </Button>
        </form>
        {result && (
          <div className="space-y-2 rounded-2xl border border-border p-4" data-testid="coverage-result">
            <div className="flex items-center gap-2">
              {result.serviceable
                ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                : <XCircle className="h-5 w-5 text-rose-600" />}
              <span className="font-semibold">{result.serviceable ? "Serviceable" : "Not serviceable"}</span>
              {!result.serviceable && <Badge className="ml-2 rounded-full bg-muted text-muted-foreground hover:bg-muted">{result.reason}</Badge>}
            </div>
            {result.pharmacies?.length > 0 && (
              <div>
                <div className="mt-2 text-xs uppercase tracking-wider text-muted-foreground">Pharmacies covering this pincode</div>
                <ul className="mt-1 space-y-1 text-sm">
                  {result.pharmacies.map((p) => (
                    <li key={p.id}>• {p.name} <span className="text-xs text-muted-foreground">(radius {p.delivery_radius_km}km)</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============== SHARED HELPERS ==============

const Spinner = () => <div className="flex h-48 items-center justify-center text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>;
const Empty = ({ msg }) => <div className="p-10 text-center text-muted-foreground">{msg}</div>;

const ActionBar = ({ onAdd, testid }) => (
  <div className="flex items-center justify-end">
    <Button onClick={onAdd} className="rounded-full bg-[#0F4C3A] text-white" data-testid={`${testid}-new`}>
      <Plus className="mr-1.5 h-4 w-4" /> New {testid}
    </Button>
  </div>
);

const Field = ({ label, children }) => (
  <div>
    <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
    <div className="mt-1.5">{children}</div>
  </div>
);

const ActiveSwitch = ({ checked, onChange }) => (
  <div className="flex items-center justify-between rounded-2xl border border-border p-3">
    <div className="text-sm font-semibold">Active</div>
    <Switch checked={checked} onCheckedChange={onChange} />
  </div>
);

const RowMenu = ({ onEdit, onDelete, testid }) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="icon" data-testid={`${testid}-actions`}><MoreHorizontal className="h-4 w-4" /></Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onClick={onEdit}><Pencil className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
      <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={onDelete}><Trash2 className="mr-2 h-4 w-4" /> Delete…</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

const DeleteDialog = ({ target, onCancel, onDelete, label }) => (
  <Dialog open={!!target} onOpenChange={(o) => !o && onCancel()}>
    <DialogContent data-testid={`${label}-delete-dialog`}>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" /> Delete {label}?</DialogTitle>
        <DialogDescription><strong>{target?.name || target?.code}</strong> — deactivate hides it, permanent delete only when no references.</DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2">
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        <Button variant="outline" onClick={() => onDelete(target, false)}>Deactivate</Button>
        <Button className="bg-rose-600 hover:bg-rose-700" onClick={() => onDelete(target, true)}>Permanently delete</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
