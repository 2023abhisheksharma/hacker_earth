# Card Benefit Activation Engine - Work Log

This file tracks all work done by the orchestrator and subagents.
Read it before starting work, append your section after finishing.

---
Task ID: 1
Agent: orchestrator
Task: Foundation - Prisma schema, types, constants, benefit catalog, detection engine, SMS/email parser, auth, prefill, storage

Work Log:
- Wrote prisma/schema.prisma with User, Session, Card, CardBenefit, Transaction, Benefit, Claim, Document models
- Wrote src/lib/types.ts (shared domain types)
- Wrote src/lib/constants.ts (Indian banks, benefit type info, MCC groups, category inference)
- Wrote src/lib/benefits/catalog.ts (5 Indian bank cards with full benefit catalogs)
- Wrote src/lib/benefits/detector.ts (rule + scoring detection engine)
- Wrote src/lib/parser/sms-parser.ts (HDFC/ICICI/Axis/SBI/Kotak SMS parsing)
- Wrote src/lib/parser/email-parser.ts (statement table + single-txn email parsing)
- Wrote src/lib/auth.ts (session-based, NO credential storage, httpOnly cookie)
- Wrote src/lib/prefill.ts (claim form pre-fill engine, benefit-specific fields)
- Wrote src/lib/storage.ts (document storage for image/pdf/text)

Stage Summary:
- Foundation complete. DB schema pushed.
- Key contracts:
  - Auth: cookie `cba_session`, getCurrentUser() returns user or null
  - Detection: detectBenefits({amount,merchant,mcc,category,date,cardBankName,cardName}) -> DetectedBenefit[]
  - Parse: parseSms(raw), parseSmsBatch(raw), parseEmail({subject,from,body,receivedAt})
  - Prefill: prefillClaim({benefitType,bankName,cardName,cardLast4,transaction,user,coverageAmount}) -> PreFilledClaim{fields,documents,portalUrl}
  - Storage: saveUpload(claimId,filename,mimeType,bytes)
- Bank portals all point to mock portal at http://localhost:3005 (built by Task 2-pw)
- Playwright service expected at port 3004 (built by Task 2-pw)
- Next.js app API routes will be built by orchestrator next; frontend by orchestrator next.

---
Task ID: 2-pw
Agent: playwright-service-builder
Task: Build Playwright automation service (port 3004) + mock Indian bank claim portal (port 3005)

