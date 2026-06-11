"""Sanjeevni backend API test suite."""
import os
import time
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend .env if env not propagated
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

API = f"{BASE_URL}/api"

CUSTOMER = {"email": "user@sanjeevni.com", "password": "User@123"}
ADMIN = {"email": "admin@sanjeevni.com", "password": "Admin@123"}
PHARMACY = {"email": "pharmacy@sanjeevni.com", "password": "Pharma@123"}


@pytest.fixture(scope="session")
def customer_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200, f"customer login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200, f"admin login failed: {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="session")
def pharmacy_session():
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json=PHARMACY, timeout=30)
    assert r.status_code == 200, f"pharmacy login failed: {r.status_code} {r.text}"
    return s


# -------- Health --------
def test_root():
    r = requests.get(f"{API}/", timeout=30)
    assert r.status_code == 200
    assert r.json().get("status") == "ok"


# -------- Auth --------
def test_login_customer():
    r = requests.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["email"] == CUSTOMER["email"]
    assert data["role"] == "customer"
    assert "access_token" in r.cookies


def test_login_admin():
    r = requests.post(f"{API}/auth/login", json=ADMIN, timeout=30)
    assert r.status_code == 200
    assert r.json()["role"] == "admin"


def test_login_pharmacy():
    r = requests.post(f"{API}/auth/login", json=PHARMACY, timeout=30)
    assert r.status_code == 200
    assert r.json()["role"] == "pharmacy"


def test_login_invalid():
    r = requests.post(f"{API}/auth/login", json={"email": CUSTOMER["email"], "password": "wrong"}, timeout=30)
    assert r.status_code == 401


def test_register_and_me():
    s = requests.Session()
    email = f"test_{uuid.uuid4().hex[:8]}@example.com"
    r = s.post(f"{API}/auth/register", json={
        "name": "TEST User", "email": email, "password": "Test@1234"
    }, timeout=30)
    assert r.status_code == 200, r.text
    user = r.json()
    assert user["email"] == email
    assert user["wallet_balance"] == 100
    # /me
    me = s.get(f"{API}/auth/me", timeout=30)
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_otp_flow():
    s = requests.Session()
    phone = "+9199" + str(int(time.time()))[-7:]
    r = s.post(f"{API}/auth/otp/request", json={"phone": phone}, timeout=30)
    assert r.status_code == 200
    r2 = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": "123456", "name": "OTP User"}, timeout=30)
    assert r2.status_code == 200
    assert r2.json()["phone"] == phone


def test_otp_invalid():
    s = requests.Session()
    phone = "+9188" + str(int(time.time()))[-7:]
    s.post(f"{API}/auth/otp/request", json={"phone": phone}, timeout=30)
    r = s.post(f"{API}/auth/otp/verify", json={"phone": phone, "otp": "000000"}, timeout=30)
    assert r.status_code == 401


# -------- Catalog --------
def test_categories():
    r = requests.get(f"{API}/categories", timeout=30)
    assert r.status_code == 200
    assert len(r.json()) >= 6


