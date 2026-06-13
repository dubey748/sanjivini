"""Admin CMS — Service Area Management: Cities, Zones, Pincodes."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from utils.audit import log_admin_action

router = APIRouter(prefix="/api/admin/cms", tags=["admin-cms-geo"])


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


# ----- Cities ---------------------------------------------------------------

class CityIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    state: Optional[str] = None
    sort_order: int = 100
    is_active: bool = True


@router.get("/cities")
async def list_cities(request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    items = await db.cities.find({}, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(500)
    # Attach zone/pincode counts.
    ids = [c["id"] for c in items]
    zone_counts, pin_counts = {}, {}
    if ids:
        async for c in db.zones.aggregate([{"$match": {"city_id": {"$in": ids}}},
                                           {"$group": {"_id": "$city_id", "n": {"$sum": 1}}}]):
            zone_counts[c["_id"]] = c["n"]
        async for c in db.pincodes.aggregate([{"$match": {"city_id": {"$in": ids}}},
                                              {"$group": {"_id": "$city_id", "n": {"$sum": 1}}}]):
            pin_counts[c["_id"]] = c["n"]
    for c in items:
        c["zones_count"] = zone_counts.get(c["id"], 0)
        c["pincodes_count"] = pin_counts.get(c["id"], 0)
    return {"items": items}


@router.post("/cities")
async def create_city(body: CityIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    new_id = "city-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.cities.insert_one(doc)
    await log_admin_action(db, user, "create", "city", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/cities/{cid}")
async def update_city(cid: str, body: CityIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.cities.find_one({"id": cid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "City not found")
    update = {**body.model_dump(), "updated_at": _now_iso()}
    await db.cities.update_one({"id": cid}, {"$set": update})
    await log_admin_action(db, user, "update", "city", cid, before=existing, after=update)
    return await db.cities.find_one({"id": cid}, {"_id": 0})


@router.delete("/cities/{cid}")
async def delete_city(cid: str, request: Request, hard: bool = False, user: dict = Depends(_admin)):
    db = _db(request)
    if hard:
        if await db.zones.count_documents({"city_id": cid}) > 0:
            raise HTTPException(409, "Zones reference this city. Deactivate instead.")
        if await db.pincodes.count_documents({"city_id": cid}) > 0:
            raise HTTPException(409, "Pincodes reference this city. Deactivate instead.")
        await db.cities.delete_one({"id": cid})
    else:
        await db.cities.update_one({"id": cid}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "city", cid, meta={"hard": hard})
    return {"deleted": True, "id": cid, "hard": hard}


# ----- Zones ----------------------------------------------------------------

class ZoneIn(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    city_id: str
    sort_order: int = 100
    is_active: bool = True


@router.get("/zones")
async def list_zones(request: Request, city_id: Optional[str] = None, user: dict = Depends(_admin)):
    db = _db(request)
    query: dict = {}
    if city_id:
        query["city_id"] = city_id
    items = await db.zones.find(query, {"_id": 0}).sort([("sort_order", 1), ("name", 1)]).to_list(2000)
    ids = [z["id"] for z in items]
    pin_counts = {}
    if ids:
        async for c in db.pincodes.aggregate([{"$match": {"zone_id": {"$in": ids}}},
                                              {"$group": {"_id": "$zone_id", "n": {"$sum": 1}}}]):
            pin_counts[c["_id"]] = c["n"]
    for z in items:
        z["pincodes_count"] = pin_counts.get(z["id"], 0)
    return {"items": items}


@router.post("/zones")
async def create_zone(body: ZoneIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    if not await db.cities.find_one({"id": body.city_id}, {"id": 1}):
        raise HTTPException(400, "Unknown city_id")
    new_id = "zn-" + uuid.uuid4().hex[:8]
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.zones.insert_one(doc)
    await log_admin_action(db, user, "create", "zone", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.put("/zones/{zid}")
async def update_zone(zid: str, body: ZoneIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.zones.find_one({"id": zid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Zone not found")
    update = {**body.model_dump(), "updated_at": _now_iso()}
    await db.zones.update_one({"id": zid}, {"$set": update})
    await log_admin_action(db, user, "update", "zone", zid, before=existing, after=update)
    return await db.zones.find_one({"id": zid}, {"_id": 0})


@router.delete("/zones/{zid}")
async def delete_zone(zid: str, request: Request, hard: bool = False, user: dict = Depends(_admin)):
    db = _db(request)
    if hard:
        if await db.pincodes.count_documents({"zone_id": zid}) > 0:
            raise HTTPException(409, "Pincodes reference this zone. Deactivate instead.")
        await db.zones.delete_one({"id": zid})
    else:
        await db.zones.update_one({"id": zid}, {"$set": {"is_active": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "zone", zid, meta={"hard": hard})
    return {"deleted": True, "id": zid, "hard": hard}


# ----- Pincodes -------------------------------------------------------------

class PincodeIn(BaseModel):
    code: str = Field(min_length=3, max_length=12)
    city_id: str
    zone_id: Optional[str] = None
    is_active: bool = True
    is_serviceable: bool = True


class PincodeBulkIn(BaseModel):
    codes: list[str]
    city_id: str
    zone_id: Optional[str] = None


@router.get("/pincodes")
async def list_pincodes(request: Request,
                        city_id: Optional[str] = None,
                        zone_id: Optional[str] = None,
                        q: Optional[str] = None,
                        user: dict = Depends(_admin)):
    db = _db(request)
    query: dict = {}
    if city_id:
        query["city_id"] = city_id
    if zone_id:
        query["zone_id"] = zone_id
    if q:
        query["code"] = {"$regex": q, "$options": "i"}
    items = await db.pincodes.find(query, {"_id": 0}).sort("code", 1).to_list(5000)
    return {"items": items, "total": len(items)}


@router.post("/pincodes")
async def create_pincode(body: PincodeIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    if not await db.cities.find_one({"id": body.city_id}, {"id": 1}):
        raise HTTPException(400, "Unknown city_id")
    if body.zone_id and not await db.zones.find_one({"id": body.zone_id}, {"id": 1}):
        raise HTTPException(400, "Unknown zone_id")
    existing = await db.pincodes.find_one({"code": body.code})
    if existing:
        raise HTTPException(409, f"Pincode {body.code} already exists")
    new_id = "pin-" + body.code
    now = _now_iso()
    doc = {"id": new_id, **body.model_dump(), "created_at": now, "updated_at": now}
    await db.pincodes.insert_one(doc)
    await log_admin_action(db, user, "create", "pincode", new_id, after=doc)
    doc.pop("_id", None)
    return doc


@router.post("/pincodes/bulk")
async def bulk_pincodes(body: PincodeBulkIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    if not await db.cities.find_one({"id": body.city_id}, {"id": 1}):
        raise HTTPException(400, "Unknown city_id")
    if body.zone_id and not await db.zones.find_one({"id": body.zone_id}, {"id": 1}):
        raise HTTPException(400, "Unknown zone_id")
    now = _now_iso()
    created, skipped = 0, 0
    for code in body.codes:
        code = code.strip()
        if not code:
            continue
        r = await db.pincodes.update_one(
            {"code": code},
            {"$setOnInsert": {
                "id": "pin-" + code, "code": code, "city_id": body.city_id,
                "zone_id": body.zone_id, "is_active": True, "is_serviceable": True,
                "created_at": now, "updated_at": now,
            }},
            upsert=True,
        )
        if r.upserted_id:
            created += 1
        else:
            skipped += 1
    await log_admin_action(db, user, "bulk_create", "pincode", None,
                           meta={"created": created, "skipped": skipped, "count": len(body.codes)})
    return {"created": created, "skipped": skipped, "total": len(body.codes)}


@router.put("/pincodes/{pid}")
async def update_pincode(pid: str, body: PincodeIn, request: Request, user: dict = Depends(_admin)):
    db = _db(request)
    existing = await db.pincodes.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Pincode not found")
    update = {**body.model_dump(), "updated_at": _now_iso()}
    await db.pincodes.update_one({"id": pid}, {"$set": update})
    await log_admin_action(db, user, "update", "pincode", pid, before=existing, after=update)
    return await db.pincodes.find_one({"id": pid}, {"_id": 0})


@router.delete("/pincodes/{pid}")
async def delete_pincode(pid: str, request: Request, hard: bool = False, user: dict = Depends(_admin)):
    db = _db(request)
    if hard:
        await db.pincodes.delete_one({"id": pid})
    else:
        await db.pincodes.update_one({"id": pid}, {"$set": {"is_active": False, "is_serviceable": False, "updated_at": _now_iso()}})
    await log_admin_action(db, user, "delete", "pincode", pid, meta={"hard": hard})
    return {"deleted": True, "id": pid, "hard": hard}


@router.get("/coverage/check")
async def coverage_check(request: Request, pincode: str, user: dict = Depends(_admin)):
    """Quick sanity check used by the admin UI to verify whether a pincode is
    currently serviceable + which pharmacies can reach it."""
    db = _db(request)
    pin = await db.pincodes.find_one({"code": pincode}, {"_id": 0})
    if not pin:
        return {"serviceable": False, "reason": "not_in_db"}
    if not pin.get("is_serviceable"):
        return {"serviceable": False, "reason": "marked_unserviceable", "pincode": pin}
    pharmacies = await db.pharmacies.find(
        {"approval_status": "approved", "is_active": True,
         "$or": [{"pincode": pincode}, {"city": {"$exists": True}}]},
        {"_id": 0, "id": 1, "name": 1, "pincode": 1, "delivery_radius_km": 1},
    ).to_list(100)
    return {"serviceable": True, "pincode": pin, "pharmacies": pharmacies}
