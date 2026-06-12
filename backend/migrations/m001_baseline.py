"""Migration m001 — baseline schema patches for Admin Portal Phase 1.

Guarantees:
* Idempotent — safe to re-run any number of times.
* Additive only — uses `$exists: false` filters so existing fields
  are NEVER overwritten.
* Non-destructive — no drops, no deletes.

What it does:
1. Creates the `audit_log` collection (implicit on first insert) and its
   secondary indexes.
2. Adds `is_active=True` + `updated_at` to legacy seed docs that pre-date
   the admin CMS, in collections that the admin will manage.
3. Records itself in `db.migrations` for traceability.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MIGRATION_ID = "m001_baseline"

# Collections that will gain CMS lifecycle flags (is_active, updated_at).
_CMS_COLLECTIONS = [
    "medicines",
    "categories",
    "pharmacies",
    "doctors",
    "lab_tests",
    "coupons",
]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def run(db) -> dict:
    """Apply migration. Returns a small summary dict for logging."""
    summary = {"id": MIGRATION_ID, "applied": False, "patched": {}}

    # Check if already applied — but still ensure indexes exist (cheap, idempotent).
    existing = await db.migrations.find_one({"id": MIGRATION_ID})

    # 1. Indexes on audit_log (safe — create_index is idempotent in Motor).
    try:
        await db.audit_log.create_index([("actor_id", 1), ("at", -1)])
        await db.audit_log.create_index([("entity", 1), ("entity_id", 1)])
        await db.audit_log.create_index([("at", -1)])
    except Exception as e:
        logger.warning("audit_log index creation failed: %s", e)

    if existing:
        logger.info("Migration %s already applied at %s — skipping data patch",
                    MIGRATION_ID, existing.get("applied_at"))
        return {**summary, "applied": False, "already_at": existing.get("applied_at")}

    # 2. Additive patch — only fills in missing fields.
    now_iso = _now_iso()
    for coll_name in _CMS_COLLECTIONS:
        coll = db[coll_name]
        r1 = await coll.update_many(
            {"is_active": {"$exists": False}},
            {"$set": {"is_active": True}},
        )
        r2 = await coll.update_many(
            {"updated_at": {"$exists": False}},
            {"$set": {"updated_at": now_iso}},
        )
        summary["patched"][coll_name] = {
            "is_active_added": r1.modified_count,
            "updated_at_added": r2.modified_count,
        }

    # 3. Record migration as applied.
    await db.migrations.update_one(
        {"id": MIGRATION_ID},
        {"$set": {"id": MIGRATION_ID, "applied_at": now_iso, "summary": summary}},
        upsert=True,
    )
    summary["applied"] = True
    logger.info("Migration %s applied: %s", MIGRATION_ID, summary["patched"])
    return summary
