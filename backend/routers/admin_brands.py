"""Admin CMS — Brands (Phase 3)."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action
from utils.slug import slugify

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-brands"])


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


class BrandIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    description: Optional[str] = None
    logo_url: Optional[str] = None
    website: Optional[str] = None
    sort_order: int = 100
    is_active: bool = True


async def _unique_slug(db, base: str, doc_id: Optional[str]) -> str:
    candidate = base
    suffix = (doc_id or uuid.uuid4().hex)[:6]
    for attempt in range(6):
        existing = await db.brands.find_one({"slug": candidate, "id": {"$ne": doc_id}}, {"id": 1})
        if not existing:
            return candidate
        candidate = f"{base}-{suffix}" if attempt == 0 else f"{base}-{suffix}-{attempt}"
    return f"{base}-{uuid.uuid4().hex[:4]}"


@router.get("/brands")
async def list_brands(request: Request, q: Optional[str] = None, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    query: dict = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    docs = await db.brands.find(query, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(500)
    # Attach medicines_count per brand for the list table.
    ids = [d["id"] for d in docs]
    counts: dict = {}
    if ids:
        async for c in db.medicines.aggregate([
            {"$match": {"brand_id": {"$in": ids}}},
            {"$group": {"_id": "$brand_id", "n": {"$sum": 1}}},
        ]):
            counts[c["_id"]] = c["n"]
    for d in docs:
        d["medicines_count"] = counts.get(d["id"], 0)
    return {"items": docs, "total": len(docs)}


@router.get("/brands/{brand_id}")
async def get_brand(brand_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    b = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Brand not found")
    return b


@router.post("/brands")
async def create_brand(body: BrandIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    new_id = "b-" + uuid.uuid4().hex[:8]
    slug = await _unique_slug(db, slugify(body.name), new_id)
    now = _now_iso()
    doc = {
        "id": new_id,
        **body.model_dump(),
        "slug": slug,
        "created_at": now,
        "updated_at": now,
    }
    await db.brands.insert_one(doc)
    await log_admin_action(db, user, "create", "brand", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/brands/{brand_id}")
async def update_brand(brand_id: str, body: BrandIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Brand not found")
    update = body.model_dump()
    update["slug"] = existing.get("slug") or await _unique_slug(db, slugify(body.name), brand_id)
    update["updated_at"] = _now_iso()
    await db.brands.update_one({"id": brand_id}, {"$set": update})
    await log_admin_action(db, user, "update", "brand", brand_id, before=existing, after=update)
    return await db.brands.find_one({"id": brand_id}, {"_id": 0})


@router.delete("/brands/{brand_id}")
async def delete_brand(brand_id: str, request: Request, hard: bool = False, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.brands.find_one({"id": brand_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Brand not found")
    if hard:
        med_count = await db.medicines.count_documents({"brand_id": brand_id})
        if med_count > 0:
            raise HTTPException(409, f"{med_count} medicines reference this brand. Deactivate it instead.")
        await db.brands.delete_one({"id": brand_id})
    else:
        await db.brands.update_one({"id": brand_id}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "brand", brand_id, before=existing, meta={"hard": hard})
    return {"deleted": True, "id": brand_id, "hard": hard}
