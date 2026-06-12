"""Admin imports & exports (Phase 2 — medicines).

Provides:
* Excel template download
* Multipart upload → dry-run preview (no DB writes)
* Multipart upload → commit (applies the same parsing + writes to DB)
* XLSX / CSV export of medicines (honors current filters)
* Listing of past import_jobs
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from fastapi.responses import Response

from utils.audit import log_admin_action
from utils.importer import (
    MEDICINE_COLUMNS,
    MEDICINE_HEADERS,
    build_medicine_template_xlsx,
    build_medicines_csv,
    build_medicines_xlsx,
    parse_medicine_table,
)
from utils.slug import slugify

router = APIRouter(prefix="/api/admin", tags=["admin-imports"])


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


async def _read_upload(file: UploadFile) -> bytes:
    blob = await file.read()
    if not blob:
        raise HTTPException(400, "Empty file")
    if len(blob) > 25 * 1024 * 1024:
        raise HTTPException(413, "File exceeds 25MB. Please split your catalog.")
    return blob


# ---------- Template --------------------------------------------------------

@router.get("/imports/medicines/template")
async def medicines_template(request: Request, user: dict = Depends(_get_admin_user)):
    blob = build_medicine_template_xlsx()
    headers = {
        "Content-Disposition": 'attachment; filename="sanjeevni-medicines-template.xlsx"',
        "Cache-Control": "no-store",
    }
    return Response(
        content=blob,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@router.get("/imports/medicines/schema")
async def medicines_schema(request: Request, user: dict = Depends(_get_admin_user)):
    """Used by the UI to display column hints next to the upload dropzone."""
    return {
        "columns": [
            {"name": c[0], "required": c[1], "type": c[2], "description": c[3]}
            for c in MEDICINE_COLUMNS
        ],
    }


# ---------- Dry run ---------------------------------------------------------

@router.post("/imports/medicines/dry-run")
async def medicines_dry_run(
    request: Request,
    file: UploadFile = File(...),
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    blob = await _read_upload(file)
    result = await parse_medicine_table(db, file.filename or "upload.xlsx", blob)
    return {
        "summary": {
            "total": result.total,
            "will_create": result.will_create,
            "will_update": result.will_update,
            "errors": result.errors,
        },
        # Cap row preview to 500 rows on the wire — the UI uses it for the table.
        "rows": [
            {
                "row_index": r.row_index,
                "action": r.action,
                "errors": r.errors,
                "name": (r.data or {}).get("name"),
                "composition": (r.data or {}).get("composition"),
                "category": (r.data or {}).get("category"),
                "price": (r.data or {}).get("price"),
                "stock": (r.data or {}).get("stock"),
                "match_id": r.match_id,
            }
            for r in result.rows[:500]
        ],
        "truncated": len(result.rows) > 500,
    }


# ---------- Commit ----------------------------------------------------------

@router.post("/imports/medicines/commit")
async def medicines_commit(
    request: Request,
    file: UploadFile = File(...),
    skip_errors: bool = Query(default=True),
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    blob = await _read_upload(file)
    result = await parse_medicine_table(db, file.filename or "upload.xlsx", blob)

    job_id = str(uuid.uuid4())
    started_at = _now_iso()
    job_doc = {
        "id": job_id,
        "entity": "medicine",
        "file_name": file.filename,
        "total": result.total,
        "will_create": result.will_create,
        "will_update": result.will_update,
        "will_error": result.errors,
        "created": 0,
        "updated": 0,
        "errored": 0,
        "errors": [],
        "started_by": user.get("id"),
        "started_by_email": user.get("email"),
        "started_at": started_at,
        "finished_at": None,
        "status": "running",
    }
    await db.import_jobs.insert_one(job_doc)

    if result.errors and not skip_errors:
        # Abort the entire commit if user asked us to.
        await db.import_jobs.update_one(
            {"id": job_id},
            {"$set": {
                "finished_at": _now_iso(),
                "status": "aborted_errors",
                "errors": [{"row": r.row_index, "errors": r.errors} for r in result.rows if r.action == "error"][:200],
            }},
        )
        return {
            "job_id": job_id,
            "status": "aborted_errors",
            "summary": {
                "total": result.total, "will_create": result.will_create,
                "will_update": result.will_update, "errors": result.errors,
            },
        }

    created = updated = errored = 0
    error_log: list = []
    for row in result.rows:
        if row.action == "error":
            errored += 1
            if len(error_log) < 200:
                error_log.append({"row": row.row_index, "errors": row.errors})
            continue
        if row.action not in {"create", "update"}:
            continue

        data = dict(row.data)
        now = _now_iso()
        try:
            if row.action == "create":
                new_id = str(uuid.uuid4())
                base = slugify(data.get("name", "medicine"))
                slug = base
                # Ensure unique slug w/ short id suffix on clash
                if await db.medicines.find_one({"slug": slug}, {"id": 1}):
                    slug = f"{base}-{new_id.replace('-', '')[:6]}"
                data.update({
                    "id": new_id,
                    "slug": slug,
                    "created_at": now,
                    "updated_at": now,
                })
                await db.medicines.insert_one(data)
                created += 1
            else:
                target_id = row.match_id
                if not target_id:
                    errored += 1
                    error_log.append({"row": row.row_index, "errors": ["update target id missing"]})
                    continue
                # Preserve created_at + slug
                existing = await db.medicines.find_one({"id": target_id}, {"created_at": 1, "slug": 1})
                data["id"] = target_id
                data["slug"] = (existing or {}).get("slug") or slugify(data.get("name", "medicine"))
                data["created_at"] = (existing or {}).get("created_at", now)
                data["updated_at"] = now
                await db.medicines.update_one({"id": target_id}, {"$set": data})
                updated += 1
        except Exception as e:
            errored += 1
            if len(error_log) < 200:
                error_log.append({"row": row.row_index, "errors": [str(e)]})

    finished_at = _now_iso()
    status = "completed" if errored == 0 else ("partial" if (created or updated) else "failed")
    await db.import_jobs.update_one(
        {"id": job_id},
        {"$set": {
            "created": created,
            "updated": updated,
            "errored": errored,
            "errors": error_log,
            "finished_at": finished_at,
            "status": status,
        }},
    )
    await log_admin_action(
        db, user, "bulk_import", "medicine", job_id,
        meta={"created": created, "updated": updated, "errored": errored, "file": file.filename},
    )
    return {
        "job_id": job_id,
        "status": status,
        "created": created,
        "updated": updated,
        "errored": errored,
    }


# ---------- Job listing -----------------------------------------------------

@router.get("/imports/medicines")
async def list_jobs(
    request: Request,
    limit: int = Query(default=30, ge=1, le=100),
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    docs = await db.import_jobs.find(
        {"entity": "medicine"}, {"_id": 0, "errors": 0}
    ).sort("started_at", -1).limit(limit).to_list(limit)
    return docs


@router.get("/imports/medicines/{job_id}")
async def get_job(job_id: str, request: Request, user: dict = Depends(_get_admin_user)):
    db = _db(request)
    doc = await db.import_jobs.find_one({"id": job_id, "entity": "medicine"}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Job not found")
    return doc


# ---------- Export ----------------------------------------------------------

async def _build_filter(q, category, is_active, prescription_required):
    flt: dict = {}
    if q:
        rx = {"$regex": q, "$options": "i"}
        flt["$or"] = [{"name": rx}, {"composition": rx}, {"brand": rx}, {"sku": rx}]
    if category:
        flt["category"] = category
    if is_active is not None:
        flt["is_active"] = is_active
    if prescription_required is not None:
        flt["prescription_required"] = prescription_required
    return flt


@router.get("/exports/medicines.xlsx")
async def export_medicines_xlsx(
    request: Request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    prescription_required: Optional[bool] = None,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    flt = await _build_filter(q, category, is_active, prescription_required)
    docs = await db.medicines.find(flt, {"_id": 0}).sort("name", 1).to_list(20000)
    blob = build_medicines_xlsx(docs)
    fname = f"sanjeevni-medicines-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.xlsx"
    return Response(
        content=blob,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"', "Cache-Control": "no-store"},
    )


@router.get("/exports/medicines.csv")
async def export_medicines_csv(
    request: Request,
    q: Optional[str] = None,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    prescription_required: Optional[bool] = None,
    user: dict = Depends(_get_admin_user),
):
    db = _db(request)
    flt = await _build_filter(q, category, is_active, prescription_required)
    docs = await db.medicines.find(flt, {"_id": 0}).sort("name", 1).to_list(20000)
    blob = build_medicines_csv(docs)
    fname = f"sanjeevni-medicines-{datetime.now(timezone.utc).strftime('%Y%m%d-%H%M')}.csv"
    return Response(
        content=blob,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{fname}"', "Cache-Control": "no-store"},
    )
