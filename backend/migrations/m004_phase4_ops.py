"""Migration m004 — Phase 4 Operations: Pharmacies, Service Areas, Inventory,
Orders, Riders.

Idempotent. Additive only. Safe to re-run.

What it does:
1. Pharmacies: adds operational fields (owner, license, gst, email, lat/lng,
   city/state, operating_hours, delivery_radius_km, approval_status, approved_by,
   approved_at, slug). Existing seed rows get defaults.
2. Orders: adds operational fields (pharmacy_id ref, rider_id ref, status_history,
   accepted_at, picked_up_at, delivered_at, cancelled_at, cancellation_reason).
3. Creates new collections (implicit on first insert via indexes):
   `cities`, `zones`, `pincodes`, `pharmacy_inventory`, `riders`,
   `rider_assignments` — with useful indexes.
4. Seeds a minimal city/zone/pincode for Mumbai so the storefront cart works.
5. Records itself in `db.migrations`.
"""
import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MIGRATION_ID = "m004_phase4_ops"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


_DEFAULT_HOURS = {d: {"open": "09:00", "close": "22:00", "closed": False}
                  for d in ("mon", "tue", "wed", "thu", "fri", "sat", "sun")}


async def run(db) -> dict:
    summary = {"id": MIGRATION_ID, "applied": False, "patched": {}}

    # Indexes — idempotent.
    try:
        await db.pharmacies.create_index("approval_status")
        await db.pharmacies.create_index("city")
        await db.pharmacies.create_index("pincode")
        await db.orders.create_index([("status", 1), ("placed_at", -1)])
        await db.orders.create_index("pharmacy_id")
        await db.orders.create_index("rider_id")
        await db.cities.create_index("name")
        await db.cities.create_index("is_active")
        await db.zones.create_index("city_id")
        await db.pincodes.create_index([("code", 1)], unique=True,
                                       partialFilterExpression={"code": {"$type": "string"}})
        await db.pincodes.create_index("city_id")
        await db.pincodes.create_index("zone_id")
        await db.pharmacy_inventory.create_index(
            [("pharmacy_id", 1), ("medicine_id", 1)],
            unique=True,
            partialFilterExpression={"pharmacy_id": {"$type": "string"}},
        )
        await db.pharmacy_inventory.create_index("medicine_id")
        await db.riders.create_index("phone")
        await db.riders.create_index("is_active")
        await db.rider_assignments.create_index([("order_id", 1), ("assigned_at", -1)])
        await db.rider_assignments.create_index("rider_id")
    except Exception as e:
        logger.warning("m004 index creation issue: %s", e)

    existing = await db.migrations.find_one({"id": MIGRATION_ID})
    if existing:
        logger.info("Migration %s already applied at %s", MIGRATION_ID, existing.get("applied_at"))
        return {**summary, "already_at": existing.get("applied_at")}

    now_iso = _now_iso()

    # ---- Pharmacies — additive backfill ----
    pharm_patched = 0
    pharm_defaults = [
        ("owner_name", None),
        ("license_no", None),
        ("gst_number", None),
        ("email", None),
        ("city", "Mumbai"),
        ("state", "Maharashtra"),
        ("latitude", None),
        ("longitude", None),
        ("delivery_radius_km", 5.0),
        ("operating_hours", _DEFAULT_HOURS),
        ("approval_status", "approved"),  # existing seeded stores are pre-approved
        ("approved_at", now_iso),
        ("approved_by", None),
        ("rejection_reason", None),
    ]
    for f, d in pharm_defaults:
        r = await db.pharmacies.update_many({f: {"$exists": False}}, {"$set": {f: d, "updated_at": now_iso}})
        pharm_patched += r.modified_count
    summary["patched"]["pharmacies"] = pharm_patched

    # ---- Orders — additive backfill ----
    ord_patched = 0
    ord_defaults = [
        ("pharmacy_id", None),
        ("rider_id", None),
        ("status_history", []),
        ("accepted_at", None),
        ("picked_up_at", None),
        ("delivered_at", None),
        ("cancelled_at", None),
        ("cancellation_reason", None),
    ]
    for f, d in ord_defaults:
        r = await db.orders.update_many({f: {"$exists": False}}, {"$set": {f: d, "updated_at": now_iso}})
        ord_patched += r.modified_count
    summary["patched"]["orders"] = ord_patched

    # ---- Seed minimal service-area data (Mumbai) so new orders can resolve ----
    if await db.cities.count_documents({}) == 0:
        city_id = "city-mum"
        await db.cities.insert_one({
            "id": city_id, "name": "Mumbai", "state": "Maharashtra",
            "is_active": True, "sort_order": 10,
            "created_at": now_iso, "updated_at": now_iso,
        })
        # zones
        zones = [
            {"id": "zn-andheri",   "city_id": city_id, "name": "Andheri",   "sort_order": 10},
            {"id": "zn-bandra",    "city_id": city_id, "name": "Bandra",    "sort_order": 20},
            {"id": "zn-powai",     "city_id": city_id, "name": "Powai",     "sort_order": 30},
            {"id": "zn-dadar",     "city_id": city_id, "name": "Dadar",     "sort_order": 40},
        ]
        for z in zones:
            await db.zones.insert_one({**z, "is_active": True,
                                       "created_at": now_iso, "updated_at": now_iso})
        pincodes = [
            ("400058", "zn-andheri"), ("400059", "zn-andheri"),
            ("400050", "zn-bandra"),  ("400051", "zn-bandra"),
            ("400076", "zn-powai"),
            ("400014", "zn-dadar"),   ("400028", "zn-dadar"),
        ]
        for code, zid in pincodes:
            await db.pincodes.update_one(
                {"code": code},
                {"$setOnInsert": {
                    "id": f"pin-{code}", "code": code, "city_id": city_id,
                    "zone_id": zid, "is_active": True, "is_serviceable": True,
                    "created_at": now_iso, "updated_at": now_iso,
                }},
                upsert=True,
            )
        summary["patched"]["cities_seeded"] = 1
        summary["patched"]["zones_seeded"] = len(zones)
        summary["patched"]["pincodes_seeded"] = len(pincodes)

    # ---- Seed a couple of demo riders for manual assignment testing ----
    if await db.riders.count_documents({}) == 0:
        for r in [
            {"name": "Rohit Sharma", "phone": "+919876543201", "vehicle_no": "MH 12 BR 4521", "license_no": "MH-DL-2021-001"},
            {"name": "Arjun Patel",  "phone": "+919876543202", "vehicle_no": "MH 12 BR 7821", "license_no": "MH-DL-2021-002"},
            {"name": "Vikram Singh", "phone": "+919876543203", "vehicle_no": "MH 12 BR 3399", "license_no": "MH-DL-2021-003"},
        ]:
            await db.riders.insert_one({
                "id": "rd-" + uuid.uuid4().hex[:8],
                **r, "is_active": True, "current_status": "available",
                "created_at": now_iso, "updated_at": now_iso,
            })
        summary["patched"]["riders_seeded"] = 3

    await db.migrations.update_one(
        {"id": MIGRATION_ID},
        {"$set": {"id": MIGRATION_ID, "applied_at": now_iso, "summary": summary}},
        upsert=True,
    )
    summary["applied"] = True
    logger.info("Migration %s applied: %s", MIGRATION_ID, summary)
    return summary
