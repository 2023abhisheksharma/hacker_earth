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

---
Task ID: 7
Agent: orchestrator
Task: Fix user-reported issues: TypeError, preview auth, card onboarding flow, sheet scrolling, document upload

Work Log:
- Fixed TypeError in transaction-list.tsx: added benefits include to /api/transactions + defensive (t.benefits?.length ?? 0)
- Fixed iframe/preview auth: added Bearer token header fallback to getCurrentUser (reads Authorization header via next/headers, then cookie). Login returns token in body. Frontend stores token in localStorage and sends as Authorization header on every request. This fixes the "refresh doesn't show data in preview but works in new tab" issue (sameSite=lax cookies aren't sent in cross-site iframes).
- Split seed.ts into seedDemoCards() + seedDemoTransactions() + addCard()
- Added API routes: POST /api/cards/add (manual card add), POST /api/cards/demo (load 5 preset cards), POST /api/seed/transactions (load sample SMS)
- Built OnboardingScreen component: 3-step stepper, manual card-add form (bank/cardName/last4/network), "Load demo cards" button, card list with benefit dots, "Continue to dashboard" button
- Updated page.tsx: shows OnboardingScreen when user has no cards, dashboard when cards exist. Removed auto-seed on login.
- Updated header "Load demo data" to call /api/seed/transactions (cards come from onboarding)
- Fixed claim detail sheet: replaced Radix ScrollArea with plain overflow-y-auto div (ScrollArea didn't compute height correctly in flex layout). min-h-0 ensures proper flex scrolling.
- Made document upload prominent: large upload area with icon, "Click to upload or drag & drop" CTA, supported file types listed (JPG, PNG, PDF, TXT), section heading with icon
- Updated login screen to store token via setToken(), logout to clearToken()
- Updated client.ts: api() and apiUpload() now send Authorization: Bearer header from localStorage

Stage Summary:
- All user-reported issues fixed and verified via Agent Browser through gateway (port 81):
  1. TypeError: FIXED — transactions tab shows full table with benefit counts
  2. Preview refresh: FIXED — Bearer token in localStorage persists across refreshes in iframe
  3. Card onboarding flow: ADDED — login → onboarding (add cards manually or load demo) → dashboard
  4. Auto-seed removed: user controls the flow
  5. Sheet scrolling: FIXED — plain overflow-y-auto div, form + upload + automation all scrollable
  6. Document upload: PROMINENT — large drag-drop area, supports image/PDF/text
- Verified golden path: login → onboarding → load demo cards → continue → load demo data → 16 benefits → open benefit → pre-filled form scrolls → upload PDF → auto-submit → 6 screenshots + 8 steps → claim submitted
- Lint: clean (0 errors)
- No console/runtime errors

---
Task ID: 8
Agent: orchestrator
Task: Switch from mock portal to real Indian bank websites; open real bank in new tab; stop before submission

Work Log:
- Updated BANK_PORTALS in constants.ts to use real Indian bank website URLs (HDFC, ICICI, Axis, SBI Card, Kotak, Yes Bank, IDFC First, Amex)
- Rewrote Playwright service automation flow (mini-services/playwright-service/index.ts):
  - Step 2: Navigate to REAL bank URL with domcontentloaded (not networkidle — real sites have many third-party scripts)
  - Step 3: "Card member login" — emits waiting_user, explains login is manual and skipped for demo (no dummy credentials)
  - Step 4: "Preparing claim data" — confirms payload mapped
  - Step 5: "Claim form fields ready" — confirms fields ready (doesn't scan real bank homepage — no claim form exists without login)
  - Step 6: "Documents ready for upload"
  - Step 7: "Reviewing pre-filled claim"
  - Step 8: "Stopped before submission" — does NOT click submit, emits "Submission intentionally skipped — no claim was filed"
- Updated claim-detail.tsx: submitClaim() now calls window.open(realBankUrl) to open the real bank in a new tab; button text changed to "Open bank & prepare claim"; privacy note updated to "You log in. We prepare. You submit."
- Updated automation-panel.tsx: header shows "Claim prepared — stopped before submission" with amber icon when stopped
- Updated use-automation-socket.ts: marks claim as "under_review" (not "submitted") when step 8 action contains "stopped"
- Updated claim-history.tsx: "under_review" shows as "Prepared — review & submit" badge
- Properly restarted Playwright service (killed old PID, started fresh)

Stage Summary:
- Verified via Agent Browser through gateway (port 81):
  1. Click "Open bank & prepare claim" → real bank website opens in new browser tab (verified: Kotak https://www.kotak.bank.in/en/home.html loads)
  2. Playwright navigates to the real bank URL headless, streams 6 screenshots
  3. All 8 steps complete: launch → open real bank → login (skipped) → prepare data → fields ready → documents ready → review → STOPPED before submission
  4. Automation panel shows "Claim prepared — stopped before submission"
  5. Claims tab shows status "Prepared — review & submit"
  6. No claim was filed — submission deliberately skipped
- Real bank sites tested: ICICI (loads), Axis (loads), Kotak (loads). HDFC blocks sandbox IP (CloudFront) — handled gracefully with error screenshot.
- Mock portal (port 3005) no longer used; can be left dormant.
- Lint: clean

---
Task ID: 9
Agent: orchestrator
Task: Open bank's credit card claim page (not homepage) in new tab

Work Log:
- Updated BANK_PORTALS to point to each bank's credit card / customer-care section (the closest public page to where claims are filed), instead of the bank homepage:
  - HDFC: https://www.hdfcbank.com/personal/pay/cards/credit-cards
  - ICICI: https://www.icicibank.com/customer-care
  - Axis: https://www.axisbank.com/credit-cards
  - SBI Card: https://www.sbicard.com/
  - Kotak: https://www.kotak.com/en/personal-banking/cards/credit-cards.html
  - IDFC First: https://www.idfcfirstbank.com/credit-card
  - Amex: https://www.americanexpress.com/in/credit-cards/
- Verified each URL returns 200 via curl and loads in the browser (tested Kotak + Axis deep links render correctly)
- The real claim form is behind authentication, which the card member completes themselves

Stage Summary:
- Verified via Agent Browser:
  - Kotak benefit → new tab opens https://www.kotak.bank.in/en/personal-banking/cards/credit-cards.html (credit cards page, not homepage)
  - Axis benefit → new tab opens https://www.axis.bank.in/cards/credit-card (credit cards page, not homepage)
  - Automation completes all 8 steps, 6 screenshots, "Claim prepared — stopped before submission"
  - Claims tab shows "Prepared — review & submit" status
- Lint: clean
