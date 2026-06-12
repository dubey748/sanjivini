# Sanjeevni — Product Requirements (Living Doc)

## Original Problem Statement
Build a production-grade full-stack medicine delivery platform named Sanjeevni.
Tagline: "Medicines Delivered in 20 Minutes." Hyperlocal healthcare super-app
connecting customers, pharmacies, delivery partners, doctors and diagnostic labs.

## Architecture (As-built)
- **Frontend**: React 19 + React Router 7 + Tailwind + Shadcn UI + Recharts
- **Backend**: FastAPI + Motor (Async MongoDB) + JWT (HttpOnly cookies) + bcrypt
- **Database**: MongoDB (single DB, collections: users, addresses, medicines,
  categories, pharmacies, coupons, doctors, lab_tests, carts, orders,
  prescriptions, consultations, lab_bookings, wallet_txns, otps, reviews)
- **Auth**: Email/password JWT + Mock phone OTP (always 123456)
- **All AI / payments / maps are mocked by design (MVP)**

## User Personas
1. **Customer** — orders medicines, books doctors/lab tests, uploads Rx
2. **Pharmacy Partner** — manages inventory, fulfills orders
3. **Admin** — monitors business KPIs, all orders, all users
4. **Delivery Partner** (deferred to v2)
5. **Doctor** (consultation backend only)


## Admin Portal — Phase 1 (June 12, 2026)
- ✅ **Hidden `/admin` portal** — no link in nav/footer; reachable only by URL
- ✅ **Server-side handshake** via new `GET /api/admin/whoami` (role gate) + `GET /api/admin/health`
- ✅ **Admin Layout** — sidebar w/ 5 nav groups + responsive topbar + mobile drawer
- ✅ **Admin Dashboard skeleton** — KPIs, 7-day revenue line chart, status bar chart, orders & users tables (uses existing `/api/admin/stats|orders|users`)
- ✅ **Idempotent baseline migration `m001_baseline`** — added `is_active=True` + `updated_at` to existing seed (16 medicines, 8 categories, 4 pharmacies, 6 doctors, 6 lab_tests, 3 coupons); created `audit_log` collection w/ indexes; recorded itself in `db.migrations` for traceability
- ✅ **Customer site unchanged** — `Navbar` no longer shows "Admin Panel" dropdown item; pharmacy item retained
- 📋 40/40 backend tests passed (whoami/health gate, regression on existing admin & customer endpoints)

## Implemented (June 11, 2026)
- ✅ Premium "Organic & Earthy" UI per design guidelines (Forest Green + Terracotta)
- ✅ Landing page with hero, 4 quick actions, 8 categories, trending grid, how-it-works
- ✅ Auth: register, email login, OTP login (mock), logout, /auth/me, seeded users
- ✅ Medicine catalog (16 SKUs), search (name/composition/brand/symptom), category & Rx filter
- ✅ Medicine detail page with generic alternatives + reviews + tabs
- ✅ Cart (add/update/remove/clear) with free-delivery-over-₹199 logic
- ✅ Coupons (WELCOME50, HEALTH99, SAVE30) — apply & display discount
- ✅ Checkout with address CRUD, 4 payment methods (mock), wallet credit, loyalty points
- ✅ Live order tracking page with ETA countdown, rider info, timeline
- ✅ Orders history list
- ✅ Doctor consultation: 6 doctors, dialog slot booking, mock meet link
- ✅ Lab tests: 6 packages, home-collection slot booking
- ✅ Profile with wallet/loyalty cards + tabs (consults/labs/health records)
- ✅ Admin Dashboard: KPIs + revenue chart (line) + status chart (bar) + orders/users tables
- ✅ Pharmacy Panel: GMV/orders/low-stock + Orders/Inventory/Low-stock tabs
- ✅ data-testid on every interactive element (passed automated testing)

## Real Integrations (June 11, 2026)
- ✅ **GPT-5.2 vision OCR** for prescription reading (Emergent Universal Key, emergentintegrations.LlmChat with ImageContent). Catalog-aware matching with confidence scores. Falls back to Rx suggestions with `source:"suggestion"` flag when AI can't parse.
- ✅ **Razorpay** payment integration (server: `/api/payments/config`, `/api/payments/create-order`, `/api/payments/verify` with HMAC-SHA256 signature verify). Frontend: dynamic Checkout.js script load + window.Razorpay modal. KEY/SECRET env vars are EMPTY by design — UI gracefully shows "not configured" message. **Paste keys into `backend/.env` to activate.**
- ✅ **Google Maps live tracking** on order tracking page using `@react-google-maps/api`. Animated rider marker moves from Mumbai pickup to delivery point. Gracefully falls back to static image when `REACT_APP_GOOGLE_MAPS_API_KEY` is empty. **Paste key into `frontend/.env` to activate.**

## How to activate live keys
```bash
# backend/.env
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
# Restart: sudo supervisorctl restart backend

# frontend/.env
REACT_APP_GOOGLE_MAPS_API_KEY="AIza..."
REACT_APP_RAZORPAY_KEY_ID="rzp_test_..."  # optional, backend serves it too
# Restart: sudo supervisorctl restart frontend
```

## Backlog (P1)
- Real Razorpay/Stripe payment integration
- Real Google Maps live tracking + GPS rider polling
- Real AI Rx OCR via GPT-5.2 / Claude Sonnet (Emergent LLM key)
- Family profiles + Medicine refill reminders + Subscription orders
- Multilingual (English + Hindi) — react-i18next
- Dark mode toggle (CSS variables already wired)
- Delivery Partner App (web) with route optimization

## Backlog (P2)
- Push notifications (FCM)
- Object-storage based prescription images (currently base64 in DB)
- Brute-force lockout on /auth/login (5-fail → 15 min)
- Voice search + barcode scanner
- Sponsored placements / featured pharmacy listings revenue
- Multi-warehouse inventory rules

## Test Credentials
See `/app/memory/test_credentials.md`
