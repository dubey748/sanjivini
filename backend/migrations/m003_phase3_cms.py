"""Migration m003 — Phase 3 CMS: Categories+Subcategories, Brands, Banners, Homepage blocks.

Idempotent. Additive only. Safe to re-run.

What it does:
1. Categories: adds `sort_order` (preserves DB-order), `description`, `image_url`,
   `parent_id` (None for top-level). Existing `icon` field is retained as a
   lucide-react icon name (used by the storefront).
2. Creates indexes on `categories.parent_id`, `categories.sort_order`.
3. Creates new collections `brands`, `banners`, `homepage_blocks` (implicit on
   first insert) with useful indexes.
4. Records itself in `db.migrations`.
"""
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MIGRATION_ID = "m003_phase3_cms"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def run(db) -> dict:
    summary = {"id": MIGRATION_ID, "applied": False, "patched": {}}

    # Indexes — idempotent.
    try:
        await db.categories.create_index("parent_id")
        await db.categories.create_index("sort_order")
        await db.categories.create_index("is_active")
        await db.categories.create_index(
            "slug",
            unique=True,
            partialFilterExpression={"slug": {"$type": "string"}},
        )
        await db.brands.create_index("name")
        await db.brands.create_index("is_active")
        await db.brands.create_index("sort_order")
        await db.brands.create_index(
            "slug",
            unique=True,
            partialFilterExpression={"slug": {"$type": "string"}},
        )
        await db.banners.create_index([("position", 1), ("sort_order", 1)])
        await db.banners.create_index("is_active")
        await db.homepage_blocks.create_index([("sort_order", 1)])
        await db.homepage_blocks.create_index("is_active")
    except Exception as e:
        logger.warning("m003 index creation issue: %s", e)

    existing = await db.migrations.find_one({"id": MIGRATION_ID})
    if existing:
        logger.info("Migration %s already applied at %s", MIGRATION_ID, existing.get("applied_at"))
        return {**summary, "already_at": existing.get("applied_at")}

    now_iso = _now_iso()

    # ---- Categories backfill (additive only) ----
    # parent_id = None (top-level)
    # sort_order = increasing integer (alphabetical fallback)
    cats = await db.categories.find({}).sort("name", 1).to_list(500)
    cat_patched = 0
    for idx, c in enumerate(cats):
        update_set = {}
        if "parent_id" not in c:
            update_set["parent_id"] = None
        if "sort_order" not in c:
            update_set["sort_order"] = (idx + 1) * 10
        if "description" not in c:
            update_set["description"] = None
        if "image_url" not in c:
            update_set["image_url"] = None
        if "slug" not in c or not c.get("slug"):
            # Strip the "c-" id prefix if present for the default slug.
            base = (c.get("id") or "").lstrip("c-") or c.get("name", "").lower().replace(" ", "-")
            update_set["slug"] = base
        if update_set:
            update_set["updated_at"] = now_iso
            await db.categories.update_one({"id": c["id"]}, {"$set": update_set})
            cat_patched += 1
    summary["patched"]["categories"] = cat_patched

    # ---- Create empty collections by inserting a no-op marker then removing ----
    # Motor doesn't expose explicit create-collection on driver; the
    # indexes above already create the collections implicitly. Nothing to do.

    await db.migrations.update_one(
        {"id": MIGRATION_ID},
        {"$set": {"id": MIGRATION_ID, "applied_at": now_iso, "summary": summary}},
        upsert=True,
    )
    summary["applied"] = True
    logger.info("Migration %s applied: %s", MIGRATION_ID, summary)
    return summary
