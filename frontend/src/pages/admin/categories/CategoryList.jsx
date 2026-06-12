import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Tag, Plus, Pencil, Trash2, Loader2, ChevronRight, ChevronDown,
  AlertTriangle, MoreHorizontal, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { adminApi, showApiError } from "@/lib/adminApi";

export default function CategoryList() {
  const navigate = useNavigate();
  const [tree, setTree] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [deleteTarget, setDeleteTarget] = useState(null);

  const reload = () => {
    setTree(null);
    adminApi.cmsCategories.tree()
      .then((r) => setTree(r.items || []))
      .catch((err) => { setTree([]); showApiError(err, "Failed to load categories"); });
  };
  useEffect(reload, []); // eslint-disable-line

  const toggle = (id) => {
    const next = new Set(expanded);
    next.has(id) ? next.delete(id) : next.add(id);
    setExpanded(next);
  };

  const handleDelete = async (item, hard) => {
    try {
      await adminApi.cmsCategories.remove(item.id, hard);
      toast.success(hard ? "Category permanently deleted" : "Category deactivated");
      setDeleteTarget(null);
      reload();
    } catch (err) { showApiError(err, "Delete failed"); }
  };

  const total = useMemo(() => {
    if (!tree) return 0;
    return tree.reduce((acc, r) => acc + 1 + (r.children?.length || 0), 0);
  }, [tree]);

  return (
    <div className="mx-auto max-w-5xl" data-testid="admin-category-list">
      <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <Badge className="rounded-full bg-[#0F4C3A]/10 text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
            <Tag className="mr-1.5 h-3 w-3" /> Catalog
          </Badge>
          <h1 className="font-display mt-2 text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-sm text-muted-foreground">
            Manage top-level catalog sections and their subcategories. Sort order controls storefront display.
          </p>
        </div>
        <Button
          onClick={() => navigate("/admin/categories/new")}
          className="rounded-full bg-[#0F4C3A] text-white hover:bg-[#0F4C3A]/90"
          data-testid="cat-new"
        >
          <Plus className="mr-1.5 h-4 w-4" /> New category
        </Button>
      </div>

      <Card className="mt-6 rounded-3xl">
        <CardContent className="p-0">
          {tree === null && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {tree && tree.length === 0 && (
            <div className="p-10 text-center text-muted-foreground">No categories yet.</div>
          )}
          {tree && tree.length > 0 && (
            <ul className="divide-y divide-border">
              {tree.map((r) => {
                const open = expanded.has(r.id);
                const kids = r.children || [];
                return (
                  <React.Fragment key={r.id}>
                    <CategoryRow
                      item={r} depth={0}
                      expanded={expanded} onToggle={toggle}
                      onEdit={(i) => navigate(`/admin/categories/${i.id}/edit`)}
                      onDelete={(i) => setDeleteTarget(i)}
                      onAddSub={(i) => navigate(`/admin/categories/new?parent=${i.id}`)}
                    />
                    {open && kids.map((child) => (
                      <CategoryRow
                        key={child.id} item={child} depth={1}
                        expanded={expanded} onToggle={toggle}
                        onEdit={(i) => navigate(`/admin/categories/${i.id}/edit`)}
                        onDelete={(i) => setDeleteTarget(i)}
                        onAddSub={() => {}}
                      />
                    ))}
                  </React.Fragment>
                );
              })}
            </ul>
          )}
          <div className="border-t border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
            {total} categor{total === 1 ? "y" : "ies"} (including subcategories)
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent data-testid="cat-delete-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" /> Delete category?
            </DialogTitle>
            <DialogDescription>
              <strong>{deleteTarget?.name}</strong>
              <br />Deactivate hides it from the storefront. Permanently delete removes the record
              (only possible if no subcategories or medicines reference it).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => handleDelete(deleteTarget, false)} data-testid="cat-delete-soft">
              Deactivate
            </Button>
            <Button
              className="bg-rose-600 hover:bg-rose-700"
              onClick={() => handleDelete(deleteTarget, true)}
              data-testid="cat-delete-hard"
            >
              Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRow({ item, depth, expanded, onToggle, onEdit, onDelete, onAddSub }) {
  const hasChildren = (item.children || []).length > 0;
  const isOpen = expanded.has(item.id);
  return (
    <>
      <li
        className="flex items-center justify-between gap-3 px-4 py-3"
        style={{ paddingLeft: `${16 + depth * 28}px` }}
        data-testid={`cat-row-${item.id}`}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {depth === 0 ? (
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground hover:bg-muted"
              data-testid={`cat-toggle-${item.id}`}
            >
              {hasChildren ? (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />) : <span className="text-[10px]">—</span>}
            </button>
          ) : (
            <span className="grid h-6 w-6 place-items-center text-muted-foreground">
              <Layers className="h-3 w-3" />
            </span>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{item.name}</span>
              {item.is_active === false && (
                <Badge className="rounded-full bg-muted text-[10px] text-muted-foreground hover:bg-muted">Inactive</Badge>
              )}
              {depth === 0 && hasChildren && (
                <Badge className="rounded-full bg-[#0F4C3A]/10 text-[10px] text-[#0F4C3A] hover:bg-[#0F4C3A]/10">
                  {item.children.length} sub
                </Badge>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              <code className="rounded bg-muted px-1 py-0.5 text-[10px]">{item.id}</code>
              {item.icon ? ` · icon: ${item.icon}` : ""}
              {` · order: ${item.sort_order}`}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {depth === 0 && (
            <Button
              variant="ghost" size="sm" className="text-xs"
              onClick={() => onAddSub(item)}
              data-testid={`cat-add-sub-${item.id}`}
            >
              <Plus className="mr-1 h-3 w-3" /> Sub
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" data-testid={`cat-actions-${item.id}`}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(item)}>
                <Pencil className="mr-2 h-4 w-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-rose-600 focus:text-rose-700" onClick={() => onDelete(item)}>
                <Trash2 className="mr-2 h-4 w-4" /> Delete…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </li>
    </>
  );
}
