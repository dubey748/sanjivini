from dotenv import load_dotenv
from pathlib import Path 

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import re
import json
import uuid
import logging
import random
import hmac
import hashlib
import bcrypt
import jwt as pyjwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr, ConfigDict

# Razorpay
try:
    import razorpay
    _rzp_key = os.environ.get("RAZORPAY_KEY_ID", "")
    _rzp_secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    rzp_client = razorpay.Client(auth=(_rzp_key, _rzp_secret)) if _rzp_key and _rzp_secret else None
except Exception:
    rzp_client = None

# Emergent LLM
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
    EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
except Exception:
    LlmChat = None
    UserMessage = None
    ImageContent = None
    EMERGENT_LLM_KEY = ""

# ---------- MongoDB ----------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Sanjeevni API")
api = APIRouter(prefix="/api")

JWT_ALGO = "HS256"
JWT_SECRET = os.environ["JWT_SECRET"]

# ---------- Helpers ----------
def now_utc():
    return datetime.now(timezone.utc)

def iso(dt): return dt.isoformat() if isinstance(dt, datetime) else dt

def new_id(): return str(uuid.uuid4())

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_token(user_id: str, role: str, kind: str = "access") -> str:
    delta = timedelta(minutes=60*24*7) if kind == "refresh" else timedelta(hours=12)
    payload = {"sub": user_id, "role": role, "type": kind, "exp": now_utc() + delta}
    return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(401, "Not authenticated")
    try:
        payload = pyjwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
    except pyjwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except pyjwt.InvalidTokenError:
        raise HTTPException(401, "Invalid token")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(401, "User not found")
    return user

