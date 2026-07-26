// mock-portal/index.ts
// Standalone Bun HTTP server that serves a mock "Indian bank claim portal".
// Port is hard-coded to 3005 (per task spec — do NOT use PORT env).
// CORS is wide open because the page is loaded inside Playwright, not the user's browser.

const PORT = 3005;
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

const HTML_PAGE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>HDFC SmartHub — Card Benefit Claims</title>
  <style>
    :root {
      --emerald-50: #ecfdf5;
      --emerald-100: #d1fae5;
      --emerald-500: #10b981;
      --emerald-600: #059669;
      --emerald-700: #047857;
      --teal-500: #14b8a6;
      --teal-600: #0d9488;
      --slate-50: #f8fafc;
      --slate-100: #f1f5f9;
      --slate-200: #e2e8f0;
      --slate-300: #cbd5e1;
      --slate-500: #64748b;
      --slate-600: #475569;
      --slate-700: #334155;
      --slate-800: #1e293b;
      --slate-900: #0f172a;
      --amber-400: #fbbf24;
      --rose-500: #f43f5e;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(180deg, var(--slate-50) 0%, var(--emerald-50) 100%);
      color: var(--slate-800);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }
    .hidden { display: none !important; }

    /* Sticky header */
    header.site-header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: linear-gradient(120deg, var(--emerald-700) 0%, var(--teal-600) 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(15, 23, 42, 0.12);
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo-tile {
      width: 44px; height: 44px;
      border-radius: 10px;
      background: white;
      color: var(--emerald-700);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 14px;
      letter-spacing: -0.5px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .brand-text h1 { font-size: 18px; font-weight: 700; letter-spacing: -0.2px; }
    .brand-text p  { font-size: 12px; opacity: 0.85; }
    .welcome-pill {
      background: rgba(255,255,255,0.18);
      border: 1px solid rgba(255,255,255,0.25);
      color: white;
      padding: 6px 14px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .welcome-pill::before {
      content: ""; width: 8px; height: 8px; border-radius: 50%;
      background: var(--amber-400); box-shadow: 0 0 6px var(--amber-400);
    }

    /* Layout */
    main {
      max-width: 880px;
      margin: 32px auto;
      padding: 0 20px 80px;
    }
    .card {
      background: white;
      border: 1px solid var(--slate-200);
      border-radius: 14px;
      padding: 28px;
      box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
      margin-bottom: 24px;
    }
    .card h2 {
      font-size: 20px; color: var(--slate-900);
      margin-bottom: 4px;
      letter-spacing: -0.3px;
    }
    .card .sub {
      color: var(--slate-500);
      font-size: 13px;
      margin-bottom: 22px;
    }

    /* Forms */
    form { display: grid; grid-template-columns: 1fr; gap: 14px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
    label {
      font-size: 13px;
      font-weight: 600;
      color: var(--slate-700);
      display: block;
      margin-bottom: 4px;
    }
    label .opt {
      font-weight: 400;
      color: var(--slate-500);
      font-size: 11px;
    }
    input[type="text"], input[type="email"], input[type="tel"],
    input[type="date"], input[type="number"], input[type="password"],
    input[type="file"], select, textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--slate-300);
      border-radius: 8px;
      font-size: 14px;
      color: var(--slate-900);
      background: white;
      transition: border-color 0.15s, box-shadow 0.15s;
      font-family: inherit;
    }
    input:focus, select:focus, textarea:focus {
      outline: none;
      border-color: var(--emerald-500);
      box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.15);
    }
    textarea { resize: vertical; min-height: 96px; }
    input[type="file"] { padding: 8px; background: var(--slate-50); }

    /* Buttons */
    .btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px;
      padding: 11px 22px;
      border: none;
      border-radius: 9px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.08s, background 0.15s, box-shadow 0.15s;
      font-family: inherit;
    }
    .btn-primary {
      background: linear-gradient(120deg, var(--emerald-600), var(--teal-600));
      color: white;
      box-shadow: 0 4px 12px rgba(5, 150, 105, 0.25);
    }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 16px rgba(5, 150, 105, 0.35); }
    .btn-primary:active { transform: translateY(0); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
    .btn-block { width: 100%; }

    /* Success banner */
    .success-banner {
      background: linear-gradient(120deg, var(--emerald-50), var(--teal-50, var(--emerald-50)));
      border: 1px solid var(--emerald-100);
      border-left: 5px solid var(--emerald-500);
      border-radius: 10px;
      padding: 18px 20px;
      margin-bottom: 20px;
    }
    .success-banner h3 { color: var(--emerald-700); font-size: 17px; margin-bottom: 4px; }
    .success-banner p { color: var(--slate-600); font-size: 14px; }
    .success-banner .ref {
      font-family: 'SF Mono', Menlo, Monaco, Consolas, monospace;
      background: white;
      padding: 3px 8px;
      border-radius: 5px;
      border: 1px solid var(--emerald-100);
      color: var(--emerald-700);
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* Summary table */
    table.summary {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    table.summary th, table.summary td {
      padding: 9px 12px;
      text-align: left;
      border-bottom: 1px solid var(--slate-200);
      vertical-align: top;
    }
    table.summary th {
      background: var(--slate-50);
      color: var(--slate-600);
      font-weight: 600;
      width: 40%;
    }
    table.summary td { color: var(--slate-800); word-break: break-word; }

    .footer-note {
      text-align: center;
      color: var(--slate-500);
      font-size: 12px;
      margin-top: 32px;
    }
    .footer-note a { color: var(--emerald-700); text-decoration: none; }
  </style>
</head>
<body>
  <header class="site-header">
    <div class="brand">
      <div class="logo-tile">HDFC</div>
      <div class="brand-text">
        <h1>SmartHub &mdash; Card Benefit Claims</h1>
        <p>Purchase Protection &middot; Return Protection &middot; Travel &middot; Warranty</p>
      </div>
    </div>
    <div id="welcome-banner" class="welcome-pill hidden">Welcome, Card Member</div>
  </header>

  <main>
    <!-- LOGIN SECTION -->
    <section id="login-section" class="card">
      <h2>Secure Login</h2>
      <p class="sub">Please log in to your HDFC SmartHub account to file a new protection claim. Any credentials are accepted in this demo portal.</p>
      <form id="login-form" autocomplete="off">
        <div>
          <label for="login-userid">User ID</label>
          <input id="login-userid" name="userid" type="text" placeholder="Your Customer ID" autocomplete="username" />
        </div>
        <div>
          <label for="login-password">Password</label>
          <input id="login-password" name="password" type="password" placeholder="Your NetBanking Password" autocomplete="current-password" />
        </div>
        <div>
          <button type="submit" id="login-btn" class="btn btn-primary">Login</button>
        </div>
      </form>
    </section>

    <!-- CLAIM FORM SECTION -->
    <section id="claim-section" class="card hidden">
      <h2>File a New Protection Claim</h2>
      <p class="sub">All fields marked with an asterisk (*) are mandatory for processing. Benefit-specific fields appear based on the selected claim type.</p>
      <form id="claim-form" autocomplete="off">
        <div class="row">
          <div>
            <label for="cardholder_name">Cardholder Name *</label>
            <input id="cardholder_name" name="cardholder_name" type="text" placeholder="As on card" />
          </div>
          <div>
            <label for="email">Email *</label>
            <input id="email" name="email" type="email" placeholder="you@example.in" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="mobile">Mobile Number *</label>
            <input id="mobile" name="mobile" type="tel" placeholder="10-digit mobile" />
          </div>
          <div>
            <label for="card_last4">Card Last 4 Digits *</label>
            <input id="card_last4" name="card_last4" type="text" maxlength="4" placeholder="e.g. 4321" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="card_name">Card Variant *</label>
            <input id="card_name" name="card_name" type="text" placeholder="e.g. Regalia Gold" />
          </div>
          <div>
            <label for="merchant">Merchant Name *</label>
            <input id="merchant" name="merchant" type="text" placeholder="e.g. Croma" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="txn_date">Transaction Date *</label>
            <input id="txn_date" name="txn_date" type="date" />
          </div>
          <div>
            <label for="txn_amount">Transaction Amount (INR) *</label>
            <input id="txn_amount" name="txn_amount" type="number" placeholder="0" min="0" step="0.01" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="claim_amount">Claim Amount (INR) *</label>
            <input id="claim_amount" name="claim_amount" type="number" placeholder="0" min="0" step="0.01" />
          </div>
          <div>
            <label for="claim_type">Claim Type *</label>
            <select id="claim_type" name="claim_type">
              <option value="">Select claim type</option>
              <option value="purchase_protection">Purchase Protection</option>
              <option value="return_protection">Return Protection</option>
              <option value="travel_delay">Travel Delay</option>
              <option value="lost_baggage">Lost Baggage</option>
              <option value="extended_warranty">Extended Warranty</option>
              <option value="air_accident">Air Accident</option>
            </select>
          </div>
        </div>

        <div class="row">
          <div>
            <label for="incident_date">Incident Date <span class="opt">(purchase_protection / air_accident)</span></label>
            <input id="incident_date" name="incident_date" type="date" />
          </div>
          <div>
            <label for="flight_number">Flight Number <span class="opt">(travel_delay / lost_baggage / air_accident)</span></label>
            <input id="flight_number" name="flight_number" type="text" placeholder="e.g. 6E-123" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="delay_duration">Delay Duration (hours) <span class="opt">(travel_delay)</span></label>
            <input id="delay_duration" name="delay_duration" type="number" placeholder="0" min="0" />
          </div>
          <div>
            <label for="baggage_tag">Baggage Tag Number <span class="opt">(lost_baggage)</span></label>
            <input id="baggage_tag" name="baggage_tag" type="text" placeholder="e.g. AI-123456" />
          </div>
        </div>

        <div class="row">
          <div>
            <label for="product_name">Product Name <span class="opt">(extended_warranty)</span></label>
            <input id="product_name" name="product_name" type="text" placeholder="e.g. Sony Bravia TV" />
          </div>
          <div>
            <label for="warranty_expiry">Warranty Expiry <span class="opt">(extended_warranty)</span></label>
            <input id="warranty_expiry" name="warranty_expiry" type="date" />
          </div>
        </div>

        <div>
          <label for="incident_desc">Incident Description *</label>
          <textarea id="incident_desc" name="incident_desc" rows="4" placeholder="Describe what happened, when, and the loss suffered..."></textarea>
        </div>

        <div>
          <label for="documents">Document Upload</label>
          <input id="documents" name="documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" />
          <p class="opt" style="margin-top:4px;">Attach invoice, ID proof, and any supporting documents (.pdf, .jpg, .png, .txt).</p>
        </div>

        <div>
          <button type="submit" id="submit-btn" class="btn btn-primary btn-block">Submit Claim</button>
        </div>
      </form>
    </section>

    <!-- SUCCESS BANNER SECTION -->
    <section id="success-section" class="card hidden">
      <div class="success-banner">
        <h3>Claim submitted successfully!</h3>
        <p>Reference: <span class="ref" id="ref-number"></span></p>
      </div>
      <h2 style="font-size:16px; margin-bottom:12px;">Submitted Details</h2>
      <table class="summary" id="summary-table">
        <thead>
          <tr><th>Field</th><th>Value</th></tr>
        </thead>
        <tbody></tbody>
      </table>
      <div style="margin-top:20px;">
        <button type="button" id="file-another-btn" class="btn btn-primary">File Another Claim</button>
      </div>
    </section>

    <p class="footer-note">HDFC SmartHub demo portal &middot; No real bank credentials are stored &middot; <a href="/api/claim">POST /api/claim</a> also accepted</p>
  </main>

  <script>
    (function() {
      var loginSection   = document.getElementById('login-section');
      var claimSection   = document.getElementById('claim-section');
      var successSection = document.getElementById('success-section');
      var welcomeBanner  = document.getElementById('welcome-banner');
      var loginForm      = document.getElementById('login-form');
      var claimForm      = document.getElementById('claim-form');
      var summaryTbody   = document.querySelector('#summary-table tbody');
      var refNumberEl    = document.getElementById('ref-number');
      var fileAnotherBtn = document.getElementById('file-another-btn');

      // ---------- LOGIN ----------
      loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        // Any credentials accepted — just reveal the claim form.
        loginSection.classList.add('hidden');
        claimSection.classList.remove('hidden');
        welcomeBanner.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      // ---------- CLAIM SUBMIT ----------
      function genRef() {
        var ts = Date.now().toString(36).toUpperCase();
        var rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
        return 'HDFC-CLM-' + ts + '-' + rnd;
      }

      function labelForField(key) {
        var map = {
          cardholder_name: 'Cardholder Name',
          email: 'Email',
          mobile: 'Mobile Number',
          card_last4: 'Card Last 4 Digits',
          card_name: 'Card Variant',
          merchant: 'Merchant Name',
          txn_date: 'Transaction Date',
          txn_amount: 'Transaction Amount (INR)',
          claim_amount: 'Claim Amount (INR)',
          claim_type: 'Claim Type',
          incident_date: 'Incident Date',
          flight_number: 'Flight Number',
          delay_duration: 'Delay Duration (hours)',
          baggage_tag: 'Baggage Tag Number',
          product_name: 'Product Name',
          warranty_expiry: 'Warranty Expiry',
          incident_desc: 'Incident Description',
          documents: 'Documents'
        };
        return map[key] || key;
      }

      claimForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var fd = new FormData(claimForm);
        var summary = {};
        var displayOrder = [
          'cardholder_name','email','mobile','card_last4','card_name',
          'merchant','txn_date','txn_amount','claim_amount','claim_type',
          'incident_date','flight_number','delay_duration','baggage_tag',
          'product_name','warranty_expiry','incident_desc','documents'
        ];

        displayOrder.forEach(function(key) {
          if (key === 'documents') {
            var files = fd.getAll('documents');
            if (files && files.length > 0) {
              summary[key] = files.map(function(f) { return f.name; }).join(', ');
            } else {
              summary[key] = '(none)';
            }
          } else {
            var v = fd.get(key);
            summary[key] = (v === null || v === undefined || v === '') ? '(blank)' : String(v);
          }
        });

        var ref = genRef();
        refNumberEl.textContent = ref;

        // Render summary table
        summaryTbody.innerHTML = '';
        displayOrder.forEach(function(key) {
          var tr = document.createElement('tr');
          var td1 = document.createElement('th'); td1.textContent = labelForField(key);
          var td2 = document.createElement('td'); td2.textContent = summary[key];
          tr.appendChild(td1); tr.appendChild(td2);
          summaryTbody.appendChild(tr);
        });

        claimSection.classList.add('hidden');
        successSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Also expose a global so Playwright can read it if needed
        window.__lastSubmittedClaim = { reference: ref, summary: summary, submittedAt: new Date().toISOString() };
      });

      fileAnotherBtn.addEventListener('click', function() {
        claimForm.reset();
        successSection.classList.add('hidden');
        claimSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })();
  </script>
</body>
</html>`;

// POST /api/claim handler — accepts JSON or form-encoded body and returns a fake reference.
function buildReference(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `HDFC-CLM-${ts}-${rnd}`;
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return (await req.json()) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (ct.includes("application/x-www-form-urlencoded") || ct.includes("multipart/form-data")) {
    try {
      const fd = await req.formData();
      const out: Record<string, unknown> = {};
      fd.forEach((v, k) => {
        out[k] = typeof v === "string" ? v : (v as File).name;
      });
      return out;
    } catch {
      return {};
    }
  }
  // Fallback: try JSON anyway
  try {
    return (await req.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const server = Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);
    // Attach CORS to every response
    const withCors = (body: BodyInit, init: ResponseInit = {}) => {
      const headers = new Headers(init.headers || {});
      for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
      return new Response(body, { ...init, headers });
    };

    // Preflight
    if (req.method === "OPTIONS") {
      return withCors("", { status: 204 });
    }

    // GET / -> HTML page
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return withCors(HTML_PAGE, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // POST /api/claim
    if (req.method === "POST" && url.pathname === "/api/claim") {
      return (async () => {
        const body = await parseBody(req);
        const reference = buildReference();
        return withCors(
          JSON.stringify({ ok: true, reference, received: body }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      })();
    }

    // GET /api/health
    if (req.method === "GET" && url.pathname === "/api/health") {
      return withCors(JSON.stringify({ ok: true, service: "mock-portal" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return withCors(JSON.stringify({ ok: false, error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
});

console.log(`[mock-portal] serving HDFC SmartHub mock portal on http://localhost:${server.port}`);
