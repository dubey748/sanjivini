"""Admin CMS — Banners (Phase 3).

Banners are positioned promotional images shown across the storefront.
Each banner has:
- `position`: one of hero | mid | sidebar | footer | (custom string)
- `image_url`, `link_url`, `title`, `subtitle`, `cta_label`
- `starts_at` / `ends_at` ISO8601 strings (optional schedule)
- `is_active`, `sort_order`
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-banners"])

_POSITIONS = {"hero", "mid", "sidebar", "footer", "popup"}


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


class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=160)
    subtitle: Optional[str] = None
    image_url: str = Field(min_length=1)
    link_url: Optional[str] = None
    cta_label: Optional[str] = None
    position: str = "hero"
    sort_order: int = 100
    starts_at: Optional[str] = None  # ISO datetime; null = always-on start
    ends_at: Optional[str] = None    # ISO datetime; null = always-on end
    is_active: bool = True


@router.get("/banners")
async def list_banners(request: Request, position: Optional[str] = None, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    query: dict = {}
    if position:
        query["position"] = position
    docs = await db.banners.find(query, {"_id": 0}).sort([("position", 1), ("sort_order", 1)]).to_list(500)
    return {"items": docs, "total": len(docs), "positions": sorted(list(_POSITIONS))}


@router.get("/banners/{banner_id}")
async def get_banner(banner_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    b = await db.banners.find_one({"id": banner_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Banner not found")
    return b


@router.post("/banners")
async def create_banner(body: BannerIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    new_id = "bn-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.banners.insert_one(doc)
    await log_admin_action(db, user, "create", "banner", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/banners/{banner_id}")
async def update_banner(banner_id: str, body: BannerIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.banners.find_one({"id": banner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Banner not found")
    update = body.model_dump()
    update["updated_at"] = _now_iso()
    await db.banners.update_one({"id": banner_id}, {"$set": update})
    await log_admin_action(db, user, "update", "banner", banner_id, before=existing, after=update)
    return await db.banners.find_one({"id": banner_id}, {"_id": 0})


@router.delete("/banners/{banner_id}")
async def delete_banner(banner_id: str, request: Request, hard: bool = False, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.banners.find_one({"id": banner_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Banner not found")
    if hard:
        await db.banners.delete_one({"id": banner_id})
    else:
        await db.banners.update_one({"id": banner_id}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "banner", banner_id, before=existing, meta={"hard": hard})
    return {"deleted": True, "id": banner_id, "hard": hard}
