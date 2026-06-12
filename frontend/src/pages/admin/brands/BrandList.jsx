import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bookmark, Plus, Pencil, Trash2, Loader2, AlertTriangle, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

export default function BrandList() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => {
    setItems(null);
    adminApi.cmsBrands.list({ q: q || undefined })
      .then((r) => setItems(r.items || []))
      .catch((err) => { setItems([]); showApiError(err, "Failed to load brands"); });
  };
  useEffect(reload, [q]); // eslint-disable-line

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsBrands.remove(item.id, hard);
      toast.success(hard ? "Brand permanently deleted" : "Brand deactivated");
      setDeleteTarget(null);
      reload();
    } catch (err) { showApiError(err, "Delete failed"); }
  };

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-brand-list">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <Bookmark className="mr-1.5 h-3 w-3" /> Catalog
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Brands</h1>
          <p className="text-sm text-muted-foreground">Manage pharmaceutical & wellness brands.</p>
        </div>
        <Button
          onClick={() => navigate("/admin/brands/new")}
          className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
          data-testid="brand-new"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New brand
        </Button>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="p-4">
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); setQ(qDraft); }}
          >
            <Input
              value={qDraft}
              onChange={(e) => setQDraft(e.target.value)}
              placeholder="Search brands..."
              className="rounded-full"
              data-testid="brand-search-input"
            />
            <Button type="submit" className="rounded-full bg-[#0F4C3A] text-white" data-testid="brand-search-submit">
              Search
            </Button>
          </form>
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
            <div className="p-10 text-center text-muted-foreground">No brands yet.</div>
          )}
          {items && items.length > 0 && (
            <table className="min-w-full text-left text-sm" data-testid="brand-table">
              <thead className="bg-muted text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3 text-right">Medicines</th>
                  <th className="px-4 py-3 text-right">Sort</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-t border-border" data-testid={`brand-row-${b.id}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-muted">
                          {b.logo_url ? (
                            <img src={b.logo_url} alt="" className="h-full w-full object-contain"
                              onError={(e) => { e.currentTarget.style.display = "none"; }} />
                          ) : <Bookmark className="h-4 w-4 text-muted-foreground" />}
                        </div>
                        <div>
                          <div className="font-semibold">{b.name}</div>
                          <div className="text-xs text-muted-foreground">
                            <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{b.id}</code>
                            {b.website ? ` · ${b.website}` : ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right text-xs">{b.medicines_count ?? 0}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground">{b.sort_order}</td>
                    <td className="px-4 py-3">
                      {b.is_active === false
                        ? <Badge className="rounded-full bg-muted text-muted-foreground hover:bg-muted">Inactive</Badge>
                        : <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">Active</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`brand-actions-${b.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/admin/brands/${b.id}/edit`)}>
                            <Pencil className="mr-2 h-4 w-4" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => setDeleteTarget(b)}>
                            <Trash2 className="mr-2 h-4 w-4" /> Delete…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="brand-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete brand?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong>
              <br />Deactivate hides it. Permanently delete only if no medicines reference it.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)} data-testid="brand-delete-soft">
              Deactivate
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleDelete(deleteTarget, true)}
              data-testid="brand-delete-hard"
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
