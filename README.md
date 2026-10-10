# GiveNest — Smart NGO Donation Management

A full-stack classroom project using React, Node.js, Express, MongoDB and Mongoose. It includes role-based dashboards, NGO approval, money/item donation tracking, SmartMatch recommendations, urgent wishlists, notifications, audit logs, campaign analytics, and printable donation acknowledgements.

## Requirements
- Node.js 20 or newer and npm
- MongoDB Community Server running locally, **or** a MongoDB Atlas connection string
- VS Code and a modern browser

## Quick start (Windows PowerShell)

1. Extract the ZIP. Open the `GiveNest` directory in VS Code.
2. Ensure **MongoDB Server** is running (MongoDB Compass and mongosh are clients, not the server).
3. Backend terminal:

```powershell
cd server
Copy-Item .env.example .env
# Edit .env and replace JWT_SECRET with your own long random string
npm install
npm run seed
npm run dev
```

4. Frontend terminal (start from the GiveNest root):

```powershell
cd client
npm install
npm run dev
```

5. Open **http://localhost:5173**. API health endpoint: **http://localhost:5000/api/health**.

The seed script does **not** overwrite a database that already has users. For a clean demo, use a fresh MongoDB database name in `MONGO_URI`. Do not delete real data.

## Seeded demo accounts

| Role | Email | Password |
|---|---|---|
| Administrator | admin@givenest.demo | Demo@12345 |
| NGO Manager | ngo@givenest.demo | Demo@12345 |
| Donor | donor@givenest.demo | Demo@12345 |

**Important:** These are intentionally public classroom demo credentials. Change passwords before any non-demo use. Do not deploy publicly without additional hardening.

## What each role can do

- **Donor:** Register, view approved NGOs, browse campaigns and urgent needs, run SmartMatch, submit item/money donation records, track own donations, view notifications, print acknowledgement when received.
- **NGO Manager:** View approved NGOs and own NGO, manage own campaigns and wishlists, review and update donations to own NGO, see NGO-scoped analytics, notifications.
- **Administrator:** Manage all donors, NGOs, users, campaigns, wishlists and donations, approve or reject NGOs, view audit logs and platform analytics. New NGO manager accounts can be created by the admin and assigned an NGO.

Roles are checked on the server. NGO-scoped queries prevent managers from editing another NGO's data; donor donation records are restricted to the donor's account.

## Donation workflow

`offered → accepted → scheduled → received`, or decline while pending. A manager can also mark an accepted donation as received directly. Each transition adds a dated history event and sends a database notification. On receiving an item donation, an exact item/category wishlist match updates the fulfilled count. A receipt can be printed once received.

## SmartMatch formula

The matching engine scores **approved NGOs** using:

- Accepted item category: **45 points**
- Matching active wishlist need: **30 points**
- Same city: **15 points**
- NGO approved: **10 points**

Results show the score and a plain-language explanation. This is deterministic rules-based matching, not a paid AI API. Scores are relative heuristics, not guarantees of suitability.

## REST API examples

| Method | Route | Function |
|---|---|---|
| POST | `/api/auth/register` | Donor registration |
| POST | `/api/auth/login` | JWT login |
| GET | `/api/me` | Current user |
| GET/POST | `/api/ngos` | NGO listing and creation |
| PUT/DELETE | `/api/ngos/:id` | NGO maintenance |
| PATCH | `/api/ngos/:id/approval` | Admin approval |
| GET/POST/PUT/DELETE | `/api/donors` and `/:id` | Donor CRUD |
| GET/POST/PUT/DELETE | `/api/campaigns` and `/:id` | Campaign CRUD |
| GET/POST/PUT/DELETE | `/api/wishlists` and `/:id` | Wishlist CRUD |
| GET/POST/PUT/DELETE | `/api/donations` and `/:id` | Donation records |
| PATCH | `/api/donations/:id/status` | Donation lifecycle |
| GET | `/api/match?category=toys&city=Hyderabad` | NGO matching |
| GET | `/api/stats` | Live aggregate dashboard |
| GET | `/api/notifications` | Personal notifications |
| PATCH | `/api/notifications/:id/read` | Mark read |
| GET | `/api/audit` | Admin audit log |
| GET/POST | `/api/users` | Admin user management |
| PATCH/DELETE | `/api/users/:id` | Admin user maintenance |

Authenticated routes require header `Authorization: Bearer <JWT>`.

## Suggested live judge demonstration (5 minutes)

1. Sign in as **Donor**. Run SmartMatch for `toys` in `Hyderabad`, inspect the match explanation and offer an item donation.
2. Sign out and sign in as **NGO Manager**. Find the new donation, accept and mark it received; show the timeline and wishlist progress.
3. Sign back in as **Donor**. Show the status, notification and printable acknowledgement.
4. Sign in as **Admin**. Demonstrate NGO approval, CRUD, role management, activity logs and live MongoDB metrics.
5. Open MongoDB Compass and verify changes in `donations`, `notifications`, `audits`, and `wishlists`.

## Troubleshooting

- `MongoDB connection failed`: Start the MongoDB service or configure an Atlas `MONGO_URI`.
- `JWT_SECRET missing`: Create `server/.env` from `.env.example` and set a 20+ character secret.
- `npm is not recognized`: Install Node.js LTS and restart VS Code.
- `Port already in use`: Stop the process using 5000 or 5173. If you change backend port, also update `API` in `client/src/main.jsx`.
- Seed skipped: You already have users in that database; use a fresh demo database URI if needed.
- MongoDB Shell is **not required** to run the application.

## Security and scope

Passwords are bcrypt-hashed, login uses expiring JWTs, roles are checked in Express, and Mongoose validates records. For production, add stronger input validation, rate limiting, HTTPS, CSRF-aware token storage, transactions for concurrent inventory updates, file upload scanning, robust audit retention, and NGO identity verification. This classroom build does **not** process real payments, perform identity verification, or issue tax certificates.

## Verification status

The REST API was exercised end to end (33 automated checks covering login, role permissions, the donation lifecycle, notifications, SmartMatch, campaign totals, approvals and audit logs) against a MongoDB-compatible database, and the client builds with `vite build`. The browser UI was **not** click-tested, so run through `TEST_PLAN.md` on the presentation laptop with real MongoDB before demoing.
