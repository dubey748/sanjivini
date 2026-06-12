import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Image as ImageIcon, Plus, Pencil, Trash2, Loader2, AlertTriangle,
  MoreHorizontal, Calendar,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

const POSITIONS = [
  { value: "all", label: "All positions" },
  { value: "hero", label: "Hero" },
  { value: "mid", label: "Mid" },
  { value: "sidebar", label: "Sidebar" },
  { value: "footer", label: "Footer" },
  { value: "popup", label: "Popup" },
];

const fmtDate = (s) => (s ? new Date(s).toLocaleString() : "—");

export default function BannerList() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [position, setPosition] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => {
    setItems(null);
    adminApi.cmsBanners.list(position === "all" ? {} : { position })
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err, "Failed to load banners"); });
  };
  useEffect(reload, [position]); // eslint-disable-line

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsBanners.remove(item.id, hard);
      toast.success(hard ? "Banner permanently deleted" : "Banner deactivated");
      setDeleteTarget(null);
      reload();
    } catch (err) { showApiError(err, "Delete failed"); }
  };

  return (
    <div className="mx-auto max-w-6xl" data-testid="admin-banner-list">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <ImageIcon className="mr-1.5 h-3 w-3" /> Content
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Banners</h1>
          <p className="text-sm text-muted-foreground">
            Schedule promotional banners for hero / mid / sidebar / footer positions.
          </p>
        </div>
        <Button
          onClick={() => navigate("/admin/banners/new")}
          className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
          data-testid="banner-new"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New banner
        </Button>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="flex items-center gap-2 p-4">
          <span className="text-xs uppercase tracking-wider text-muted-foreground">Filter</span>
          <Select value={position} onValueChange={setPosition}>
            <SelectTrigger className="w-48 rounded-full" data-testid="banner-filter-position"><SelectValue /></SelectTrigger>
            <SelectContent>
              {POSITIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card className="mt-4 rounded-3xl overflow-hidden">
        <CardContent className="p-0">
          {items === null && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {items && items.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No banners for this position.</div>
          )}
          {items && items.length > 0 && (
            <div className="divide-y divide-border">
              {items.map((b) => (
                <div key={b.id} className="flex items-center gap-4 p-4" data-testid={`banner-row-${b.id}`}>
                  <div className="h-20 w-32 shrink-0 overflow-hidden rounded-xl bg-muted">
                    {b.image_url ? (
                      <img src={b.image_url} alt="" className="h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.opacity = 0.2; }} />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">{b.position}</Badge>
                      <span className="font-semibold">{b.title}</span>
                      {b.is_active === false && (
                        <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">Inactive</Badge>
                      )}
                    </div>
                    {b.subtitle && <div className="text-xs text-muted-foreground">{b.subtitle}</div>}
                    <div className="mt-1 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      {b.link_url && <span>→ {b.link_url}</span>}
                      {(b.starts_at || b.ends_at) && (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {fmtDate(b.starts_at)} → {fmtDate(b.ends_at)}
                        </span>
                      )}
                      <span>sort: {b.sort_order}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`banner-actions-${b.id}`}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/admin/banners/${b.id}/edit`)}>
                        <Pencil className="mr-2 h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => setDeleteTarget(b)}>
                        <Trash2 className="mr-2 h-4 w-4" /> Delete…
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="banner-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete banner?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.title}</strong>
              <br />Deactivate hides it from the storefront. Permanently delete cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)} data-testid="banner-delete-soft">
              Deactivate
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleDelete(deleteTarget, true)}
              data-testid="banner-delete-hard"
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
