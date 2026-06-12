# Sanjeevni — Project Status Report

> **Hyperlocal Medicine Delivery Super-App** — _"Medicines Delivered in 20 Minutes."_
> Connecting customers, pharmacies, delivery partners, doctors and diagnostic labs.

_Generated: Analysis snapshot — read-only. No code was modified._

---

## 1. Tech Stack

### Frontend
| Layer | Technology |
|---|---|
| Framework | **React 19** (CRA via CRACO 7.1) |
| Routing | **react-router-dom 7.5** |
| Styling | **TailwindCSS 3.4** + `tailwindcss-animate` + `tailwind-merge` |
| UI Library | **Shadcn UI** (Radix primitives — accordion, dialog, dropdown, tabs, toast, etc.) |
| Icons | `lucide-react` |
| State / Data | React Context (Auth, Cart), `@tanstack/react-query`, `swr` |
| Forms / Validation | `react-hook-form` + `zod` + `@hookform/resolvers` |
| HTTP Client | `axios` |
| Charts | `recharts` 3.6 |
| Maps | `@react-google-maps/api` (live order tracking) |
| Animation | `framer-motion` |
| Notifications | `sonner` toaster |
| Dates | `date-fns`, `dayjs`, `react-day-picker` |

### Backend
| Layer | Technology |
|---|---|
| Framework | **FastAPI 0.110** |
| Server | uvicorn (managed by supervisor) |
| Database Driver | **Motor 3.3** (async MongoDB) |
| Auth | **JWT (PyJWT)** in HttpOnly cookies + `bcrypt` password hashing |
| Validation | Pydantic v2 |
| Payments | `razorpay` SDK 2.0 (HMAC-SHA256 verification) |
| AI / LLM | `emergentintegrations` → GPT-5.2 vision (via Emergent LLM Key) |
| Misc | `python-dotenv`, `python-multipart`, `requests`, `pillow` |

### Infrastructure
- **MongoDB** (single DB, name from `DB_NAME` env)
- **Supervisor** orchestrates `frontend` (port 3000) + `backend` (port 8001)
- **Kubernetes ingress**: routes `/api/*` → backend:8001, rest → frontend:3000
- Backend exposes via `REACT_APP_BACKEND_URL` (frontend → backend)

---

## 2. Folder Structure

```
/app
├── backend/
│   ├── server.py              # ~896 LOC — single-file FastAPI app
│   ├── requirements.txt       # Python deps
│   ├── .env                   # MONGO_URL, JWT_SECRET, EMERGENT_LLM_KEY, seed creds, Razorpay (empty)
│   └── tests/
│
├── frontend/
│   ├── package.json
│   ├── craco.config.js
│   ├── tailwind.config.js
│   ├── components.json        # shadcn config
│   ├── plugins/
│   ├── public/
│   └── src/
│       ├── App.js             # Router shell (15 routes)
│       ├── index.js / index.css / App.css
│       ├── components/
│       │   ├── Navbar.jsx
│       │   ├── Footer.jsx
│       │   ├── MedicineCard.jsx
│       │   ├── LiveTrackingMap.jsx     # Google Maps wrapper
│       │   └── ui/                     # Shadcn primitives
│       ├── context/
│       │   ├── AuthContext.jsx
│       │   └── CartContext.jsx
│       ├── pages/                      # 15 routed pages (see API list)
│       ├── lib/
│       │   ├── api.js                  # axios instance w/ REACT_APP_BACKEND_URL
│       │   └── utils.js
│       ├── hooks/use-toast.js
│       └── constants/testIds/
│
├── memory/
│   └── PRD.md                 # Living product doc
├── tests/                     # placeholder
├── scripts/                   # (empty)
├── test_reports/              # iteration_1.json, iteration_2.json
├── test_result.md             # Testing protocol scaffold (no logged tasks yet)
├── design_guidelines.json
└── README.md
```

---

## 3. Completed Features