def require_role(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(403, "Forbidden")
        return user
    return checker

def set_auth_cookies(resp: Response, user_id: str, role: str):
    access = create_token(user_id, role, "access")
    refresh = create_token(user_id, role, "refresh")
    resp.set_cookie("access_token", access, httponly=True, secure=False, samesite="lax", max_age=43200, path="/")
    resp.set_cookie("refresh_token", refresh, httponly=True, secure=False, samesite="lax", max_age=604800, path="/")
    return {"access_token": access, "refresh_token": refresh}

# ---------- Models ----------
class RegisterIn(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    role: Literal["customer", "pharmacy", "delivery", "admin"] = "customer"

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OtpRequestIn(BaseModel):
    phone: str

class OtpVerifyIn(BaseModel):
    phone: str
    otp: str
    name: Optional[str] = "Guest User"

class AddressIn(BaseModel):
    label: str
    line1: str
    line2: Optional[str] = ""
    city: str
    state: str
    pincode: str
    is_default: bool = False

class CartItemIn(BaseModel):
    medicine_id: str
    qty: int = 1

class CheckoutIn(BaseModel):
    address_id: Optional[str] = None
    payment_method: Literal["cod", "upi", "card", "wallet"] = "upi"
    coupon_code: Optional[str] = None
    use_wallet: bool = False
    prescription_id: Optional[str] = None

class ReviewIn(BaseModel):
    medicine_id: str
    rating: int
    comment: Optional[str] = ""

class ConsultationIn(BaseModel):
    doctor_id: str
    slot: str
    reason: Optional[str] = ""

class LabBookingIn(BaseModel):
    test_id: str
    slot: str
    address_id: Optional[str] = None

class PrescriptionUploadIn(BaseModel):
    image_url: Optional[str] = None
    note: Optional[str] = ""

# ---------- Auth ----------
@api.post("/auth/register")
async def register(body: RegisterIn, response: Response):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(400, "Email already registered")
    user = {
        "id": new_id(),
        "name": body.name,
        "email": email,
        "phone": body.phone or "",
        "role": body.role,
        "password_hash": hash_password(body.password),
        "wallet_balance": 100,  # welcome bonus
        "loyalty_points": 0,
        "created_at": iso(now_utc()),
    }
    await db.users.insert_one(user)
    set_auth_cookies(response, user["id"], user["role"])
    user.pop("password_hash", None); user.pop("_id", None)
    return user

@api.post("/auth/login")
async def login(body: LoginIn, response: Response):
    email = body.email.lower()
    u = await db.users.find_one({"email": email})
    if not u or not verify_password(body.password, u.get("password_hash", "")):
        raise HTTPException(401, "Invalid credentials")
    set_auth_cookies(response, u["id"], u["role"])
    u.pop("password_hash", None); u.pop("_id", None)
    return u

@api.post("/auth/otp/request")
async def otp_request(body: OtpRequestIn):
    # Mock OTP — always 123456 for demo
    await db.otps.update_one(
        {"phone": body.phone},
        {"$set": {"phone": body.phone, "otp": "123456", "expires_at": iso(now_utc() + timedelta(minutes=5))}},
        upsert=True,
    )
    return {"message": "OTP sent (demo: 123456)", "demo_otp": "123456"}

@api.post("/auth/otp/verify")
async def otp_verify(body: OtpVerifyIn, response: Response):
    record = await db.otps.find_one({"phone": body.phone}, {"_id": 0})
    if not record or record.get("otp") != body.otp:
        raise HTTPException(401, "Invalid OTP")
    u = await db.users.find_one({"phone": body.phone})
    if not u:
        u = {
            "id": new_id(),
            "name": body.name or "Sanjeevni User",
            "email": f"otp_{body.phone}@sanjeevni.local",
            "phone": body.phone,
            "role": "customer",
            "password_hash": hash_password(new_id()),
            "wallet_balance": 100,
            "loyalty_points": 0,
            "created_at": iso(now_utc()),
        }
        await db.users.insert_one(u)
    set_auth_cookies(response, u["id"], u["role"])
    u.pop("password_hash", None); u.pop("_id", None)
    return u

@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")
    return {"message": "Logged out"}

@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user

# ---------- Addresses ----------
@api.get("/addresses")
async def list_addresses(user: dict = Depends(get_current_user)):
    return await db.addresses.find({"user_id": user["id"]}, {"_id": 0}).to_list(100)

@api.post("/addresses")
async def add_address(body: AddressIn, user: dict = Depends(get_current_user)):
    addr = {"id": new_id(), "user_id": user["id"], **body.model_dump(), "created_at": iso(now_utc())}
    if body.is_default:
        await db.addresses.update_many({"user_id": user["id"]}, {"$set": {"is_default": False}})
    await db.addresses.insert_one(addr)
    addr.pop("_id", None)
    return addr

# ---------- Medicines / Catalog ----------
@api.get("/categories")
async def list_categories():
    return await db.categories.find({}, {"_id": 0}).to_list(200)

@api.get("/medicines")
async def list_medicines(q: Optional[str] = None, category: Optional[str] = None, prescription_only: Optional[bool] = None, limit: int = 50):
    query = {}
    if q:
        query["$or"] = [
            {"name": {"$regex": q, "$options": "i"}},
            {"composition": {"$regex": q, "$options": "i"}},
            {"brand": {"$regex": q, "$options": "i"}},
            {"symptoms": {"$regex": q, "$options": "i"}},
        ]
    if category:
        query["category"] = category
    if prescription_only is not None:
        query["prescription_required"] = prescription_only
    items = await db.medicines.find(query, {"_id": 0}).limit(limit).to_list(limit)
    return items

@api.get("/medicines/{medicine_id}")
async def get_medicine(medicine_id: str):
    m = await db.medicines.find_one({"id": medicine_id}, {"_id": 0})
    if not m:
        raise HTTPException(404, "Not found")
    alternatives = await db.medicines.find(
        {"composition": m.get("composition"), "id": {"$ne": medicine_id}},
        {"_id": 0}
    ).limit(5).to_list(5)
    m["alternatives"] = alternatives
    return m

@api.get("/medicines/{medicine_id}/reviews")
async def get_reviews(medicine_id: str):
    return await db.reviews.find({"medicine_id": medicine_id}, {"_id": 0}).to_list(50)

@api.post("/reviews")
async def add_review(body: ReviewIn, user: dict = Depends(get_current_user)):
    r = {"id": new_id(), "user_id": user["id"], "user_name": user["name"],
         "medicine_id": body.medicine_id, "rating": body.rating, "comment": body.comment,
         "created_at": iso(now_utc())}
    await db.reviews.insert_one(r); r.pop("_id", None)
    return r

# ---------- Pharmacies ----------
@api.get("/pharmacies")
async def list_pharmacies():
    return await db.pharmacies.find({}, {"_id": 0}).to_list(100)

@api.get("/pharmacies/nearest")
async def nearest_pharmacy(pincode: Optional[str] = None):
    pharmacies = await db.pharmacies.find({}, {"_id": 0}).to_list(100)
    if not pharmacies:
        return None
    # Mock: pick first or by pincode match
    pharm = next((p for p in pharmacies if pincode and p.get("pincode") == pincode), pharmacies[0])
    pharm["eta_minutes"] = random.randint(12, 19)
    return pharm

# ---------- Cart ----------
async def _get_cart(user_id):
    cart = await db.carts.find_one({"user_id": user_id}, {"_id": 0})
    if not cart:
        cart = {"user_id": user_id, "items": [], "updated_at": iso(now_utc())}
        await db.carts.insert_one({**cart})
    # enrich items with medicine details
    items_out = []
    subtotal = 0
    for it in cart.get("items", []):
        m = await db.medicines.find_one({"id": it["medicine_id"]}, {"_id": 0})
        if m:
            line_total = m["price"] * it["qty"]
            subtotal += line_total
            items_out.append({**it, "medicine": m, "line_total": line_total})
    delivery_fee = 0 if subtotal >= 199 else 29
    cart["items"] = items_out
    cart["subtotal"] = subtotal
    cart["delivery_fee"] = delivery_fee
    cart["total"] = subtotal + delivery_fee
    return cart

@api.get("/cart")
async def view_cart(user: dict = Depends(get_current_user)):
    return await _get_cart(user["id"])

@api.post("/cart/add")
async def cart_add(body: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    items = cart.get("items", []) if cart else []
    found = next((i for i in items if i["medicine_id"] == body.medicine_id), None)
    if found:
        found["qty"] += body.qty
    else:
        items.append({"medicine_id": body.medicine_id, "qty": body.qty})
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": items, "updated_at": iso(now_utc()), "user_id": user["id"]}},
        upsert=True,
    )
    return await _get_cart(user["id"])

@api.post("/cart/update")
async def cart_update(body: CartItemIn, user: dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": user["id"]})
    items = cart.get("items", []) if cart else []
    items = [i for i in items if i["medicine_id"] != body.medicine_id]
    if body.qty > 0:
        items.append({"medicine_id": body.medicine_id, "qty": body.qty})
    await db.carts.update_one(
        {"user_id": user["id"]},
        {"$set": {"items": items, "updated_at": iso(now_utc()), "user_id": user["id"]}},
        upsert=True,
    )
    return await _get_cart(user["id"])

@api.post("/cart/clear")
async def cart_clear(user: dict = Depends(get_current_user)):
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}}, upsert=True)
    return await _get_cart(user["id"])

