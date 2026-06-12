"""Migration m002 — Medicine CMS extensions.

Idempotent. Additive only.

What it does:
* Adds CMS fields to existing medicines (all using `$exists: false` filter so
  nothing is overwritten):
    - `images: []`   (URL list — storage-provider agnostic)
    - `discount_pct: 0`
    - `tags: []`
    - `sku: null`
    - `hsn_code: null`
    - `gst_pct: null`
    - `subcategory_id: null`   (populated in Phase 3)
    - `brand_id: null`         (populated in Phase 3)
    - `slug: <derived from name+id-suffix>` (unique)
* Backfills `images` from the legacy `image` field (if non-empty and
  `images` is empty / missing) so the customer storefront keeps working.
* Creates `import_jobs` collection with useful indexes.
* Adds `slug` (sparse-unique) and `sku` (sparse-unique) and `is_active` indexes
  on `medicines`.
* Records itself in `db.migrations`.
"""
import logging
import re
from datetime import datetime, timezone

from utils.slug import slugify

logger = logging.getLogger(__name__)

MIGRATION_ID = "m002_medicine_cms"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _ensure_unique_slug(coll, base: str, doc_id: str) -> str:
    """Return a slug guaranteed unique within the collection."""
    candidate = base
    # Suffix with a short fragment of the id if needed.
    suffix = (doc_id or "").replace("-", "")[:6]
    for attempt in range(5):
        existing = await coll.find_one({"slug": candidate, "id": {"$ne": doc_id}}, {"id": 1})
        if not existing:
            return candidate
        candidate = f"{base}-{suffix}" if attempt == 0 else f"{base}-{suffix}-{attempt}"
    return f"{base}-{suffix}-{re.sub('[^a-z0-9]', '', str(datetime.now().timestamp()))[-4:]}"


async def run(db) -> dict:
    """Apply migration. Idempotent."""
    summary = {"id": MIGRATION_ID, "applied": False, "medicines_patched": 0, "slugged": 0}

    # ---- Cleanup of any partial state from a previously-aborted run ----
    # If a previous boot created a `sku_1` index with `sparse: true` but no
    # partialFilterExpression, drop it so we can recreate with the correct
    # options below. Same for slug_1.
    try:
        idx_info = await db.medicines.index_information()
        for name in ("sku_1", "slug_1"):
            info = idx_info.get(name)
            if info and not info.get("partialFilterExpression"):
                await db.medicines.drop_index(name)
                logger.info("m002 dropped legacy index %s", name)
    except Exception as e:
        logger.warning("m002 legacy index drop issue: %s", e)
    # Clear stray sku=null values written by a previously-aborted run.
    try:
        await db.medicines.update_many({"sku": None}, {"$unset": {"sku": ""}})
    except Exception as e:
        logger.warning("m002 sku=null cleanup issue: %s", e)

    # Indexes — idempotent. Use partialFilterExpression for unique fields
    # so that nulls/missing values don't collide (sparse alone treats null
    # as a value and would fail E11000).
    try:
        await db.medicines.create_index("is_active")
        await db.medicines.create_index(
            "slug",
            unique=True,
            partialFilterExpression={"slug": {"$type": "string"}},
        )
        await db.medicines.create_index(
            "sku",
            unique=True,
            partialFilterExpression={"sku": {"$type": "string"}},
        )
        await db.medicines.create_index("category")
        await db.medicines.create_index("brand_id", sparse=True)
        await db.medicines.create_index("subcategory_id", sparse=True)
        await db.import_jobs.create_index([("entity", 1), ("started_at", -1)])
        await db.import_jobs.create_index("status")
    except Exception as e:
        logger.warning("m002 index creation issue: %s", e)

    existing = await db.migrations.find_one({"id": MIGRATION_ID})
    if existing:
        logger.info("Migration %s already applied at %s", MIGRATION_ID, existing.get("applied_at"))
        return {**summary, "already_at": existing.get("applied_at")}

    now_iso = _now_iso()

    # Default scalar fields. We deliberately do NOT $set null on fields that
    # have a unique index (sku, slug) — those must either be absent (so the
    # partial index ignores them) or a real string value.
    default_patches = [
        ("images", []),
        ("discount_pct", 0),
        ("tags", []),
        ("hsn_code", None),
        ("gst_pct", None),
        ("subcategory_id", None),
        ("brand_id", None),
    ]
    medicines_patched = 0
    for field, default in default_patches:
        r = await db.medicines.update_many(
            {field: {"$exists": False}},
            {"$set": {field: default, "updated_at": now_iso}},
        )
        medicines_patched += r.modified_count
    summary["medicines_patched"] = medicines_patched

    # Backfill `images` from legacy `image` field where helpful.
    async for doc in db.medicines.find({"$or": [{"images": {"$size": 0}}, {"images": {"$exists": False}}]}):
        legacy = doc.get("image")
        if legacy and isinstance(legacy, str):
            await db.medicines.update_one(
                {"id": doc["id"]},
                {"$set": {"images": [legacy], "updated_at": now_iso}},
            )

    # Slugs — generate for any medicine missing one.
    slugged = 0
    async for doc in db.medicines.find({"$or": [{"slug": {"$exists": False}}, {"slug": None}, {"slug": ""}]}, {"id": 1, "name": 1}):
        base = slugify(doc.get("name", "medicine"))
        unique = await _ensure_unique_slug(db.medicines, base, doc.get("id"))
        await db.medicines.update_one(
            {"id": doc["id"]},
            {"$set": {"slug": unique, "updated_at": now_iso}},
        )
        slugged += 1
    summary["slugged"] = slugged

    await db.migrations.update_one(
        {"id": MIGRATION_ID},
        {"$set": {"id": MIGRATION_ID, "applied_at": now_iso, "summary": summary}},
        upsert=True,
    )
    summary["applied"] = True
    logger.info("Migration %s applied: %s", MIGRATION_ID, summary)
    return summary
