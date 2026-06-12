"""Audit log helper used by all admin mutation endpoints (Phases 2-5).

Intentionally minimal: a single async function that writes one document
per admin write action. Never raises — audit failures must not break the
business operation.
"""
import uuid
import logging
from datetime import datetime, timezone
from typing import Any, Optional

logger = logging.getLogger(__name__)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def log_admin_action(
    db,
    actor: dict,
    action: str,
    entity: str,
    entity_id: Optional[str] = None,
    before: Optional[Any] = None,
    after: Optional[Any] = None,
    meta: Optional[dict] = None,
) -> None:
    """Persist a single audit-log entry. Swallow all errors."""
    try:
        await db.audit_log.insert_one({
            "id": str(uuid.uuid4()),
            "actor_id": (actor or {}).get("id"),
            "actor_email": (actor or {}).get("email"),
            "actor_role": (actor or {}).get("role"),
            "action": action,           # e.g. "create", "update", "delete", "bulk_import"
            "entity": entity,           # e.g. "medicine", "category"
            "entity_id": entity_id,
            "before": before,
            "after": after,
            "meta": meta or {},
            "at": _now_iso(),
        })
    except Exception as e:                                  # pragma: no cover
        logger.warning("audit_log insert failed: %s", e)