def test_medicines_list():
    r = requests.get(f"{API}/medicines", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 16


def test_medicines_search():
    r = requests.get(f"{API}/medicines", params={"q": "paracetamol"}, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1
    assert any("paracetamol" in (m.get("composition", "") + m.get("name", "")).lower() for m in data)


def test_medicines_rx_filter():
    r = requests.get(f"{API}/medicines", params={"prescription_only": "true"}, timeout=30)
    assert r.status_code == 200
    assert all(m.get("prescription_required") for m in r.json())


def test_medicine_detail():
    r = requests.get(f"{API}/medicines", timeout=30)
    mid = r.json()[0]["id"]
    r2 = requests.get(f"{API}/medicines/{mid}", timeout=30)
    assert r2.status_code == 200
    detail = r2.json()
    assert detail["id"] == mid
    assert "alternatives" in detail


# -------- Cart + Checkout --------
def test_cart_add_update_clear(customer_session):
    s = customer_session
    s.post(f"{API}/cart/clear", timeout=30)
    meds = requests.get(f"{API}/medicines", timeout=30).json()
    mid = meds[0]["id"]
    r = s.post(f"{API}/cart/add", json={"medicine_id": mid, "qty": 2}, timeout=30)
    assert r.status_code == 200
    cart = r.json()
    assert cart["items"][0]["qty"] == 2
    assert cart["subtotal"] > 0
    # update qty
    r2 = s.post(f"{API}/cart/update", json={"medicine_id": mid, "qty": 5}, timeout=30)
    assert r2.json()["items"][0]["qty"] == 5
    # clear
    r3 = s.post(f"{API}/cart/clear", timeout=30)
    assert r3.json()["items"] == []


def test_delivery_fee_logic(customer_session):
    s = customer_session
    s.post(f"{API}/cart/clear", timeout=30)
    meds = sorted(requests.get(f"{API}/medicines", timeout=30).json(), key=lambda m: m["price"])
    cheap = meds[0]["id"]
    s.post(f"{API}/cart/add", json={"medicine_id": cheap, "qty": 1}, timeout=30)
    cart = s.get(f"{API}/cart", timeout=30).json()
    if cart["subtotal"] < 199:
        assert cart["delivery_fee"] == 29
    s.post(f"{API}/cart/clear", timeout=30)


def test_coupons_list():
    r = requests.get(f"{API}/coupons", timeout=30)
    assert r.status_code == 200
    codes = {c["code"] for c in r.json()}
    assert {"WELCOME50", "HEALTH99", "SAVE30"}.issubset(codes)


def test_coupon_apply(customer_session):
    s = customer_session
    s.post(f"{API}/cart/clear", timeout=30)
    meds = requests.get(f"{API}/medicines", timeout=30).json()
    # add enough quantity for coupon to apply
    s.post(f"{API}/cart/add", json={"medicine_id": meds[0]["id"], "qty": 10}, timeout=30)
    r = s.post(f"{API}/coupons/apply", params={"code": "WELCOME50"}, timeout=30)
    assert r.status_code == 200, r.text
    assert r.json()["discount"] > 0
    s.post(f"{API}/cart/clear", timeout=30)


def test_address_and_checkout(customer_session):
    s = customer_session
    # add address
    addr_payload = {"label": "Home TEST", "line1": "12 Test Lane", "city": "Mumbai", "state": "MH", "pincode": "400058", "is_default": True}
    ra = s.post(f"{API}/addresses", json=addr_payload, timeout=30)
    assert ra.status_code == 200
    addr_id = ra.json()["id"]
    # cart
    s.post(f"{API}/cart/clear", timeout=30)
    meds = requests.get(f"{API}/medicines", timeout=30).json()
    s.post(f"{API}/cart/add", json={"medicine_id": meds[0]["id"], "qty": 3}, timeout=30)
    # checkout
    r = s.post(f"{API}/orders/checkout", json={
        "address_id": addr_id, "payment_method": "upi", "coupon_code": "WELCOME50", "use_wallet": False
    }, timeout=30)
    assert r.status_code == 200, r.text
    order = r.json()
    assert order["status"] == "placed"
    assert order["coupon_code"] == "WELCOME50"
    assert order["pharmacy"]
    assert order["rider"]["name"]
    assert len(order["timeline"]) >= 4
    # fetch
    r2 = s.get(f"{API}/orders/{order['id']}", timeout=30)
    assert r2.status_code == 200
    # orders list
    r3 = s.get(f"{API}/orders", timeout=30)
    assert r3.status_code == 200
    assert any(o["id"] == order["id"] for o in r3.json())


def test_checkout_empty_cart(customer_session):
    s = customer_session
    s.post(f"{API}/cart/clear", timeout=30)
    r = s.post(f"{API}/orders/checkout", json={"payment_method": "upi"}, timeout=30)
    assert r.status_code == 400


# -------- Prescriptions --------
def test_prescription_upload(customer_session):
    s = customer_session
    r = s.post(f"{API}/prescriptions", json={"note": "TEST"}, timeout=30)
    assert r.status_code == 200
    p = r.json()
    assert "ai_detected" in p
    r2 = s.get(f"{API}/prescriptions", timeout=30)
    assert r2.status_code == 200


# -------- Doctors & Lab Tests --------
def test_doctors():
    r = requests.get(f"{API}/doctors", timeout=30)
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_consultation_booking(customer_session):
    s = customer_session
    docs = requests.get(f"{API}/doctors", timeout=30).json()
    r = s.post(f"{API}/consultations", json={"doctor_id": docs[0]["id"], "slot": docs[0]["slots"][0], "reason": "TEST"}, timeout=30)
    assert r.status_code == 200
    assert r.json()["status"] == "confirmed"


def test_lab_tests():
    r = requests.get(f"{API}/lab-tests", timeout=30)
    assert r.status_code == 200
    assert len(r.json()) == 6


def test_lab_booking(customer_session):
    s = customer_session
    tests = requests.get(f"{API}/lab-tests", timeout=30).json()
    r = s.post(f"{API}/lab-bookings", json={"test_id": tests[0]["id"], "slot": "10:00 AM"}, timeout=30)
    assert r.status_code == 200


# -------- Admin --------
def test_admin_stats(admin_session):
    r = admin_session.get(f"{API}/admin/stats", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("total_users", "total_orders", "total_medicines", "revenue", "revenue_chart", "status_counts"):
        assert k in d


def test_admin_orders(admin_session):
    r = admin_session.get(f"{API}/admin/orders", timeout=30)
    assert r.status_code == 200


def test_admin_users(admin_session):
    r = admin_session.get(f"{API}/admin/users", timeout=30)
    assert r.status_code == 200


def test_admin_forbidden_for_customer(customer_session):
    r = customer_session.get(f"{API}/admin/stats", timeout=30)
    assert r.status_code == 403


# -------- Pharmacy --------
def test_pharmacy_dashboard(pharmacy_session):
    r = pharmacy_session.get(f"{API}/pharmacy/dashboard", timeout=30)
    assert r.status_code == 200
    d = r.json()
    for k in ("orders", "inventory", "revenue", "pending_orders", "low_stock"):
        assert k in d


# -------- Wallet --------
def test_wallet(customer_session):
    r = customer_session.get(f"{API}/wallet", timeout=30)
    assert r.status_code == 200
    assert "balance" in r.json()


# -------- Logout --------
def test_logout():
    s = requests.Session()
    s.post(f"{API}/auth/login", json=CUSTOMER, timeout=30)
    r = s.post(f"{API}/auth/logout", timeout=30)
    assert r.status_code == 200
    # cookies cleared - /me should now fail
    me = s.get(f"{API}/auth/me", timeout=30)
    assert me.status_code == 401