Work Log:
- Read existing foundation: src/lib/types.ts (ClaimFormField, PreFilledClaim, AutomationStep), src/lib/prefill.ts (field shape), src/lib/constants.ts (BANK_PORTALS all point to http://localhost:3005), Caddyfile (XTransformPort query → reverse_proxy localhost:PORT).
- Created mini-services/mock-portal/package.json with `dev: "bun --hot index.ts"` (port 3005 hard-coded).
- Created mini-services/mock-portal/index.ts — Bun.serve on port 3005 with:
  - GET / returns a self-contained HTML page (no external CSS/JS — inline CSS using emerald/teal + slate palette, no blue/indigo). HDFC SmartHub branding, sticky header, card layout, responsive.
  - Login section (User ID + Password + Login button). Any credentials accepted; on submit, hides login + reveals claim form + shows "Welcome, Card Member" pill.
  - Claim form section "File a New Protection Claim" with all 18 required fields, each with proper name/id/label/placeholder: cardholder_name, email, mobile, card_last4 (maxlength=4), card_name, merchant, txn_date, txn_amount, claim_amount, claim_type (select with 6 options), incident_date, flight_number, delay_duration, baggage_tag, product_name, warranty_expiry, incident_desc (textarea), documents (input type=file multiple accept=".pdf,.jpg,.jpeg,.png,.txt").
  - "Submit Claim" button. On submit, client-side JS reads all fields via FormData, builds a summary object, generates a random reference (HDFC-CLM-<ts>-<rnd>), shows success banner "Claim submitted successfully! Reference: <ref>" and a summary table echoing back all submitted values. Exposes window.__lastSubmittedClaim for Playwright verification.
  - POST /api/claim accepts JSON or form-encoded body, returns { ok: true, reference, received }.
  - GET /api/health returns { ok: true, service: "mock-portal" }.
  - CORS headers (Access-Control-Allow-Origin: *) on every response; OPTIONS preflight handled.
- Created mini-services/playwright-service/package.json with `dev: "bun --hot index.ts"` (port 3004 hard-coded), deps: playwright ^1.48.0, socket.io ^4.8.0 (also socket.io-client for tests).
- Ran `bun install` in mini-services/playwright-service — installed playwright@1.62.0 + socket.io@4.8.3.
- Ran `bunx playwright install chromium` — downloaded Chrome for Testing 151.0.7922.34 + Chrome Headless Shell (~300MB total) into /home/z/.cache/ms-playwright/.
- Created mini-services/playwright-service/index.ts:
  - HTTP server via Node's `http.createServer()` (Bun natively supports node:http). Port 3004 hard-coded.
  - Socket.IO server with `path: "/"`, CORS `origin: "*"`, pingTimeout 60s, pingInterval 25s, maxHttpBufferSize 5MB (to allow large base64 screenshots in event payloads).
  - **Critical integration workaround**: With Socket.IO `path: "/"`, engine.io's `check(req)` returns true for EVERY URL (since every URL starts with "/"), which means engine.io would intercept /api/health and /api/run and return its own 400 response. Fixed by: after IOServer attaches (which caches + removes existing request listeners and installs its own single listener), we extract that engine.io listener, remove it, and install our own router that tries the REST handler first (for /api/health, /api/run, OPTIONS) and delegates to engine.io's cached listener for everything else. This preserves Socket.IO semantics for path "/" while letting REST routes coexist on the same port. Documented with an inline comment block in index.ts.
  - GET /api/health returns { ok: true, service: "playwright-service", time }.
  - POST /api/run accepts JSON body { portalUrl, claimId, fields[], documents[], sessionId }, validates required fields, launches `runAutomation(payload)` async (non-blocking), returns 202 with { ok: true, message, sessionId, claimId }.
  - Socket.IO events: client emits "join" with sessionId → server joins room + emits "joined" ack. Server emits "automation:step" events to the room.
  - 8-step automation flow (all steps emit running → done, with screenshots at key points):
    1. "Launching browser" — chromium.launch({ headless: true }), context with viewport 1280x900, new page. Documented that production would use headed mode for manual login.
    2. "Navigating to bank claim portal" — page.goto(portalUrl, { waitUntil: "networkidle" }), screenshot.
    3. "Waiting for card member login" — emits waiting_user status first with detail explaining "In production this step waits for the card member to log in manually; no credentials are stored", then simulates login with dummy ephemeral credentials (User ID "cardmember_demo", Password "demo_dummy_<timestamp>") by filling #login-userid + #login-password via getByLabel and clicking the Login button. Waits for #claim-section:not(.hidden). Screenshot. Credentials are NEVER written to disk.
    4. "Selecting claim type" — looks for a field with key === "claim_type" (or any select field whose key matches /type/i), uses selectOption(value) with label fallback. Non-fatal if absent.
    5. "Filling claim form fields" — iterates fields[] (skipping claim_type which was step 4 and file inputs which are step 6). For each: tries page.getByLabel(field.label, { exact: false }).first(); if count === 0, falls back to page.locator(`[name="${field.key}"], #${field.key}`).first(). For select → selectOption(value) with label fallback; for all other types (text/email/tel/date/number/textarea) → fill(value). Sends a halfway screenshot when filled >= ceil(n/2), and a final screenshot at the end. Skipped/failed fields emit running-status detail messages but don't abort.
    6. "Uploading supporting documents" — for each document, resolves absolute path = path.resolve("/home/z/my-project/uploads", doc.dataPath); filters to existing files; calls setInputFiles(existingFiles) on input[type=file]. Reports counts of uploaded + missing files. Non-fatal on failure (continues to submit).
    7. "Reviewing pre-filled claim" — final screenshot of completed form.
    8. "Submitting claim" — clicks the "Submit Claim" button via getByRole, waits for #success-section:not(.hidden), extracts #ref-number text, emits done with the reference. Screenshot.
  - Robust error handling: try/catch around the whole runAutomation function; on any throw, emits a `failed` event for the current step with the error message + best-effort screenshot; browser is closed after a 3-second delay (allows retries); process-level uncaughtException + unhandledRejection handlers log but don't crash.
  - Event payload shape: { step: number, action: string, status: "pending"|"running"|"done"|"failed"|"waiting_user", detail?: string, screenshot?: string (data:image/png;base64,...), timestamp: ISO string }.
  - CORS headers on every HTTP response.
- Verification:
  - Started mock-portal: `cd mini-services/mock-portal && bun run dev` → curl http://localhost:3005/ returns full HTML page (title "HDFC SmartHub — Card Benefit Claims", 18 form fields with correct ids, success banner JS, summary table).
  - curl http://localhost:3005/api/health → {"ok":true,"service":"mock-portal"}
  - curl -X POST http://localhost:3005/api/claim -d '{"test":"hello"}' → {"ok":true,"reference":"HDFC-CLM-…","received":{…}}
  - Started playwright-service: `cd mini-services/playwright-service && bun run dev` → curl http://localhost:3004/api/health → {"ok":true,"service":"playwright-service","time":"…"}
  - End-to-end test (mini-services/playwright-service/tests/test-automation-client.ts): Socket.IO client connects to http://localhost:3004/ with path "/", joins room, POSTs /api/run with 12 pre-filled fields + 3 documents. All 8 steps complete successfully in ~5 seconds. Final event: step 8 done, "Claim submitted successfully. Reference: HDFC-CLM-MS24RMLL-DUCY" with screenshot. 11 of 12 fields filled (claim_type handled in step 4), 3 files uploaded.
  - Failure test (tests/test-automation-failure.ts): POST /api/run with portalUrl=http://localhost:59999 (nothing listening). Step 2 emits `failed` with "goto: net::ERR_CONNECTION_REFUSED" detail + screenshot. Server stays up; subsequent /api/health returns 200 OK.
  - Created test documents in /home/z/my-project/uploads/: invoice.txt, id-proof.txt, statement.txt (so the upload step has files to attach during testing).
- Left both services running in background (nohup + disown, pids preserved) for orchestrator inspection.

Stage Summary:
- Two mini-services built and verified end-to-end.
- mini-services/mock-portal (port 3005):
  - GET / → HTML page (HDFC SmartHub mock, emerald/teal/slate, login + 18-field claim form + success banner)
  - POST /api/claim → { ok, reference, received }
  - GET /api/health → { ok, service }
  - CORS *, OPTIONS preflight
  - Start: `cd mini-services/mock-portal && bun run dev`
- mini-services/playwright-service (port 3004):
  - GET /api/health → { ok, service, time }
  - POST /api/run → 202 { ok, message, sessionId, claimId } (launches automation async)
  - Socket.IO at path "/", CORS "*", client emits "join" with sessionId, server emits "automation:step" events to the room
  - 8-step automation: launch → navigate → login (waiting_user) → select claim type → fill fields → upload docs → review → submit
  - Event payload: { step, action, status, detail?, screenshot? (data:image/png;base64,...), timestamp }
  - status ∈ pending|running|done|failed|waiting_user
  - Start: `cd mini-services/playwright-service && bun run dev`
- /api/run body shape:
  ```json
  {
    "portalUrl": "http://localhost:3005",
    "claimId": "string",
    "fields": [{ "key": "cardholder_name", "label": "Cardholder Name", "type": "text", "value": "Arjun Mehta", "options?": [] }],
    "documents": [{ "dataPath": "claim-123/invoice.jpg", "fileType": "image", "filename": "invoice.jpg" }],
    "sessionId": "string"
  }
  ```
  - `fields` shape mirrors ClaimFormField from src/lib/types.ts (key, label, type, value, options?, required?, placeholder?).
  - `documents.dataPath` is relative to /home/z/my-project/uploads (e.g. "<claimId>/<filename>" — orchestrator's saveUpload stores under uploads/<claimId>/<filename>).
- Frontend integration:
  - REST: `fetch("/api/run?XTransformPort=3004", { method: "POST", body: ... })`
  - Socket.IO client: `io("/?XTransformPort=3004", { path: "/" })`, then `socket.emit("join", sessionId)`, listen for `"automation:step"` events.
  - Screenshot field is a data URL — directly usable as `<img src={ev.screenshot} />`.
- Caveats:
  - **Headless mode**: Playwright runs headless=true (sandbox). In production this should be headed so the user can log in manually; step 3 simulates the login with dummy ephemeral credentials and documents this in the event detail. No real credentials are ever stored.
  - **Path "/" + REST coexistence**: required a post-attach listener swap (documented inline in index.ts) because engine.io with path "/" intercepts every URL by default.
  - **Field locator strategy**: tries `page.getByLabel(label, { exact: false })` first, falls back to `[name="key"], #key`. If neither matches, the field is skipped with a running-status detail message (does not fail the run).
  - **Document upload**: silently skips files that don't exist on disk under /home/z/my-project/uploads (reported in the detail string). This lets the orchestrator call /api/run before all uploads have finished writing, if needed.
  - **Browser binary**: Chromium downloaded to /home/z/.cache/ms-playwright/chromium-1234 (~300MB). If this is wiped, `bunx playwright install chromium` must be re-run.
  - **socket.io-client** is in dependencies (only used by the test scripts in tests/); orchestrator can remove it if desired.
  - Test files left in mini-services/playwright-service/tests/ for orchestrator verification — not required for production.

---
Task ID: 3-6
Agent: orchestrator
Task: Frontend, backend API routes, Playwright integration, end-to-end verification

Work Log:
- Built full design system: emerald/teal palette (no blue/indigo), dark mode support, custom scrollbar
- Login screen: email-only auth, no passwords, privacy-first messaging
- Dashboard: header, 4 stat cards, tabbed Benefits/Transactions/Claims views
- Parser panel: SMS/email ingestion with sample loader
- Benefit list: 16 detected benefits with confidence bars, coverage amounts, filing windows
- Transaction list: sortable table with category badges, benefit links
- Claim detail sheet: pre-filled 11-field form, document upload (image/pdf/text), automation panel
- Automation panel: live socket.io streaming of 8 Playwright steps with screenshots
- Claim history: filed claims with status badges
- Backend API: auth (login/logout/me), cards, transactions, transactions/parse, benefits, claims (CRUD), claims/[id]/submit, claims/[id]/documents, stats, seed
- Fixed Next.js 16 cookie pattern: set cookies on NextResponse (not via next/headers cookies().set())
- Fixed socket.io gateway routing: use query option instead of URL query string
- Fixed seed dates: generate relative to current date so all benefits fall within filing windows
- Fixed SMS merchant parser: strip trailing bank-script fragments
- All services verified through Caddy gateway (port 81)

Stage Summary:
- Full golden path verified via Agent Browser through gateway (port 81):
  1. Login with email -> session cookie set
  2. Auto-seed: 5 cards, 9 transactions, 16 benefits detected
  3. Click benefit -> pre-filled 11-field claim form in sheet
  4. Upload document (txt) -> attached to claim
  5. Click "Auto-submit claim" -> Playwright launches, navigates to mock HDFC portal,
     logs in (simulated), fills 11 fields, uploads docs, submits -> reference HDFC-CLM-MS264CGB-HSI0
  6. 6 screenshots captured, 8 steps streamed live via socket.io
  7. Claims tab shows filed claims with status
- Lint: clean (0 errors)
- Footer: sticky on short pages, pushed naturally on long pages
- Mobile responsive: tested at 390x844
- No bank credentials stored: user logs in to bank portal inside Playwright browser session
- Services: Next.js (3000), Playwright (3004), Mock portal (3005), Gateway (81)