# ---------- Coupons ----------
@api.get("/coupons")
async def list_coupons():
    return await db.coupons.find({}, {"_id": 0}).to_list(50)

@api.post("/coupons/apply")
async def apply_coupon(code: str, user: dict = Depends(get_current_user)):
    coupon = await db.coupons.find_one({"code": code.upper()}, {"_id": 0})
    if not coupon:
        raise HTTPException(404, "Invalid coupon")
    cart = await _get_cart(user["id"])
    discount = 0
    if coupon["type"] == "percent":
        discount = round(cart["subtotal"] * coupon["value"] / 100, 2)
        if coupon.get("max_discount"):
            discount = min(discount, coupon["max_discount"])
    else:
        discount = coupon["value"]
    return {"coupon": coupon, "discount": discount}

# ---------- Orders ----------
@api.post("/orders/checkout")
async def checkout(body: CheckoutIn, user: dict = Depends(get_current_user)):
    cart = await _get_cart(user["id"])
    if not cart["items"]:
        raise HTTPException(400, "Cart is empty")
    discount = 0
    coupon_code = None
    if body.coupon_code:
        c = await db.coupons.find_one({"code": body.coupon_code.upper()}, {"_id": 0})
        if c:
            coupon_code = c["code"]
            if c["type"] == "percent":
                discount = round(cart["subtotal"] * c["value"] / 100, 2)
                if c.get("max_discount"): discount = min(discount, c["max_discount"])
            else:
                discount = c["value"]
    wallet_used = 0
    if body.use_wallet:
        wallet_used = min(user.get("wallet_balance", 0), cart["total"] - discount)
    total = max(0, cart["total"] - discount - wallet_used)
    pharm = await nearest_pharmacy()
    address = None
    if body.address_id:
        address = await db.addresses.find_one({"id": body.address_id, "user_id": user["id"]}, {"_id": 0})
    order = {
        "id": new_id(),
        "order_number": "SJ" + str(random.randint(100000, 999999)),
        "user_id": user["id"],
        "items": [{"medicine_id": i["medicine_id"], "name": i["medicine"]["name"], "qty": i["qty"], "price": i["medicine"]["price"]} for i in cart["items"]],
        "subtotal": cart["subtotal"],
        "delivery_fee": cart["delivery_fee"],
        "discount": discount,
        "coupon_code": coupon_code,
        "wallet_used": wallet_used,
        "total": total,
        "payment_method": body.payment_method,
        "payment_status": "paid" if body.payment_method != "cod" else "pending",
        "status": "placed",
        "pharmacy": pharm,
        "address": address,
        "eta_minutes": pharm.get("eta_minutes", 18) if pharm else 18,
        "placed_at": iso(now_utc()),
        "prescription_id": body.prescription_id,
        "rider": {
            "name": random.choice(["Rohit Sharma", "Arjun Patel", "Vikram Singh", "Aman Verma"]),
            "phone": "+91 98XXXX" + str(random.randint(1000, 9999)),
            "vehicle": "Bike - MH 12 " + str(random.randint(1000, 9999)),
        },
        "timeline": [
            {"status": "placed", "label": "Order Placed", "at": iso(now_utc())},
            {"status": "confirmed", "label": "Pharmacy Confirmed", "at": iso(now_utc() + timedelta(minutes=1))},
            {"status": "packed", "label": "Medicines Packed", "at": iso(now_utc() + timedelta(minutes=4))},
            {"status": "out_for_delivery", "label": "Rider Assigned", "at": iso(now_utc() + timedelta(minutes=7))},
        ],
    }
    await db.orders.insert_one(order)
    if wallet_used > 0:
        await db.users.update_one({"id": user["id"]}, {"$inc": {"wallet_balance": -wallet_used}})
        await db.wallet_txns.insert_one({
            "id": new_id(), "user_id": user["id"], "type": "debit",
            "amount": wallet_used, "description": f"Paid for order #{order['order_number']}",
            "created_at": iso(now_utc()),
        })
    # loyalty points
    await db.users.update_one({"id": user["id"]}, {"$inc": {"loyalty_points": int(total // 50)}})
    await db.carts.update_one({"user_id": user["id"]}, {"$set": {"items": []}})
    order.pop("_id", None)
    return order

@api.get("/orders")
async def list_orders(user: dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": user["id"]}, {"_id": 0}).sort("placed_at", -1).to_list(100)
    return orders

@api.get("/orders/{order_id}")
async def get_order(order_id: str, user: dict = Depends(get_current_user)):
    o = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not o:
        raise HTTPException(404, "Order not found")
    if o["user_id"] != user["id"] and user["role"] not in ("admin", "pharmacy", "delivery"):
        raise HTTPException(403, "Forbidden")
    return o

# ---------- Prescriptions (GPT-5.2 Vision OCR) ----------
async def _run_ai_ocr(image_url: str) -> dict:
    """Use GPT-5.2 vision to OCR the prescription image and match against catalog."""
    if not LlmChat or not EMERGENT_LLM_KEY or not image_url:
        return {"medicines": [], "raw": ""}

    # Build catalog hint
    catalog = await db.medicines.find({}, {"_id": 0, "id": 1, "name": 1, "composition": 1, "brand": 1}).to_list(500)
    catalog_text = "\n".join([f"- {m['name']} ({m['brand']}) | {m['composition']}" for m in catalog])

    system_msg = (
        "You are a medical prescription OCR assistant for Sanjeevni pharmacy. "
        "Extract every medicine name, dosage, frequency and duration from the prescription image. "
        "Then map each detected medicine to the closest match from the pharmacy catalog. "
        "Respond ONLY with a single JSON object — no prose, no markdown — of the form: "
        '{"detected":[{"name":"...","dosage":"...","frequency":"...","match_name":"...","confidence":0.0-1.0}], "doctor_note":"..."}. '
        "match_name MUST be exactly one of the catalog entries (or empty string if no good match). "
        "confidence reflects how confident you are this medicine appears in the image."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"rx-{uuid.uuid4().hex[:8]}",
        system_message=system_msg + "\n\nCATALOG:\n" + catalog_text,
    ).with_model("openai", "gpt-5.2")

    # Build image content — accept data URL base64 or http URL
    image_content = None
    if image_url.startswith("data:"):
        try:
            b64 = image_url.split(",", 1)[1]
            image_content = ImageContent(image_base64=b64)
        except Exception:
            return {"medicines": [], "raw": "invalid_data_url"}
    elif image_url.startswith("http"):
        # GPT vision via emergentintegrations supports base64 best; for http, fetch and convert
        import base64, requests
        try:
            r = requests.get(image_url, timeout=15)
            r.raise_for_status()
            image_content = ImageContent(image_base64=base64.b64encode(r.content).decode())
        except Exception:
            return {"medicines": [], "raw": "fetch_failed"}
    else:
        return {"medicines": [], "raw": "unsupported_url"}

    user_msg = UserMessage(
        text="Extract medicines from this prescription and map each to a catalog entry. Reply only with the JSON object.",
        file_contents=[image_content],
    )
    try:
        reply = await chat.send_message(user_msg)
    except Exception as e:
        logging.exception("LLM OCR failed")
        return {"medicines": [], "raw": str(e)[:300]}

    # Parse JSON from reply
    raw = reply if isinstance(reply, str) else str(reply)
    m = re.search(r"\{.*\}", raw, re.S)
    parsed = {}
    try:
        parsed = json.loads(m.group(0)) if m else {}
    except Exception:
        parsed = {}

    detected = parsed.get("detected", []) or []
    # Map match_name back to medicine id
    name_to_id = {m["name"]: m["id"] for m in catalog}
    out = []
    for d in detected:
        match = d.get("match_name") or ""
        mid = name_to_id.get(match)
        if mid:
            out.append({
                "medicine_id": mid,
                "name": match,
                "dosage": d.get("dosage", ""),
                "frequency": d.get("frequency", ""),
                "confidence": float(d.get("confidence", 0.8) or 0.8),
            })
    return {"medicines": out, "raw": raw[:800]}


@api.post("/prescriptions")
async def upload_prescription(body: PrescriptionUploadIn, user: dict = Depends(get_current_user)):
    image_url = body.image_url or "https://images.pexels.com/photos/8842571/pexels-photo-8842571.jpeg"

    ai_result = await _run_ai_ocr(image_url)
    ai_detected = ai_result["medicines"]
    for d in ai_detected:
        d["source"] = "ai"

    # Fallback: if no AI detection, suggest random Rx-required medicines from catalog
    fallback_used = False
    if not ai_detected:
        fallback_used = True
        rx_meds = await db.medicines.find({"prescription_required": True}, {"_id": 0}).limit(20).to_list(20)
        picks = random.sample(rx_meds, min(3, len(rx_meds))) if rx_meds else []
        ai_detected = [{"medicine_id": m["id"], "name": m["name"], "confidence": round(random.uniform(0.78, 0.97), 2), "source": "suggestion"} for m in picks]

    rec = {
        "id": new_id(),
        "user_id": user["id"],
        "image_url": image_url if not image_url.startswith("data:") else "(uploaded image)",
        "note": body.note,
        "status": "verified",
        "ai_detected": ai_detected,
        "ai_raw": ai_result["raw"],
        "fallback_used": fallback_used,
        "created_at": iso(now_utc()),
    }
    await db.prescriptions.insert_one(rec); rec.pop("_id", None)
    return rec

@api.get("/prescriptions")
async def list_prescriptions(user: dict = Depends(get_current_user)):
    return await db.prescriptions.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

# ---------- Doctors & Consultations ----------
@api.get("/doctors")
async def list_doctors():
    return await db.doctors.find({}, {"_id": 0}).to_list(100)

@api.post("/consultations")
async def book_consultation(body: ConsultationIn, user: dict = Depends(get_current_user)):
    doc = await db.doctors.find_one({"id": body.doctor_id}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Doctor not found")
    booking = {
        "id": new_id(),
        "user_id": user["id"],
        "doctor": doc,
        "slot": body.slot,
        "reason": body.reason,
        "status": "confirmed",
        "fee": doc["fee"],
        "meeting_link": f"https://meet.sanjeevni.com/{new_id()[:8]}",
        "created_at": iso(now_utc()),
    }
    await db.consultations.insert_one(booking); booking.pop("_id", None)
    return booking

@api.get("/consultations")
async def list_consultations(user: dict = Depends(get_current_user)):
    return await db.consultations.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

# ---------- Lab Tests ----------
@api.get("/lab-tests")
async def list_lab_tests():
    return await db.lab_tests.find({}, {"_id": 0}).to_list(100)

@api.post("/lab-bookings")
async def book_lab(body: LabBookingIn, user: dict = Depends(get_current_user)):
    test = await db.lab_tests.find_one({"id": body.test_id}, {"_id": 0})
    if not test:
        raise HTTPException(404, "Test not found")
    booking = {
        "id": new_id(),
        "user_id": user["id"],
        "test": test,
        "slot": body.slot,
        "status": "scheduled",
        "phlebotomist": random.choice(["Neha S.", "Rakesh K.", "Priya M."]),
        "created_at": iso(now_utc()),
    }
    await db.lab_bookings.insert_one(booking); booking.pop("_id", None)
    return booking

@api.get("/lab-bookings")
async def list_lab_bookings(user: dict = Depends(get_current_user)):
    return await db.lab_bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)

# ---------- Admin ----------
@api.get("/admin/stats")
async def admin_stats(user: dict = Depends(require_role("admin"))):
    total_users = await db.users.count_documents({})
    total_orders = await db.orders.count_documents({})
    total_pharmacies = await db.pharmacies.count_documents({})
    total_medicines = await db.medicines.count_documents({})
    orders = await db.orders.find({}, {"_id": 0, "total": 1, "placed_at": 1, "status": 1}).to_list(2000)
    revenue = sum(o.get("total", 0) for o in orders)
    by_day = {}
    for o in orders:
        d = (o.get("placed_at") or "")[:10]
        by_day[d] = by_day.get(d, 0) + o.get("total", 0)
    chart = [{"date": k, "revenue": v} for k, v in sorted(by_day.items())][-7:]
    status_counts = {}
    for o in orders:
        s = o.get("status", "placed")
        status_counts[s] = status_counts.get(s, 0) + 1
    return {
        "total_users": total_users,
        "total_orders": total_orders,
        "total_pharmacies": total_pharmacies,
        "total_medicines": total_medicines,
        "revenue": revenue,
        "revenue_chart": chart,
        "status_counts": status_counts,
    }

@api.get("/admin/orders")
async def admin_orders(user: dict = Depends(require_role("admin"))):
    return await db.orders.find({}, {"_id": 0}).sort("placed_at", -1).limit(100).to_list(100)

@api.get("/admin/users")
async def admin_users(user: dict = Depends(require_role("admin"))):
    return await db.users.find({}, {"_id": 0, "password_hash": 0}).limit(200).to_list(200)

# ---------- Pharmacy ----------
@api.get("/pharmacy/dashboard")
async def pharmacy_dashboard(user: dict = Depends(require_role("pharmacy", "admin"))):
    orders = await db.orders.find({}, {"_id": 0}).sort("placed_at", -1).limit(50).to_list(50)
    inventory = await db.medicines.find({}, {"_id": 0}).limit(50).to_list(50)
    revenue = sum(o.get("total", 0) for o in orders)
    return {
        "orders": orders,
        "inventory": inventory,
        "revenue": revenue,
        "pending_orders": len([o for o in orders if o.get("status") == "placed"]),
        "low_stock": [m for m in inventory if m.get("stock", 0) < 10],
    }

# ---------- Wallet ----------
@api.get("/wallet")
async def get_wallet(user: dict = Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})
    txns = await db.wallet_txns.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(50)
    return {"balance": u.get("wallet_balance", 0), "loyalty_points": u.get("loyalty_points", 0), "transactions": txns}

# ---------- Razorpay Payments ----------
class CreateRzpOrderIn(BaseModel):
    amount: float  # rupees
    receipt: Optional[str] = None

class VerifyRzpIn(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str
    sanjeevni_order_id: Optional[str] = None

@api.get("/payments/config")
async def payments_config():
    return {"razorpay_key_id": os.environ.get("RAZORPAY_KEY_ID", ""), "enabled": rzp_client is not None}

@api.post("/payments/create-order")
async def create_rzp_order(body: CreateRzpOrderIn, user: dict = Depends(get_current_user)):
    if not rzp_client:
        raise HTTPException(503, "Razorpay not configured. Set RAZORPAY_KEY_ID & SECRET in backend/.env")
    amount_paise = int(round(body.amount * 100))
    receipt = (body.receipt or f"sj_{new_id()[:18]}")[:40]
    try:
        order = rzp_client.order.create({
            "amount": amount_paise,
            "currency": "INR",
            "receipt": receipt,
            "payment_capture": 1,
            "notes": {"user_id": user["id"], "user_email": user["email"]},
        })
    except Exception as e:
        raise HTTPException(502, f"Razorpay error: {str(e)[:200]}")
    await db.payments.insert_one({
        "id": new_id(), "user_id": user["id"], "razorpay_order_id": order["id"],
        "amount": body.amount, "status": "created", "created_at": iso(now_utc()),
    })
    return {"order_id": order["id"], "amount": amount_paise, "currency": "INR",
            "key_id": os.environ.get("RAZORPAY_KEY_ID", "")}

@api.post("/payments/verify")
async def verify_rzp(body: VerifyRzpIn, user: dict = Depends(get_current_user)):
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "")
    if not secret:
        raise HTTPException(503, "Razorpay not configured")
    payload = f"{body.razorpay_order_id}|{body.razorpay_payment_id}".encode()
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, body.razorpay_signature):
        await db.payments.update_one({"razorpay_order_id": body.razorpay_order_id}, {"$set": {"status": "failed"}})
        raise HTTPException(400, "Invalid signature")
    await db.payments.update_one(
        {"razorpay_order_id": body.razorpay_order_id},
        {"$set": {"status": "paid", "razorpay_payment_id": body.razorpay_payment_id, "paid_at": iso(now_utc())}}
    )
    if body.sanjeevni_order_id:
        await db.orders.update_one(
            {"id": body.sanjeevni_order_id, "user_id": user["id"]},
            {"$set": {"payment_status": "paid", "payment_method": "razorpay", "razorpay_payment_id": body.razorpay_payment_id}}
        )
    return {"verified": True}

# ============== Seed ==============
SEED_CATEGORIES = [
    {"id": "c-pain", "name": "Pain Relief", "icon": "Activity"},
    {"id": "c-fever", "name": "Fever & Cold", "icon": "Thermometer"},
    {"id": "c-diabetes", "name": "Diabetes Care", "icon": "Droplet"},
    {"id": "c-cardiac", "name": "Cardiac", "icon": "Heart"},
    {"id": "c-digestive", "name": "Digestive Health", "icon": "Sandwich"},
    {"id": "c-vitamins", "name": "Vitamins", "icon": "Pill"},
    {"id": "c-skin", "name": "Skin Care", "icon": "Sparkles"},
    {"id": "c-baby", "name": "Baby Care", "icon": "Baby"},
]

SEED_MEDICINES = [
    {"name": "Paracetamol 500mg", "brand": "Crocin", "composition": "Paracetamol 500mg", "category": "c-fever", "price": 28, "mrp": 35, "pack": "Strip of 15 tablets", "prescription_required": False, "stock": 240, "symptoms": "fever, headache, body pain", "manufacturer": "GSK", "image": "https://images.pexels.com/photos/8666436/pexels-photo-8666436.jpeg"},
    {"name": "Dolo 650", "brand": "Dolo", "composition": "Paracetamol 650mg", "category": "c-fever", "price": 32, "mrp": 40, "pack": "Strip of 15 tablets", "prescription_required": False, "stock": 320, "symptoms": "fever, headache", "manufacturer": "Micro Labs", "image": "https://images.pexels.com/photos/8442094/pexels-photo-8442094.jpeg"},
    {"name": "Azithromycin 500mg", "brand": "Azithral", "composition": "Azithromycin 500mg", "category": "c-fever", "price": 96, "mrp": 120, "pack": "Strip of 5 tablets", "prescription_required": True, "stock": 80, "symptoms": "bacterial infection", "manufacturer": "Alembic", "image": "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg"},
    {"name": "Ibuprofen 400mg", "brand": "Brufen", "composition": "Ibuprofen 400mg", "category": "c-pain", "price": 45, "mrp": 55, "pack": "Strip of 10 tablets", "prescription_required": False, "stock": 150, "symptoms": "pain, inflammation", "manufacturer": "Abbott", "image": "https://images.pexels.com/photos/4047148/pexels-photo-4047148.jpeg"},
    {"name": "Combiflam", "brand": "Combiflam", "composition": "Ibuprofen 400mg + Paracetamol 325mg", "category": "c-pain", "price": 38, "mrp": 45, "pack": "Strip of 20 tablets", "prescription_required": False, "stock": 200, "symptoms": "pain, body ache, fever", "manufacturer": "Sanofi", "image": "https://images.pexels.com/photos/4046718/pexels-photo-4046718.jpeg"},
    {"name": "Metformin 500mg", "brand": "Glycomet", "composition": "Metformin 500mg", "category": "c-diabetes", "price": 64, "mrp": 80, "pack": "Strip of 15 tablets", "prescription_required": True, "stock": 110, "symptoms": "type 2 diabetes", "manufacturer": "USV", "image": "https://images.pexels.com/photos/3683089/pexels-photo-3683089.jpeg"},
    {"name": "Glimepiride 2mg", "brand": "Amaryl", "composition": "Glimepiride 2mg", "category": "c-diabetes", "price": 145, "mrp": 175, "pack": "Strip of 10 tablets", "prescription_required": True, "stock": 60, "symptoms": "diabetes management", "manufacturer": "Sanofi", "image": "https://images.pexels.com/photos/3683101/pexels-photo-3683101.jpeg"},
    {"name": "Atorvastatin 10mg", "brand": "Atorva", "composition": "Atorvastatin 10mg", "category": "c-cardiac", "price": 88, "mrp": 110, "pack": "Strip of 10 tablets", "prescription_required": True, "stock": 95, "symptoms": "cholesterol, heart health", "manufacturer": "Zydus", "image": "https://images.pexels.com/photos/3873189/pexels-photo-3873189.jpeg"},
    {"name": "Telmisartan 40mg", "brand": "Telma", "composition": "Telmisartan 40mg", "category": "c-cardiac", "price": 132, "mrp": 165, "pack": "Strip of 15 tablets", "prescription_required": True, "stock": 70, "symptoms": "blood pressure", "manufacturer": "Glenmark", "image": "https://images.pexels.com/photos/3683105/pexels-photo-3683105.jpeg"},
    {"name": "Pantoprazole 40mg", "brand": "Pantop", "composition": "Pantoprazole 40mg", "category": "c-digestive", "price": 58, "mrp": 72, "pack": "Strip of 15 tablets", "prescription_required": False, "stock": 180, "symptoms": "acidity, heartburn", "manufacturer": "Aristo", "image": "https://images.pexels.com/photos/4047035/pexels-photo-4047035.jpeg"},
    {"name": "Digene Gel", "brand": "Digene", "composition": "Magnesium Hydroxide + Aluminum Hydroxide + Simethicone", "category": "c-digestive", "price": 92, "mrp": 110, "pack": "200ml bottle", "prescription_required": False, "stock": 130, "symptoms": "acidity, gas, indigestion", "manufacturer": "Abbott", "image": "https://images.pexels.com/photos/3683053/pexels-photo-3683053.jpeg"},
    {"name": "Vitamin D3 60K", "brand": "Calcirol", "composition": "Cholecalciferol 60000 IU", "category": "c-vitamins", "price": 38, "mrp": 48, "pack": "Sachet of 1g", "prescription_required": False, "stock": 220, "symptoms": "vitamin d deficiency", "manufacturer": "Cadila", "image": "https://images.pexels.com/photos/3683074/pexels-photo-3683074.jpeg"},
    {"name": "Vitamin C 500mg", "brand": "Limcee", "composition": "Ascorbic Acid 500mg", "category": "c-vitamins", "price": 26, "mrp": 33, "pack": "Strip of 15 chewable tablets", "prescription_required": False, "stock": 300, "symptoms": "immunity, vitamin c", "manufacturer": "Abbott", "image": "https://images.pexels.com/photos/4047148/pexels-photo-4047148.jpeg"},
    {"name": "Cetirizine 10mg", "brand": "Cetzine", "composition": "Cetirizine 10mg", "category": "c-skin", "price": 22, "mrp": 28, "pack": "Strip of 10 tablets", "prescription_required": False, "stock": 250, "symptoms": "allergy, itching, sneezing", "manufacturer": "Dr Reddy's", "image": "https://images.pexels.com/photos/3873189/pexels-photo-3873189.jpeg"},
    {"name": "Calpol Suspension", "brand": "Calpol", "composition": "Paracetamol 250mg/5ml", "category": "c-baby", "price": 65, "mrp": 78, "pack": "60ml bottle", "prescription_required": False, "stock": 140, "symptoms": "child fever", "manufacturer": "GSK", "image": "https://images.pexels.com/photos/3683089/pexels-photo-3683089.jpeg"},
    {"name": "ORS Powder", "brand": "Electral", "composition": "ORS WHO Formula", "category": "c-digestive", "price": 24, "mrp": 30, "pack": "21.8g sachet", "prescription_required": False, "stock": 400, "symptoms": "dehydration, diarrhea", "manufacturer": "FDC", "image": "https://images.pexels.com/photos/4046718/pexels-photo-4046718.jpeg"},
]

SEED_PHARMACIES = [
    {"id": "p1", "name": "Sanjeevni DarkStore Andheri", "address": "Andheri West, Mumbai", "pincode": "400058", "phone": "+91 9876500001", "rating": 4.8, "distance_km": 0.8, "dark_store": True},
    {"id": "p2", "name": "Sanjeevni DarkStore Bandra", "address": "Bandra West, Mumbai", "pincode": "400050", "phone": "+91 9876500002", "rating": 4.9, "distance_km": 1.2, "dark_store": True},
    {"id": "p3", "name": "MedPlus Powai", "address": "Powai, Mumbai", "pincode": "400076", "phone": "+91 9876500003", "rating": 4.6, "distance_km": 2.1, "dark_store": False},
    {"id": "p4", "name": "Apollo Pharmacy Vashi", "address": "Vashi, Navi Mumbai", "pincode": "400703", "phone": "+91 9876500004", "rating": 4.7, "distance_km": 3.4, "dark_store": False},
]

SEED_COUPONS = [
    {"id": "cp1", "code": "WELCOME50", "type": "percent", "value": 20, "max_discount": 100, "description": "20% off up to ₹100 on first order"},
    {"id": "cp2", "code": "HEALTH99", "type": "flat", "value": 99, "description": "Flat ₹99 off on orders above ₹499"},
    {"id": "cp3", "code": "SAVE30", "type": "percent", "value": 30, "max_discount": 200, "description": "30% off up to ₹200 on prescription medicines"},
]

SEED_DOCTORS = [
    {"id": "d1", "name": "Dr. Anjali Sharma", "specialty": "General Physician", "experience": 12, "fee": 299, "rating": 4.9, "languages": "English, Hindi", "image": "https://images.pexels.com/photos/5214958/pexels-photo-5214958.jpeg", "slots": ["10:00 AM", "11:30 AM", "2:00 PM", "4:00 PM", "6:30 PM"]},
    {"id": "d2", "name": "Dr. Rajesh Kapoor", "specialty": "Cardiologist", "experience": 18, "fee": 599, "rating": 4.8, "languages": "English, Hindi", "image": "https://images.pexels.com/photos/6129500/pexels-photo-6129500.jpeg", "slots": ["9:00 AM", "12:00 PM", "3:00 PM", "5:00 PM"]},
    {"id": "d3", "name": "Dr. Priya Nair", "specialty": "Dermatologist", "experience": 9, "fee": 449, "rating": 4.9, "languages": "English, Hindi, Tamil", "image": "https://images.pexels.com/photos/5407206/pexels-photo-5407206.jpeg", "slots": ["10:30 AM", "1:00 PM", "4:30 PM", "7:00 PM"]},
    {"id": "d4", "name": "Dr. Vikram Singh", "specialty": "Pediatrician", "experience": 14, "fee": 399, "rating": 4.9, "languages": "English, Hindi, Punjabi", "image": "https://images.pexels.com/photos/4173251/pexels-photo-4173251.jpeg", "slots": ["9:30 AM", "11:00 AM", "2:30 PM", "5:30 PM"]},
    {"id": "d5", "name": "Dr. Meera Iyer", "specialty": "Gynaecologist", "experience": 16, "fee": 549, "rating": 4.7, "languages": "English, Hindi", "image": "https://images.pexels.com/photos/5407210/pexels-photo-5407210.jpeg", "slots": ["10:00 AM", "12:30 PM", "3:30 PM", "6:00 PM"]},
    {"id": "d6", "name": "Dr. Sameer Joshi", "specialty": "Diabetologist", "experience": 20, "fee": 649, "rating": 4.9, "languages": "English, Hindi, Marathi", "image": "https://images.pexels.com/photos/4173239/pexels-photo-4173239.jpeg", "slots": ["9:00 AM", "11:30 AM", "2:00 PM", "5:00 PM"]},
]

SEED_LABS = [
    {"id": "l1", "name": "Complete Blood Count (CBC)", "category": "Routine", "price": 299, "mrp": 450, "fasting": False, "report_in": "6 hours", "tests_included": 24},
    {"id": "l2", "name": "Diabetes Profile (HbA1c + Fasting Sugar)", "category": "Diabetes", "price": 549, "mrp": 800, "fasting": True, "report_in": "12 hours", "tests_included": 5},
    {"id": "l3", "name": "Thyroid Profile (T3, T4, TSH)", "category": "Hormones", "price": 449, "mrp": 700, "fasting": False, "report_in": "8 hours", "tests_included": 3},
    {"id": "l4", "name": "Lipid Profile", "category": "Cardiac", "price": 399, "mrp": 600, "fasting": True, "report_in": "10 hours", "tests_included": 8},
    {"id": "l5", "name": "Vitamin D Total", "category": "Vitamins", "price": 699, "mrp": 1100, "fasting": False, "report_in": "24 hours", "tests_included": 1},
    {"id": "l6", "name": "Full Body Checkup Premium", "category": "Wellness", "price": 1499, "mrp": 3000, "fasting": True, "report_in": "24 hours", "tests_included": 75},
]

async def seed_collection(coll, items, key="id"):
    if await coll.count_documents({}) == 0 and items:
        await coll.insert_many([dict(i) for i in items])

async def seed_users():
    presets = [
        (os.environ.get("ADMIN_EMAIL", "admin@sanjeevni.com"), os.environ.get("ADMIN_PASSWORD", "Admin@123"), "admin", "Sanjeevni Admin"),
        (os.environ.get("PHARMACY_EMAIL", "pharmacy@sanjeevni.com"), os.environ.get("PHARMACY_PASSWORD", "Pharma@123"), "pharmacy", "Pharmacy Partner"),
        (os.environ.get("TEST_USER_EMAIL", "user@sanjeevni.com"), os.environ.get("TEST_USER_PASSWORD", "User@123"), "customer", "Test User"),
    ]
    for email, pw, role, name in presets:
        existing = await db.users.find_one({"email": email})
        if not existing:
            await db.users.insert_one({
                "id": new_id(), "name": name, "email": email, "phone": "",
                "role": role, "password_hash": hash_password(pw),
                "wallet_balance": 500 if role == "customer" else 0,
                "loyalty_points": 120 if role == "customer" else 0,
                "created_at": iso(now_utc()),
            })
        else:
            if not verify_password(pw, existing.get("password_hash", "")):
                await db.users.update_one({"email": email}, {"$set": {"password_hash": hash_password(pw)}})

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.medicines.create_index("name")
    # ensure seed medicines have ids
    if await db.medicines.count_documents({}) == 0:
        meds = []
        for m in SEED_MEDICINES:
            meds.append({"id": new_id(), **m})
        await db.medicines.insert_many(meds)
    await seed_collection(db.categories, SEED_CATEGORIES)
    await seed_collection(db.pharmacies, SEED_PHARMACIES)
    await seed_collection(db.coupons, SEED_COUPONS)
    await seed_collection(db.doctors, SEED_DOCTORS)
    await seed_collection(db.lab_tests, SEED_LABS)
    await seed_users()
    logging.info("Sanjeevni seed complete")

@app.on_event("shutdown")
async def shutdown():
    client.close()

@api.get("/")
async def root():
    return {"app": "Sanjeevni", "status": "ok", "tagline": "Medicines Delivered in 20 Minutes."}

app.include_router(api)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