### Customer-Facing
- ✅ **Landing page** — hero, 4 quick actions, 8 categories, trending grid, "how it works"
- ✅ **Auth** — register, email+password login, **phone OTP (mock — always `123456`)**, logout, `/auth/me`, JWT in HttpOnly cookies
- ✅ **Medicine catalog** — 16 SKUs seeded; search by name/composition/brand/symptom; filter by category & Rx
- ✅ **Medicine detail** — generic alternatives, reviews, tabs
- ✅ **Cart** — add / update qty / remove / clear; free delivery over ₹199 (else ₹29)
- ✅ **Coupons** — `WELCOME50`, `HEALTH99`, `SAVE30` (apply + show discount)
- ✅ **Checkout** — address CRUD, 4 mock payment methods, wallet credit, loyalty points
- ✅ **Live order tracking** — ETA countdown, rider info, status timeline, Google Maps animated marker
- ✅ **Order history** list
- ✅ **Doctor consultation** — 6 doctors, dialog slot booking, mock meet link
- ✅ **Lab tests** — 6 packages, home-collection slot booking
- ✅ **Profile** — wallet & loyalty cards + tabs (consults / labs / health records)

### AI / Integrations (Real)
- ✅ **GPT-5.2 Vision OCR** for prescriptions (Emergent Universal Key + `LlmChat` w/ `ImageContent`); catalog-aware matching with confidence; safe fallback to Rx suggestions
- ✅ **Razorpay payment integration** — server endpoints (config / create-order / verify w/ HMAC-SHA256). Keys empty in `.env` ⇒ graceful "not configured" UX
- ✅ **Google Maps live tracking** — animated rider marker (Mumbai pickup → drop). Falls back to static image when `REACT_APP_GOOGLE_MAPS_API_KEY` empty

### Operator Dashboards
- ✅ **Admin Dashboard** — KPIs (users, orders, pharmacies, medicines, revenue) + revenue line chart + status bar chart + orders/users tables
- ✅ **Pharmacy Panel** — GMV, pending orders, low-stock; Orders / Inventory / Low-stock tabs

### Engineering
- ✅ `data-testid` on every interactive element (test-friendly)
- ✅ Idempotent seed on startup (users, categories, medicines, pharmacies, coupons, doctors, lab_tests)
- ✅ Unique index on `users.email`; index on `medicines.name`
- ✅ Test credentials configured (admin / pharmacy / customer)

---

## 4. Missing / Pending Features

### P1 (high value, scoped but not built)
- ❌ **Live Razorpay keys** — backend coded; needs real `RAZORPAY_KEY_ID/SECRET` in `.env`
- ❌ **Live Google Maps key** — frontend coded; needs `REACT_APP_GOOGLE_MAPS_API_KEY`
- ❌ **Delivery Partner App** (web) — deferred to v2 (no UI, no GPS rider polling)
- ❌ **Family profiles** (multiple dependents per account)
- ❌ **Refill reminders & subscription orders** (recurring schedule)
- ❌ **Multilingual** — English + Hindi via `react-i18next`
- ❌ **Dark mode toggle** (`next-themes` installed, CSS vars wired — not exposed)
- ❌ **Doctor portal** — backend stores consultations but no doctor-side UI

### P2 (nice-to-have)
- ❌ Push notifications (FCM)
- ❌ Object-storage for Rx images (currently base64 in Mongo)
- ❌ Brute-force lockout on `/auth/login` (5 fails → 15 min)
- ❌ Voice search + barcode scanner
- ❌ Sponsored placements / featured pharmacy revenue
- ❌ Multi-warehouse inventory rules
- ❌ Real SMS provider for OTP (currently mock `123456`)
- ❌ Email transactional flows (order confirmation, password reset)
- ❌ Refund / cancellation flow

### Gaps in current implementation
- ❌ No automated test suite logged in `test_result.md` (file is only scaffold)
- ❌ Pharmacy panel is read-only (cannot update stock or order status from UI)
- ❌ Admin cannot suspend users / refund orders
- ❌ No rate limiting on public endpoints
- ❌ Address CRUD partial — `POST /addresses` exists, no UPDATE/DELETE
- ❌ No password reset / change-password endpoint
- ❌ Refresh-token rotation endpoint not wired (token created but no `/auth/refresh` route)

---

## 5. Database Schema (MongoDB collections)

