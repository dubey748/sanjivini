"""Admin CMS — Phase 4 Pharmacies + per-pharmacy Inventory.

Endpoints:
  /api/admin/cms/pharmacies              CRUD + approval workflow
  /api/admin/cms/pharmacies/{id}/inventory  upsert per-pharmacy stock/price
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-pharmacies"])

_DEFAULT_HOURS = {d: {"open": "09:00", "close": "22:00", "closed": False}
                  for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}

APPROVAL_STATES = {"pending", "approved", "rejected"}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _admin(request: Request):
    from server import get_current_user  # type: ignore
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return user


def _db(request: Request):
    from server import db  # type: ignore
    return db


class HourCfg(BaseModel):
    open: Optional[str] = "09:00"
    close: Optional[str] = "22:00"
    closed: bool = False


class PharmacyIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    owner_name: Optional[str] = None
    license_no: Optional[str] = None
    gst_number: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = "Mumbai"
    state: Optional[str] = "Maharashtra"
    pincode: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    delivery_radius_km: float = Field(default=5.0, ge=0, le=50)
    operating_hours: dict = Field(default_factory=lambda: _DEFAULT_HOURS)
    dark_store: bool = False
    is_active: bool = True
    rating: Optional[float] = Field(default=None, ge=0, le=5)


class ApprovalIn(BaseModel):
    decision: str   # "approve" | "reject"
    reason: Optional[str] = None


@router.get("/pharmacies")
async def list_pharmacies(request: Request, q: Optional[str] = None,
                          approval_status: Optional[str] = None,
                          user: dict = Depends(_admin)):
    db = _db(request)
    query: dict = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"pincode": {"$regex": q, "$options": "i"}},
        ]
    if approval_status:
        query["approval_status"] = approval_status
    items = await db.pharmacies.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    return {"items": items, "total": len(items)}


@router.get("/pharmacies/stats")
async def pharmacy_stats(request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    total = await db.pharmacies.count_documents({})
    pending = await db.pharmacies.count_documents({"approval_status": "pending"})
    approved = await db.pharmacies.count_documents({"approval_status": "approved"})
    rejected = await db.pharmacies.count_documents({"approval_status": "rejected"})
    active = await db.pharmacies.count_documents({"is_active": True})
    return {"total": total, "pending": pending, "approved": approved,
            "rejected": rejected, "active": active}


@router.get("/pharmacies/{pid}")
async def get_pharmacy(pid: str, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    p = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    if not p:
        raise HTTPException(404, "Pharmacy not found")
    return p


@router.post("/pharmacies")
async def create_pharmacy(body: PharmacyIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    new_id = "p-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {
        "id": new_id,
        **body.model_dump(),
        "approval_status": "pending",
        "approved_by": None, "approved_at": None, "rejection_reason": None,
        "created_at": now, "updated_at": now,
    }
    await db.pharmacies.insert_one(doc)
    await log_admin_action(db, user, "create", "pharmacy", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/pharmacies/{pid}")
async def update_pharmacy(pid: str, body: PharmacyIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Pharmacy not found")
    update = body.model_dump()
    update["updated_at"] = _now_iso()
    await db.pharmacies.update_one({"id": pid}, {"$set": update})
    await log_admin_action(db, user, "update", "pharmacy", pid, before=existing, after=update)
    return await db.pharmacies.find_one({"id": pid}, {"_id": 0})


@router.delete("/pharmacies/{pid}")
async def delete_pharmacy(pid: str, request: Request, hard: bool = False, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Pharmacy not found")
    if hard:
        order_count = await db.orders.count_documents({"pharmacy_id": pid})
        if order_count > 0:
            raise HTTPException(409, f"{order_count} orders reference this pharmacy. Deactivate instead.")
        await db.pharmacies.delete_one({"id": pid})
        await db.pharmacy_inventory.delete_many({"pharmacy_id": pid})
    else:
        await db.pharmacies.update_one({"id": pid}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "pharmacy", pid, before=existing, meta={"hard": hard})
    return {"deleted": True, "id": pid, "hard": hard}


@router.post("/pharmacies/{pid}/approval")
async def set_approval(pid: str, body: ApprovalIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.pharmacies.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Pharmacy not found")
    decision = body.decision.lower()
    if decision == "approve":
        update = {"approval_status": "approved", "approved_by": user.get("id"),
                  "approved_at": _now_iso(), "rejection_reason": None,
                  "updated_at": _now_iso()}
    elif decision == "reject":
        update = {"approval_status": "rejected", "rejection_reason": body.reason or "Rejected by admin",
                  "approved_by": user.get("id"), "approved_at": _now_iso(),
                  "is_active": False, "updated_at": _now_iso()}
    else:
        raise HTTPException(400, "decision must be 'approve' or 'reject'")
    await db.pharmacies.update_one({"id": pid}, {"$set": update})
    await log_admin_action(db, user, "approval", "pharmacy", pid, before=existing, after=update)
    return await db.pharmacies.find_one({"id": pid}, {"_id": 0})


# ----- Per-pharmacy Inventory ---------------------------------------------

class InventoryRow(BaseModel):
    medicine_id: str
    stock: int = Field(ge=0, default=0)
    price_override: Optional[float] = Field(default=None, ge=0)
    low_stock_threshold: int = Field(default=10, ge=0)
    is_active: bool = True


@router.get("/pharmacies/{pid}/inventory")
async def list_inventory(pid: str, request: Request,
                         only_low_stock: bool = False,
                         user: dict = Depends(_admin)):
    db = _db(request)
    # Join: walk medicines, attach inventory row if present.
    inv_docs = await db.pharmacy_inventory.find({"pharmacy_id": pid}, {"_id": 0}).to_list(5000)
    inv_by_med = {d["medicine_id"]: d for d in inv_docs}
    meds = await db.medicines.find(
        {"is_active": {"$ne": False}},
        {"_id": 0, "id": 1, "name": 1, "category": 1, "price": 1, "stock": 1,
         "prescription_required": 1, "image": 1, "images": 1},
    ).sort("name", 1).to_list(2000)
    rows = []
    for m in meds:
        inv = inv_by_med.get(m["id"])
        stock = inv["stock"] if inv else m.get("stock", 0)
        thresh = inv["low_stock_threshold"] if inv else 10
        if only_low_stock and stock > thresh:
            continue
        rows.append({
            "medicine_id": m["id"],
            "name": m["name"], "category": m.get("category"),
            "default_price": m.get("price"),
            "image": (m.get("images") or [None])[0] or m.get("image"),
            "stock": stock,
            "price_override": inv.get("price_override") if inv else None,
            "low_stock_threshold": thresh,
            "is_active": inv.get("is_active", True) if inv else True,
            "has_override": bool(inv),
        })
    return {"items": rows, "total": len(rows)}


@router.put("/pharmacies/{pid}/inventory")
async def upsert_inventory(pid: str, body: InventoryRow, request: Request,
                           user: dict = Depends(_admin)):
    db = _db(request)
    pharm = await db.pharmacies.find_one({"id": pid}, {"id": 1})
    if not pharm:
        raise HTTPException(404, "Pharmacy not found")
    med = await db.medicines.find_one({"id": body.medicine_id}, {"id": 1, "name": 1})
    if not med:
        raise HTTPException(400, "Unknown medicine_id")
    now = _now_iso()
    doc = {
        "pharmacy_id": pid, "medicine_id": body.medicine_id,
        "stock": body.stock, "price_override": body.price_override,
        "low_stock_threshold": body.low_stock_threshold,
        "is_active": body.is_active,
        "updated_at": now,
    }
    await db.pharmacy_inventory.update_one(
        {"pharmacy_id": pid, "medicine_id": body.medicine_id},
        {"$set": doc, "$setOnInsert": {"id": "pi-" + uuid.uuid4().hex[:8], "created_at": now}},
        upsert=True,
    )
    await log_admin_action(db, user, "inventory_upsert", "pharmacy_inventory",
                           pid, after={**doc, "medicine_name": med.get("name")})
    return {"ok": True, **doc}
