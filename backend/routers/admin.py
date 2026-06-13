"""Admin router — Phase 1 scaffold.

Only adds NEW endpoints (`/admin/whoami`, `/admin/health`) used by the new
AdminLayout for the access-gate handshake. The existing admin endpoints
(`/admin/stats`, `/admin/orders`, `/admin/users`) remain defined in
`server.py` and are unchanged.
"""
from fastapi import APIRouter, Depends, Request, HTTPException
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["admin-portal"])


# These helpers are resolved lazily from the parent app via dependency
# injection so we do not create a circular import with server.py.
async def _get_admin_user(request: Request):
    # Re-use the same auth machinery already defined on the app.
    from server import get_current_user  # type: ignore
    user = await get_current_user(request)
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/whoami")
async def whoami(user: dict = Depends(_get_admin_user)):
    """Used by AdminLayout to verify the session belongs to an admin.

    Returns the admin profile + a capabilities map. Capabilities are
    static for now; later phases may make them dynamic per-permission.
    """
    return {
        "user": {
            "id": user.get("id"),
            "name": user.get("name"),
            "email": user.get("email"),
            "role": user.get("role"),
        },
        "capabilities": {
            "dashboard": True,
            "medicines": True,            # Phase 2 ✓
            "categories_brands": True,    # Phase 3 ✓
            "banners_homepage": True,     # Phase 3 ✓
            "pharmacies_stores": True,    # Phase 4 ✓
            "service_areas": True,        # Phase 4 ✓
            "orders": True,               # Phase 4 ✓
            "riders": True,               # Phase 4 ✓
            "doctors_labs": False,        # deferred (Phase 5 / per user request)
            "coupons_offers": False,      # deferred
            "content": False,             # deferred
        },
        "version": "phase-4",
    }


@router.get("/health")
async def admin_health(request: Request, user: dict = Depends(_get_admin_user)):
    """Lightweight health snapshot for the admin dashboard skeleton.

    Reports db connectivity, the count of CMS collections, and the last
    applied migration row from `db.migrations`.
    """
    from server import db  # type: ignore
    db_ok = True
    try:
        # cheap ping via listCollections — Motor exposes list_collection_names
        coll_names = await db.list_collection_names()
    except Exception as e:
        db_ok = False
        coll_names = []
        logger.warning("admin/health list_collection_names failed: %s", e)

    last_migration = await db.migrations.find_one(
        {}, {"_id": 0}, sort=[("applied_at", -1)]
    ) if db_ok else None

    return {
        "db_ok": db_ok,
        "db_name": os.environ.get("DB_NAME", ""),
        "collections_count": len(coll_names),
        "last_migration": last_migration,
    }
