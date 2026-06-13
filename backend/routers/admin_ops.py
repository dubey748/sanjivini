"""Admin CMS — Phase 4 Order management + Rider records + Manual assignment.

Order status canonical set:
  placed → accepted → preparing → ready_for_pickup → out_for_delivery → delivered
  cancelled (terminal from any non-terminal state)

Legacy statuses (from existing seed): `placed`, `confirmed`, `packed` are mapped
on the public tracking endpoint to the new customer-facing milestones.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action

router = APIRouter(prefix="/api/admin", tags=["admin-orders-riders"])

CANONICAL_STATUSES = [
    "placed", "accepted", "preparing", "ready_for_pickup",
    "out_for_delivery", "delivered", "cancelled",
]

# Legacy values still allowed for backward compat — mapped on the customer side.
LEGACY_ALIASES = {"confirmed": "placed", "packed": "preparing"}


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


# ============================================================================
# ORDERS
# ============================================================================

@router.get("/cms/orders")
async def list_orders(request: Request,
                      status: Optional[str] = None,
                      q: Optional[str] = None,
                      pharmacy_id: Optional[str] = None,
                      rider_id: Optional[str] = None,
                      limit: int = 100,
                      user: dict = Depends(_admin)):
    db = _db(request)
    query: dict = {}
    if status and status != "all":
        # Group "active" alias for the "needs attention" tab.
        if status == "active":
            query["status"] = {"$nin": ["delivered", "cancelled"]}
        else:
            query["status"] = status
    if pharmacy_id:
        query["pharmacy_id"] = pharmacy_id
    if rider_id:
        query["rider_id"] = rider_id
    if q:
        query["$or"] = [
            {"order_number": {"$regex": q, "$options": "i"}},
            {"id": {"$regex": q, "$options": "i"}},
        ]
    items = await db.orders.find(query, {"_id": 0}).sort("placed_at", -1).limit(limit).to_list(limit)
    return {"items": items, "total": len(items)}


@router.get("/cms/orders/stats")
async def order_stats(request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    out = {}
    for s in CANONICAL_STATUSES:
        out[s] = await db.orders.count_documents({"status": s})
    out["total"] = await db.orders.count_documents({})
    out["active"] = await db.orders.count_documents({"status": {"$nin": ["delivered", "cancelled"]}})
    # Legacy fold-ins for dashboards
    out["legacy_confirmed"] = await db.orders.count_documents({"status": "confirmed"})
    out["legacy_packed"] = await db.orders.count_documents({"status": "packed"})
    return out


@router.get("/cms/orders/{order_id}")
async def get_order(order_id: str, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    # Attach pharmacy & rider snapshots for the admin view.
    if o.get("pharmacy_id"):
        o["pharmacy"] = await db.pharmacies.find_one({"id": o["pharmacy_id"]}, {"_id": 0})
    if o.get("rider_id"):
        o["rider_record"] = await db.riders.find_one({"id": o["rider_id"]}, {"_id": 0})
    return o


class StatusIn(BaseModel):
    status: str
    note: Optional[str] = None


@router.post("/cms/orders/{order_id}/status")
async def change_status(order_id: str, body: StatusIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    new_status = LEGACY_ALIASES.get(body.status, body.status)
    if new_status not in CANONICAL_STATUSES:
        raise HTTPException(400, f"Unknown status '{body.status}'")
    if o.get("status") in ("delivered", "cancelled") and new_status != o["status"]:
        raise HTTPException(409, f"Order already {o['status']} — cannot change")
    now = _now_iso()
    update: dict = {"status": new_status, "updated_at": now}
    entry = {"status": new_status, "at": now, "actor": user.get("email"), "note": body.note}
    if new_status == "accepted" and not o.get("accepted_at"):
        update["accepted_at"] = now
    if new_status == "out_for_delivery" and not o.get("picked_up_at"):
        update["picked_up_at"] = now
    if new_status == "delivered" and not o.get("delivered_at"):
        update["delivered_at"] = now
    if new_status == "cancelled":
        update["cancelled_at"] = now
        if body.note:
            update["cancellation_reason"] = body.note
    await db.orders.update_one({"id": order_id}, {"$set": update, "$push": {"status_history": entry}})
    await log_admin_action(db, user, "status_change", "order", order_id,
                           before={"status": o.get("status")}, after=entry)
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


class AssignPharmacyIn(BaseModel):
    pharmacy_id: str


@router.post("/cms/orders/{order_id}/assign-pharmacy")
async def assign_pharmacy(order_id: str, body: AssignPharmacyIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    pharm = await db.pharmacies.find_one({"id": body.pharmacy_id}, {"_id": 0})
    if not pharm:
        raise HTTPException(400, "Unknown pharmacy_id")
    update = {"pharmacy_id": pharm["id"], "pharmacy": pharm, "updated_at": _now_iso()}
    await db.orders.update_one({"id": order_id}, {"$set": update})
    await log_admin_action(db, user, "assign_pharmacy", "order", order_id,
                           before={"pharmacy_id": o.get("pharmacy_id")},
                           after={"pharmacy_id": pharm["id"]})
    return await db.orders.find_one({"id": order_id}, {"_id": 0})


# ============================================================================
# RIDERS
# ============================================================================

class RiderIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=6, max_length=20)
    vehicle_no: Optional[str] = None
    license_no: Optional[str] = None
    is_active: bool = True
    current_status: str = "available"   # available | on_delivery | offline


@router.get("/cms/riders")
async def list_riders(request: Request,
                      q: Optional[str] = None,
                      is_active: Optional[bool] = None,
                      current_status: Optional[str] = None,
                      user: dict = Depends(_admin)):
    db = _db(request)
    query: dict = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"phone": {"$regex": q, "$options": "i"}},
            {"vehicle_no": {"$regex": q, "$options": "i"}},
        ]
    if is_active is not None:
        query["is_active"] = is_active
    if current_status:
        query["current_status"] = current_status
    items = await db.riders.find(query, {"_id": 0}).sort("name", 1).to_list(500)
    # Attach quick stats
    ids = [r["id"] for r in items]
    counts = {}
    if ids:
        async for c in db.rider_assignments.aggregate([
            {"$match": {"rider_id": {"$in": ids}, "status": {"$in": ["assigned", "picked_up"]}}},
            {"$group": {"_id": "$rider_id", "n": {"$sum": 1}}},
        ]):
            counts[c["_id"]] = c["n"]
    for r in items:
        r["active_assignments"] = counts.get(r["id"], 0)
    return {"items": items, "total": len(items)}


@router.get("/cms/riders/{rid}")
async def get_rider(rid: str, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    r = await db.riders.find_one({"id": rid}, {"_id": 0})
    if not r:
        raise HTTPException(404, "Rider not found")
    history = await db.rider_assignments.find({"rider_id": rid}, {"_id": 0}).sort("assigned_at", -1).limit(50).to_list(50)
    return {**r, "assignment_history": history}


@router.post("/cms/riders")
async def create_rider(body: RiderIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    new_id = "rd-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.riders.insert_one(doc)
    await log_admin_action(db, user, "create", "rider", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/cms/riders/{rid}")
async def update_rider(rid: str, body: RiderIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.riders.find_one({"id": rid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Rider not found")
    update = {**body.model_dump(), "updated_at": _now_iso()}
    await db.riders.update_one({"id": rid}, {"$set": update})
    await log_admin_action(db, user, "update", "rider", rid, before=existing, after=update)
    return await db.riders.find_one({"id": rid}, {"_id": 0})


@router.delete("/cms/riders/{rid}")
async def delete_rider(rid: str, request: Request, hard: bool = False, user: dict = Depends(_admin)):
    db = _db(request)
    if hard:
        active = await db.rider_assignments.count_documents({"rider_id": rid, "status": {"$in": ["assigned", "picked_up"]}})
        if active > 0:
            raise HTTPException(409, f"Rider has {active} active assignments. Deactivate instead.")
        await db.riders.delete_one({"id": rid})
    else:
        await db.riders.update_one({"id": rid}, {"$set": {"is_active": False, "current_status": "offline", "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "rider", rid, meta={"hard": hard})
    return {"deleted": True, "id": rid, "hard": hard}


class AssignRiderIn(BaseModel):
    order_id: str
    rider_id: str


@router.post("/cms/riders/assign")
async def assign_rider(body: AssignRiderIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    order = await db.orders.find_one({"id": body.order_id}, {"_id": 0})
    if not order:
        raise HTTPException(404, "Order not found")
    rider = await db.riders.find_one({"id": body.rider_id}, {"_id": 0})
    if not rider:
        raise HTTPException(400, "Unknown rider_id")
    if order.get("status") in ("delivered", "cancelled"):
        raise HTTPException(409, f"Order already {order['status']}")
    now = _now_iso()
    # Create assignment row + flip rider status.
    assign_id = "as-" + uuid.uuid4().hex[:8]
    await db.rider_assignments.insert_one({
        "id": assign_id, "order_id": body.order_id, "rider_id": body.rider_id,
        "assigned_by": user.get("id"), "assigned_by_email": user.get("email"),
        "assigned_at": now, "status": "assigned", "completed_at": None,
    })
    await db.orders.update_one(
        {"id": body.order_id},
        {"$set": {
            "rider_id": body.rider_id,
            "rider": {"name": rider["name"], "phone": rider["phone"], "vehicle": rider.get("vehicle_no")},
            "updated_at": now,
        }},
    )
    await db.riders.update_one({"id": body.rider_id}, {"$set": {"current_status": "on_delivery", "updated_at": now}})
    await log_admin_action(db, user, "rider_assign", "order", body.order_id,
                           after={"rider_id": body.rider_id, "assignment_id": assign_id})
    return {"assignment_id": assign_id, "order": await db.orders.find_one({"id": body.order_id}, {"_id": 0})}


@router.get("/cms/rider-assignments")
async def list_assignments(request: Request, limit: int = 100, user: dict = Depends(_admin)):
    db = _db(request)
    items = await db.rider_assignments.find({}, {"_id": 0}).sort("assigned_at", -1).limit(limit).to_list(limit)
    return {"items": items}
