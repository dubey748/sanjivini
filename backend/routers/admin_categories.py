"""Admin CMS — Categories + Subcategories (Phase 3).

A subcategory is just a category with a non-null `parent_id`. The same
collection is used for both, so the storefront can render an N-level
hierarchy if needed (we expose a 2-level tree by default).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action
from utils.slug import slugify

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-categories"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_admin_user(request: Request):
    from server import get_current_user  # type: ignore
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def _db(request: Request):
    from server import db  # type: ignore
    return db


class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    icon: Optional[str] = None          # lucide-react icon name (e.g. "Pill")
    image_url: Optional[str] = None
    parent_id: Optional[str] = None     # None = top-level
    sort_order: int = 100
    is_active: bool = True


async def _ensure_unique_slug(db, base: str, doc_id: Optional[str]) -> str:
    candidate = base
    suffix = (doc_id or uuid.uuid4().hex)[:6]
    for attempt in range(6):
        existing = await db.categories.find_one(
            {"slug": candidate, "id": {"$ne": doc_id}}, {"id": 1},
        )
        if not existing:
            return candidate
        candidate = f"{base}-{suffix}" if attempt == 0 else f"{base}-{suffix}-{attempt}"
    return f"{base}-{uuid.uuid4().hex[:4]}"


def _strip(doc: dict) -> dict:
    if doc:
        doc.pop("_id", None)
    return doc


# ----- List ----------------------------------------------------------------

@router.get("/categories")
async def list_categories(
    request: Request,
    parent_id: Optional[str] = None,
    include_inactive: bool = True,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    query: dict = {}
    if parent_id is not None:
        # Accept the string "null" to filter top-level explicitly.
        query["parent_id"] = None if parent_id in ("", "null", "root") else parent_id
    if not include_inactive:
        query["is_active"] = {"$ne": False}
    docs = await db.categories.find(query, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(500)
    # Embed children count for quick UI badges.
    parent_ids = [d["id"] for d in docs if d.get("parent_id") is None]
    counts: dict = {}
    if parent_ids:
        async for c in db.categories.aggregate([
            {"$match": {"parent_id": {"$in": parent_ids}}},
            {"$group": {"_id": "$parent_id", "n": {"$sum": 1}}},
        ]):
            counts[c["_id"]] = c["n"]
    for d in docs:
        d["children_count"] = counts.get(d["id"], 0)
    return {"items": docs, "total": len(docs)}


@router.get("/categories/tree")
async def categories_tree(request: Request, user: dict = Depends(_get_admin_user)):
    """Two-level tree: top-level categories with their subcategories embedded."""
    db = _db(request)
    docs = await db.categories.find({}, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(500)
    by_parent: dict = {}
    for d in docs:
        by_parent.setdefault(d.get("parent_id"), []).append(d)
    roots = by_parent.get(None, [])
    for r in roots:
        r["children"] = by_parent.get(r["id"], [])
    return {"items": roots}


@router.get("/categories/{cat_id}")
async def get_category(cat_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    c = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not c:
        raise HTTPException(404, "Category not found")
    return c


# ----- Create / Update / Delete --------------------------------------------

@router.post("/categories")
async def create_category(body: CategoryIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    if body.parent_id:
        parent = await db.categories.find_one({"id": body.parent_id}, {"id": 1, "parent_id": 1})
        if not parent:
            raise HTTPException(400, f"Unknown parent_id '{body.parent_id}'")
        if parent.get("parent_id"):
            raise HTTPException(400, "Nesting beyond 2 levels not supported")

    new_id = "c-" + uuid.uuid4().hex[:8] if not body.parent_id else "sc-" + uuid.uuid4().hex[:8]
    slug = await _ensure_unique_slug(db, slugify(body.name), new_id)
    now = _now_iso()
    doc = {
        "id": new_id,
        "name": body.name,
        "description": body.description,
        "icon": body.icon,
        "image_url": body.image_url,
        "parent_id": body.parent_id,
        "sort_order": body.sort_order,
        "is_active": body.is_active,
        "slug": slug,
        "created_at": now,
        "updated_at": now,
    }
    await db.categories.insert_one(doc)
    await log_admin_action(db, user, "create", "category", new_id, after=doc)
    return _strip(doc)


@router.put("/categories/{cat_id}")
async def update_category(cat_id: str, body: CategoryIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Category not found")
    if body.parent_id and body.parent_id == cat_id:
        raise HTTPException(400, "A category cannot be its own parent")
    if body.parent_id:
        parent = await db.categories.find_one({"id": body.parent_id}, {"id": 1, "parent_id": 1})
        if not parent:
            raise HTTPException(400, f"Unknown parent_id '{body.parent_id}'")
        if parent.get("parent_id"):
            raise HTTPException(400, "Nesting beyond 2 levels not supported")

    update = body.model_dump()
    update["slug"] = existing.get("slug") or await _ensure_unique_slug(db, slugify(body.name), cat_id)
    update["updated_at"] = _now_iso()
    await db.categories.update_one({"id": cat_id}, {"$set": update})
    await log_admin_action(db, user, "update", "category", cat_id, before=existing, after=update)
    new_doc = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    return new_doc


@router.delete("/categories/{cat_id}")
async def delete_category(cat_id: str, request: Request, hard: bool = False, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.categories.find_one({"id": cat_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Category not found")

    # Guard: don't allow hard-delete if children OR medicines reference it.
    child_count = await db.categories.count_documents({"parent_id": cat_id})
    med_count = await db.medicines.count_documents({"category": cat_id})
    if hard and (child_count > 0 or med_count > 0):
        raise HTTPException(
            409,
            f"Cannot permanently delete — {child_count} subcategories and {med_count} medicines reference this category. Deactivate it instead.",
        )

    if hard:
        await db.categories.delete_one({"id": cat_id})
    else:
        await db.categories.update_one({"id": cat_id}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "category", cat_id, before=existing, meta={"hard": hard})
    return {"deleted": True, "id": cat_id, "hard": hard}


# ----- Reorder -------------------------------------------------------------

class ReorderIn(BaseModel):
    ids: list[str]   # full ordered list at one level


@router.post("/categories/reorder")
async def reorder_categories(body: ReorderIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    if not body.ids:
        return {"updated": 0}
    updated = 0
    for idx, cid in enumerate(body.ids):
        r = await db.categories.update_one(
            {"id": cid},
            {"$set": {"sort_order": (idx + 1) * 10, "updated_at": _now_iso()}},
        )
        updated += r.modified_count
    await log_admin_action(db, user, "reorder", "category", None, meta={"ids": body.ids})
    return {"updated": updated}