| Collection | Key Fields | Purpose |
|---|---|---|
| **users** | `id` (uuid), `email` (unique), `password_hash`, `name`, `phone`, `role` ∈ {customer, pharmacy, admin, delivery}, `wallet_balance`, `loyalty_points`, `created_at` | Auth + profile |
| **addresses** | `id`, `user_id`, `label`, `line1`, `line2`, `city`, `state`, `pincode`, `is_default` | Shipping addresses |
| **categories** | `id`, `name`, `icon` | 8 seeded categories |
| **medicines** | `id`, `name`, `brand`, `composition`, `category`, `price`, `mrp`, `pack`, `prescription_required`, `stock`, `symptoms`, `manufacturer`, `image` | 16 seeded SKUs |
| **pharmacies** | `id`, `name`, `address`, `pincode`, `phone`, `rating`, `distance_km`, `dark_store` | 4 seeded |
| **coupons** | `id`, `code`, `type` ∈ {percent, flat}, `value`, `max_discount`, `description` | 3 seeded |
| **doctors** | `id`, `name`, `specialty`, `experience`, `fee`, `rating`, `languages`, `image`, `slots[]` | 6 seeded |
| **lab_tests** | `id`, `name`, `category`, `price`, `mrp`, `fasting`, `report_in`, `tests_included` | 6 seeded |
| **carts** | `user_id`, `items[]:{medicine_id, qty}`, `updated_at` | One per user |
| **orders** | `id`, `order_number` (SJ######), `user_id`, `items[]`, `subtotal`, `delivery_fee`, `discount`, `coupon_code`, `wallet_used`, `total`, `payment_method`, `payment_status`, `status`, `pharmacy`, `address`, `rider:{name,phone,vehicle}`, `eta_minutes`, `timeline[]`, `placed_at`, `prescription_id`, `razorpay_payment_id?` | Orders |
| **prescriptions** | `id`, `user_id`, `image_url`, `note`, `status`, `ai_detected[]:{medicine_id,name,dosage,frequency,confidence,source}`, `ai_raw`, `fallback_used`, `created_at` | Rx uploads + OCR result |
| **consultations** | `id`, `user_id`, `doctor`, `slot`, `reason`, `status`, `fee`, `meeting_link`, `created_at` | Doctor bookings |
| **lab_bookings** | `id`, `user_id`, `test`, `slot`, `status`, `phlebotomist`, `created_at` | Lab bookings |
| **reviews** | `id`, `user_id`, `user_name`, `medicine_id`, `rating`, `comment`, `created_at` | Medicine reviews |
| **wallet_txns** | `id`, `user_id`, `type` ∈ {credit, debit}, `amount`, `description`, `created_at` | Wallet ledger |
| **payments** | `id`, `user_id`, `razorpay_order_id`, `razorpay_payment_id?`, `amount`, `status` ∈ {created, paid, failed}, `created_at`, `paid_at?` | Razorpay records |
| **otps** | `phone`, `otp`, `expires_at` | Mock OTPs |

**Conventions**
- All ids are **UUIDv4 strings** (never ObjectId, per spec)
- Datetimes stored as **ISO 8601 strings**
- `email` is the only enforced unique index

---

## 6. API List (all routes prefixed `/api`)

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/register` | — | Create user; sets HttpOnly cookies |
| POST | `/auth/login` | — | Email+password login |
| POST | `/auth/otp/request` | — | Mock OTP (returns `123456`) |
| POST | `/auth/otp/verify` | — | Verify OTP + auto-register if new |
| POST | `/auth/logout` | — | Clear cookies |
| GET  | `/auth/me` | ✓ | Current user |

### Addresses
| GET | `/addresses` | ✓ | List user's addresses |
| POST | `/addresses` | ✓ | Add address (handles default flag) |

### Catalog
| GET | `/categories` | — | List categories |
| GET | `/medicines?q=&category=&prescription_only=&limit=` | — | Search/list |
| GET | `/medicines/{id}` | — | Detail + alternatives |
| GET | `/medicines/{id}/reviews` | — | Reviews |
| POST | `/reviews` | ✓ | Submit review |

### Pharmacies
| GET | `/pharmacies` | — | All pharmacies |
| GET | `/pharmacies/nearest?pincode=` | — | Nearest + ETA |

### Cart
| GET | `/cart` | ✓ | Cart w/ enriched items + totals |
| POST | `/cart/add` | ✓ | Add / increment |
| POST | `/cart/update` | ✓ | Set qty (0 = remove) |
| POST | `/cart/clear` | ✓ | Clear cart |

### Coupons
| GET | `/coupons` | — | List public coupons |
| POST | `/coupons/apply?code=` | ✓ | Compute discount |

### Orders
| POST | `/orders/checkout` | ✓ | Place order, generate rider+timeline, deduct wallet, add loyalty |
| GET  | `/orders` | ✓ | List my orders |
| GET  | `/orders/{id}` | ✓ | Order detail (owner / admin / pharmacy / delivery) |

### Prescriptions (GPT-5.2 Vision OCR)
| POST | `/prescriptions` | ✓ | Upload Rx (data URL or http); runs OCR; safe fallback |
| GET  | `/prescriptions` | ✓ | My uploads |

### Doctors & Consultations
| GET | `/doctors` | — | List |
| POST | `/consultations` | ✓ | Book slot |
| GET  | `/consultations` | ✓ | My bookings |

### Lab Tests
| GET | `/lab-tests` | — | List |
| POST | `/lab-bookings` | ✓ | Book |
| GET  | `/lab-bookings` | ✓ | My bookings |

### Wallet
| GET | `/wallet` | ✓ | Balance + loyalty + ledger |

### Razorpay Payments
| GET | `/payments/config` | — | `{razorpay_key_id, enabled}` |
| POST | `/payments/create-order` | ✓ | Create Razorpay order (amount in ₹) |
| POST | `/payments/verify` | ✓ | HMAC-SHA256 signature verify; mark order paid |

### Admin (role: admin)
| GET | `/admin/stats` | ✓ admin | KPIs + 7-day revenue chart + status counts |
| GET | `/admin/orders` | ✓ admin | Last 100 orders |
| GET | `/admin/users` | ✓ admin | Up to 200 users |

### Pharmacy (role: pharmacy / admin)
| GET | `/pharmacy/dashboard` | ✓ pharm/admin | Orders + inventory + revenue + low-stock |

### Misc
| GET | `/` | — | Health/heartbeat |

---

## 7. Current Development Status

| Area | Status |
|---|---|
| MVP scope (per PRD, June 11 2026) | **🟢 Complete & shippable** |
| All seed data | 🟢 Idempotent on startup |
| Auth flows | 🟢 Working (email+password + mock OTP) |
| Catalog → Cart → Checkout → Tracking | 🟢 End-to-end working |
| GPT-5.2 Vision OCR | 🟢 Live (Emergent LLM key present in backend `.env`) |
| Razorpay | 🟡 **Code complete, keys NOT configured** in `backend/.env` (UI shows "not configured" gracefully) |
| Google Maps live tracking | 🟡 **Code complete, key NOT configured** in `frontend/.env` (UI falls back to static image) |
| Admin & Pharmacy dashboards | 🟢 Read-only views working |
| `test_result.md` | 🟡 Scaffold only — no tasks logged yet |
| `tests/` & `scripts/` | 🟡 Empty placeholders |
| Documentation | 🟢 `memory/PRD.md` is the living doc |

**Test credentials**
- Admin → `admin@sanjeevni.com` / `Admin@123`
- Pharmacy → `pharmacy@sanjeevni.com` / `Pharma@123`
- Customer → `user@sanjeevni.com` / `User@123`
- Mock OTP → any phone, OTP is always `123456`

**Activate live keys** (when ready)
```bash
# backend/.env
RAZORPAY_KEY_ID="rzp_test_..."
RAZORPAY_KEY_SECRET="..."
# sudo supervisorctl restart backend

# frontend/.env
REACT_APP_GOOGLE_MAPS_API_KEY="AIza..."
REACT_APP_RAZORPAY_KEY_ID="rzp_test_..."   # optional, backend serves it too
# sudo supervisorctl restart frontend
```

---

## 8. Recommended Next Steps (suggestions only — awaiting your decision)

1. **Plug in real Razorpay & Google Maps keys** — fastest unlock for "real" feeling demo.
2. **Family profiles** + **refill reminders** — high consumer value, no third-party deps.
3. **Doctor portal** — backend models exist; add a `/doctor` route with consult list + meet link.
4. **Pharmacy: write actions** — let pharmacy update order `status` and adjust inventory.
5. **i18n (English / Hindi)** + **Dark mode toggle** — both libs already installed.
6. **Real SMS OTP** (Twilio / MSG91) and **password reset email** (SendGrid / Resend).
7. **Address UPDATE / DELETE endpoints + `/auth/refresh` route** — small but obvious gaps.

---

_Analysis complete. **No files were modified.** Awaiting your direction on what to build next._
