"""Admin CMS — Homepage CMS (Phase 3).

Composes the public homepage from re-orderable "blocks". Each block has:
- `type`: hero_banner | featured_categories | trending_medicines |
          banner_strip | brands_strip | custom_html
- `title`: optional admin-facing label / public heading
- `config`: arbitrary JSON object tailored to the block type
- `sort_order`, `is_active`

The storefront's `Landing.jsx` will (in a later commit) hit
`GET /api/homepage` and render blocks in order with type-specific
components.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-homepage"])

ALLOWED_TYPES = {
    "hero_banner",
    "featured_categories",
    "trending_medicines",
    "banner_strip",
    "brands_strip",
    "custom_html",
}


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


class BlockIn(BaseModel):
    type: str
    title: Optional[str] = None
    config: dict[str, Any] = Field(default_factory=dict)
    sort_order: int = 100
    is_active: bool = True


@router.get("/homepage")
async def list_blocks(request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    docs = await db.homepage_blocks.find({}, {"_id": 0}).sort([("sort_order", 1)]).to_list(500)
    return {"items": docs, "allowed_types": sorted(list(ALLOWED_TYPES))}


@router.get("/homepage/{block_id}")
async def get_block(block_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    b = await db.homepage_blocks.find_one({"id": block_id}, {"_id": 0})
    if not b:
        raise HTTPException(404, "Block not found")
    return b


@router.post("/homepage")
async def create_block(body: BlockIn, request: Request, user: dict = Depends(_get_admin_user)):
    if body.type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unknown block type '{body.type}'")
    db = _db(request)
    new_id = "hb-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.homepage_blocks.insert_one(doc)
    await log_admin_action(db, user, "create", "homepage_block", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/homepage/{block_id}")
async def update_block(block_id: str, body: BlockIn, request: Request, user: dict = Depends(_get_admin_user)):
    if body.type not in ALLOWED_TYPES:
        raise HTTPException(400, f"Unknown block type '{body.type}'")
    db = _db(request)
    existing = await db.homepage_blocks.find_one({"id": block_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Block not found")
    update = body.model_dump()
    update["updated_at"] = _now_iso()
    await db.homepage_blocks.update_one({"id": block_id}, {"$set": update})
    await log_admin_action(db, user, "update", "homepage_block", block_id, before=existing, after=update)
    return await db.homepage_blocks.find_one({"id": block_id}, {"_id": 0})


@router.delete("/homepage/{block_id}")
async def delete_block(block_id: str, request: Request, hard: bool = False, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    existing = await db.homepage_blocks.find_one({"id": block_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Block not found")
    if hard:
        await db.homepage_blocks.delete_one({"id": block_id})
    else:
        await db.homepage_blocks.update_one(
            {"id": block_id},
            {"$set": {"is_active": False, "updated_at": _now_iso()}},
        )
    await log_admin_action(db, user, "delete", "homepage_block", block_id, before=existing, meta={"hard": hard})
    return {"deleted": True, "id": block_id, "hard": hard}


class ReorderIn(BaseModel):
    ids: list[str]


@router.post("/homepage/reorder")
async def reorder_blocks(body: ReorderIn, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    updated = 0
    for idx, bid in enumerate(body.ids):
        r = await db.homepage_blocks.update_one(
            {"id": bid},
            {"$set": {"sort_order": (idx + 1) * 10, "updated_at": _now_iso()}},
        )
        updated += r.modified_count
    await log_admin_action(db, user, "reorder", "homepage_block", None, meta={"ids": body.ids})
    return {"updated": updated}
