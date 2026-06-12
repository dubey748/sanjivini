"""Admin CMS — Medicine management (Phase 2).

Requires `role == 'admin'`. Reuses the existing auth machinery from
`server.py` via a thin dependency. All mutations are written to the
audit_log.
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action
from utils.slug import slugify

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-medicines"])


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


# ----- Models ---------------------------------------------------------------

class MedicineIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    brand: Optional[str] = None
    composition: str = Field(min_length=1, max_length=300)
    category: str = Field(min_length=1)
    price: float = Field(ge=0)
    mrp: Optional[float] = Field(default=None, ge=0)
    pack: Optional[str] = None
    prescription_required: bool = False
    stock: int = Field(default=0, ge=0)
    symptoms: Optional[str] = None
    manufacturer: Optional[str] = None
    images: list[str] = []
    sku: Optional[str] = None
    hsn_code: Optional[str] = None
    gst_pct: Optional[float] = Field(default=None, ge=0, le=100)
    discount_pct: Optional[float] = Field(default=0, ge=0, le=100)
    tags: list[str] = []
    is_active: bool = True
    subcategory_id: Optional[str] = None
    brand_id: Optional[str] = None


class BulkPriceIn(BaseModel):
    ids: Optional[list[str]] = None       # if provided, only these medicines
    category: Optional[str] = None        # else by category
    only_active: bool = True
    mode: str = Field(default="percent")  # 'percent' | 'fixed' | 'set'
    value: float
    target: str = Field(default="price")  # 'price' | 'mrp' | 'discount_pct'


class BulkStockIn(BaseModel):
    ids: Optional[list[str]] = None
    category: Optional[str] = None
    only_active: bool = True
    mode: str = Field(default="set")      # 'set' | 'delta'
    value: int


# ----- Helpers --------------------------------------------------------------

async def _category_index(db) -> dict:
    """Map lowercase id/name → canonical id."""
    out: dict = {}
    async for c in db.categories.find({}, {"id": 1, "name": 1}):
        if c.get("id"):
            out[c["id"].lower()] = c["id"]
        if c.get("name"):
            out[c["name"].lower()] = c["id"]
    return out


async def _ensure_unique_slug(db, base: str, doc_id: str) -> str:
    candidate = base
    suffix = (doc_id or "").replace("-", "")[:6]
    for attempt in range(6):
        existing = await db.medicines.find_one({"slug": candidate, "id": {"$ne": doc_id}}, {"id": 1})
        if not existing:
            return candidate
        candidate = f"{base}-{suffix}" if attempt == 0 else f"{base}-{suffix}-{attempt}"
    return f"{base}-{suffix}-{uuid.uuid4().hex[:4]}"


def _strip_mongo(doc: dict) -> dict:
    if doc and "_id" in doc:
        doc.pop("_id", None)
    return doc


# ----- List -----------------------------------------------------------------

@router.get("/medicines")
async def list_medicines(
    request: Request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    prescription_required: Optional[bool] = None,
    low_stock: Optional[bool] = None,
    sort: str = Query(default="-updated_at"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=200),
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    query: dict = {}
    if q:
        rx = {"$regex": q, "$options": "i"}
        query["$or"] = [
            {"name": rx}, {"composition": rx}, {"brand": rx},
            {"symptoms": rx}, {"sku": rx}, {"manufacturer": rx},
        ]
    if category:
        query["category"] = category
    if is_active is not None:
        query["is_active"] = is_active
    if prescription_required is not None:
        query["prescription_required"] = prescription_required
    if low_stock:
        query["stock"] = {"$lte": 10}

    total = await db.medicines.count_documents(query)
    sort_field = sort.lstrip("-") or "updated_at"
    sort_dir = -1 if sort.startswith("-") else 1
    cursor = (
        db.medicines.find(query, {"_id": 0})
        .sort(sort_field, sort_dir)
        .skip((page - 1) * page_size)
        .limit(page_size)
    )
    items = await cursor.to_list(page_size)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": items,
        "low_stock_count": await db.medicines.count_documents({"stock": {"$lte": 10}, "is_active": True}),
    }


@router.get("/medicines/stats")
async def medicines_stats(request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    total = await db.medicines.count_documents({})
    active = await db.medicines.count_documents({"is_active": True})
    out_of_stock = await db.medicines.count_documents({"stock": {"$lte": 0}})
    low_stock = await db.medicines.count_documents({"stock": {"$gt": 0, "$lte": 10}})
    rx_only = await db.medicines.count_documents({"prescription_required": True})
    return {
        "total": total,
        "active": active,
        "inactive": total - active,
        "out_of_stock": out_of_stock,
        "low_stock": low_stock,
        "rx_only": rx_only,
    }


@router.get("/medicines/{medicine_id}")
async def get_medicine(medicine_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    doc = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Medicine not found")
    return doc


# ----- Create ---------------------------------------------------------------

@router.post("/medicines")
async def create_medicine(
    body: MedicineIn,
    request: Request,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)

    # Resolve / validate category
    cat_idx = await _category_index(db)
    cat_id = cat_idx.get(body.category.lower())
    if not cat_id:
        raise HTTPException(400, f"Unknown category '{body.category}'")

    # Duplicate detection
    if body.sku:
        clash = await db.medicines.find_one({"sku": body.sku}, {"id": 1, "name": 1})
        if clash:
            raise HTTPException(409, f"SKU '{body.sku}' already exists on '{clash.get('name')}'")
    name_clash = await db.medicines.find_one({
        "name": {"$regex": f"^{re.escape(body.name)}$", "$options": "i"},
        "composition": {"$regex": f"^{re.escape(body.composition)}$", "$options": "i"},
        "pack": body.pack,
    }, {"id": 1})
    if name_clash:
        raise HTTPException(409, f"Medicine '{body.name}' with same composition+pack already exists")

    new_id = str(uuid.uuid4())
    base_slug = slugify(body.name)
    slug = await _ensure_unique_slug(db, base_slug, new_id)

    doc = body.model_dump()
    doc["category"] = cat_id
    doc["id"] = new_id
    doc["slug"] = slug
    doc["image"] = body.images[0] if body.images else None
    doc["mrp"] = body.mrp if body.mrp is not None else body.price
    doc["updated_at"] = _now_iso()
    doc["created_at"] = doc["updated_at"]
    await db.medicines.insert_one(doc)
    await log_admin_action(db, user, "create", "medicine", new_id, before=None, after=doc)
    return _strip_mongo(doc)


# ----- Update ---------------------------------------------------------------

@router.put("/medicines/{medicine_id}")
async def update_medicine(
    medicine_id: str,
    body: MedicineIn,
    request: Request,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    existing = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Medicine not found")

    cat_idx = await _category_index(db)
    cat_id = cat_idx.get(body.category.lower())
    if not cat_id:
        raise HTTPException(400, f"Unknown category '{body.category}'")

    # SKU clash with another medicine
    if body.sku:
        clash = await db.medicines.find_one(
            {"sku": body.sku, "id": {"$ne": medicine_id}}, {"id": 1, "name": 1},
        )
        if clash:
            raise HTTPException(409, f"SKU '{body.sku}' already used by '{clash.get('name')}'")

    new_doc = body.model_dump()
    new_doc["category"] = cat_id
    new_doc["image"] = body.images[0] if body.images else None
    new_doc["mrp"] = body.mrp if body.mrp is not None else body.price
    new_doc["id"] = medicine_id
    new_doc["slug"] = existing.get("slug") or await _ensure_unique_slug(db, slugify(body.name), medicine_id)
    new_doc["updated_at"] = _now_iso()
    new_doc["created_at"] = existing.get("created_at", new_doc["updated_at"])

    await db.medicines.update_one({"id": medicine_id}, {"$set": new_doc})
    await log_admin_action(db, user, "update", "medicine", medicine_id, before=existing, after=new_doc)
    return new_doc


# ----- Delete (soft by default) --------------------------------------------

@router.delete("/medicines/{medicine_id}")
async def delete_medicine(
    medicine_id: str,
    request: Request,
    hard: bool = False,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    existing = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Medicine not found")

    if hard:
        await db.medicines.delete_one({"id": medicine_id})
        await log_admin_action(db, user, "delete_hard", "medicine", medicine_id, before=existing)
        return {"deleted": True, "id": medicine_id, "hard": True}

    await db.medicines.update_one(
        {"id": medicine_id},
        {"$set": {"is_active": False, "updated_at": _now_iso()}},
    )
    await log_admin_action(db, user, "delete_soft", "medicine", medicine_id,
                           before=existing, after={"is_active": False})
    return {"deleted": True, "id": medicine_id, "hard": False}


# ----- Bulk price -----------------------------------------------------------

def _build_bulk_filter(ids, category, only_active) -> dict:
    q: dict = {}
    if ids:
        q["id"] = {"$in": ids}
    if category:
        q["category"] = category
    if only_active:
        q["is_active"] = True
    return q


@router.post("/medicines/bulk/price")
async def bulk_price(body: BulkPriceIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    if body.mode not in {"percent", "fixed", "set"}:
        raise HTTPException(400, "mode must be percent | fixed | set")
    if body.target not in {"price", "mrp", "discount_pct"}:
        raise HTTPException(400, "target must be price | mrp | discount_pct")

    flt = _build_bulk_filter(body.ids, body.category, body.only_active)
    affected = await db.medicines.count_documents(flt)
    if affected == 0:
        return {"matched": 0, "updated": 0}

    now = _now_iso()
    updated = 0

    if body.mode == "set":
        new_val = round(max(0.0, float(body.value)), 2)
        r = await db.medicines.update_many(
            flt, {"$set": {body.target: new_val, "updated_at": now}},
        )
        updated = r.modified_count
    else:
        async for doc in db.medicines.find(flt, {"id": 1, body.target: 1}):
            current = float(doc.get(body.target) or 0)
            if body.mode == "percent":
                new_val = current * (1 + body.value / 100.0)
            else:  # fixed
                new_val = current + body.value
            new_val = round(max(0.0, new_val), 2)
            await db.medicines.update_one(
                {"id": doc["id"]},
                {"$set": {body.target: new_val, "updated_at": now}},
            )
            updated += 1

    await log_admin_action(db, user, "bulk_price", "medicine", None,
                           meta={"filter": flt, "mode": body.mode, "value": body.value,
                                 "target": body.target, "updated": updated})
    return {"matched": affected, "updated": updated}


# ----- Bulk stock -----------------------------------------------------------

@router.post("/medicines/bulk/stock")
async def bulk_stock(body: BulkStockIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    if body.mode not in {"set", "delta"}:
        raise HTTPException(400, "mode must be set | delta")

    flt = _build_bulk_filter(body.ids, body.category, body.only_active)
    affected = await db.medicines.count_documents(flt)
    if affected == 0:
        return {"matched": 0, "updated": 0}
    now = _now_iso()

    if body.mode == "set":
        new_val = max(0, int(body.value))
        r = await db.medicines.update_many(flt, {"$set": {"stock": new_val, "updated_at": now}})
        updated = r.modified_count
    else:
        updated = 0
        async for doc in db.medicines.find(flt, {"id": 1, "stock": 1}):
            new_val = max(0, int(doc.get("stock") or 0) + int(body.value))
            await db.medicines.update_one(
                {"id": doc["id"]},
                {"$set": {"stock": new_val, "updated_at": now}},
            )
            updated += 1

    await log_admin_action(db, user, "bulk_stock", "medicine", None,
                           meta={"filter": flt, "mode": body.mode, "value": body.value, "updated": updated})
    return {"matched": affected, "updated": updated}
