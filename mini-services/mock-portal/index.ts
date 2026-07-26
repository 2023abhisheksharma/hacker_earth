// mock-portal/index.ts
//
// Standalone Bun HTTP server that serves a "Claim Form Demo" — a clean,
// clearly-labeled simulation of an Indian bank's protection claim form.
//
// This is NOT disguised as a real bank. It's an honest demo form with the
// exact same fields a real bank claim form has, so the Playwright engine can
// demonstrate live form-filling. The real bank's actual claim form is behind
// authentication, which the card member completes themselves.
//
// The form personalizes to the selected bank via ?bank=<BankName>.
//
// Port is hard-coded to 3005.

const PORT = 3005;
const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function htmlPage(params: { bank: string; bankUrl?: string }): string {
  const bank = params.bank || "Your Bank";
  const bankSafe = escapeHtml(bank);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Claim Form Demo — ${bankSafe} Protection Claim</title>
  <style>
    :root {
      --emerald-50: #ecfdf5; --emerald-100: #d1fae5; --emerald-500: #10b981;
      --emerald-600: #059669; --emerald-700: #047857;
      --teal-500: #14b8a6; --teal-600: #0d9488;
      --slate-50: #f8fafc; --slate-100: #f1f5f9; --slate-200: #e2e8f0;
      --slate-300: #cbd5e1; --slate-500: #64748b; --slate-600: #475569;
      --slate-700: #334155; --slate-800: #1e293b; --slate-900: #0f172a;
      --amber-400: #fbbf24; --amber-500: #f59e0b; --amber-600: #d97706;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
      background: linear-gradient(180deg, var(--slate-50) 0%, var(--emerald-50) 100%);
      color: var(--slate-800); min-height: 100vh; -webkit-font-smoothing: antialiased;
    }
    .hidden { display: none !important; }

    /* Demo banner */
    .demo-banner {
      background: linear-gradient(90deg, var(--amber-500), var(--amber-600));
      color: white; text-align: center; padding: 8px 16px;
      font-size: 12px; font-weight: 600; letter-spacing: 0.3px;
    }

    header.site-header {
      position: sticky; top: 0; z-index: 50;
      background: linear-gradient(120deg, var(--emerald-700) 0%, var(--teal-600) 100%);
      color: white; box-shadow: 0 2px 8px rgba(15,23,42,0.12);
      padding: 14px 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; }
    .logo-tile {
      width: 44px; height: 44px; border-radius: 10px; background: white;
      color: var(--emerald-700); display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px; box-shadow: 0 2px 6px rgba(0,0,0,0.15);
    }
    .brand-text h1 { font-size: 17px; font-weight: 700; }
    .brand-text p { font-size: 12px; opacity: 0.85; }
    .ready-pill {
      background: rgba(255,255,255,0.18); border: 1px solid rgba(255,255,255,0.25);
      color: white; padding: 6px 14px; border-radius: 999px; font-size: 12px; font-weight: 600;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .ready-pill::before {
      content: ""; width: 8px; height: 8px; border-radius: 50%;
      background: var(--amber-400); box-shadow: 0 0 6px var(--amber-400);
    }
    .ready-pill.live { background: rgba(16, 185, 129, 0.25); }
    .ready-pill.live::before { background: var(--emerald-500); animation: pulse 1s infinite; }
    @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }

    /* Field fill animation */
    input.filling, select.filling, textarea.filling {
      border-color: var(--emerald-500) !important;
      box-shadow: 0 0 0 4px rgba(16,185,129,0.2) !important;
      background: var(--emerald-50) !important;
      transition: all 0.2s;
    }
    input.filled, select.filled, textarea.filled {
      border-color: var(--emerald-500) !important;
      background: var(--emerald-50) !important;
    }
    .field-flash { animation: flash 0.6s; }
    @keyframes flash { 0% { background: rgba(16,185,129,0.3); } 100% { background: var(--emerald-50); } }

    main { max-width: 880px; margin: 24px auto; padding: 0 20px 80px; }
    .info-card {
      background: var(--amber-500)-transparent; background: rgba(245, 158, 11, 0.08);
      border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 14px 18px; margin-bottom: 20px;
      font-size: 13px; color: var(--slate-700); line-height: 1.5;
    }
    .info-card strong { color: var(--amber-600); }
    .card {
      background: white; border: 1px solid var(--slate-200); border-radius: 14px;
      padding: 28px; box-shadow: 0 4px 20px rgba(15,23,42,0.04); margin-bottom: 24px;
    }
    .card h2 { font-size: 19px; color: var(--slate-900); margin-bottom: 4px; }
    .card .sub { color: var(--slate-500); font-size: 13px; margin-bottom: 22px; }

    form { display: grid; grid-template-columns: 1fr; gap: 14px; }
    .row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
    @media (max-width: 640px) { .row { grid-template-columns: 1fr; } }
    label { font-size: 13px; font-weight: 600; color: var(--slate-700); display: block; margin-bottom: 4px; }
    label .opt { font-weight: 400; color: var(--slate-500); font-size: 11px; }
    input[type="text"], input[type="email"], input[type="tel"],
    input[type="date"], input[type="number"], input[type="file"], select, textarea {
      width: 100%; padding: 10px 12px; border: 1px solid var(--slate-300); border-radius: 8px;
      font-size: 14px; color: var(--slate-900); background: white; font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    input:focus, select:focus, textarea:focus {
      outline: none; border-color: var(--emerald-500);
      box-shadow: 0 0 0 3px rgba(16,185,129,0.15);
    }
    input.filled { border-color: var(--emerald-500); background: var(--emerald-50); }
    textarea { resize: vertical; min-height: 80px; }
    input[type="file"] { padding: 8px; background: var(--slate-50); }

    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 11px 22px; border: none; border-radius: 9px; font-size: 14px; font-weight: 600;
      cursor: pointer; font-family: inherit; transition: transform 0.08s, box-shadow 0.15s;
    }
    .btn-primary {
      background: linear-gradient(120deg, var(--emerald-600), var(--teal-600)); color: white;
      box-shadow: 0 4px 12px rgba(5,150,105,0.25);
    }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-block { width: 100%; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }

    .success-banner {
      background: linear-gradient(120deg, var(--emerald-50), #fff);
      border: 1px solid var(--emerald-100); border-left: 5px solid var(--emerald-500);
      border-radius: 10px; padding: 18px 20px; margin-bottom: 20px;
    }
    .success-banner h3 { color: var(--emerald-700); font-size: 17px; margin-bottom: 4px; }
    .success-banner p { color: var(--slate-600); font-size: 14px; }
    .success-banner .ref {
      font-family: 'SF Mono', Menlo, Consolas, monospace; background: white; padding: 3px 8px;
      border-radius: 5px; border: 1px solid var(--emerald-100); color: var(--emerald-700); font-weight: 700;
    }
    table.summary { width: 100%; border-collapse: collapse; font-size: 13px; }
    table.summary th, table.summary td { padding: 9px 12px; text-align: left; border-bottom: 1px solid var(--slate-200); vertical-align: top; }
    table.summary th { background: var(--slate-50); color: var(--slate-600); font-weight: 600; width: 40%; }
    table.summary td { color: var(--slate-800); word-break: break-word; }
    .footer-note { text-align: center; color: var(--slate-500); font-size: 12px; margin-top: 32px; }
  </style>
</head>
<body>
  <div class="demo-banner">DEMO FORM &middot; Simulates ${bankSafe}&rsquo;s protection claim form &middot; No real claim is filed</div>

  <header class="site-header">
    <div class="brand">
      <div class="logo-tile">${escapeHtml((bank || "BANK").slice(0, 4).toUpperCase())}</div>
      <div class="brand-text">
        <h1>${bankSafe} &mdash; Protection Claim</h1>
        <p>Purchase &middot; Return &middot; Travel Delay &middot; Lost Baggage &middot; Warranty</p>
      </div>
    </div>
    <div class="ready-pill" id="status-pill">Form ready</div>
  </header>

  <main>
    <div class="info-card">
      <strong>About this demo:</strong> This form has the same fields as ${bankSafe}&rsquo;s real claim form.
      The Playwright engine fills it live to demonstrate the form-filling capability. In production, the engine
      fills the bank&rsquo;s actual authenticated claim form after the card member logs in. <strong>Submission is disabled</strong> — no claim is filed.
      <br/><br/>
      <a href="${escapeHtml(params.bankUrl || "#")}" target="_blank" rel="noopener" style="color: var(--emerald-700); font-weight: 600; text-decoration: none;">↗ Open the real ${bankSafe} website</a>
    </div>

    <section id="claim-section" class="card">
      <h2>File a New Protection Claim</h2>
      <p class="sub">All fields marked with * are mandatory. Benefit-specific fields appear based on the selected claim type.</p>
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
            <input id="card_name" name="card_name" type="text" placeholder="e.g. Infinia" />
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
            <label for="incident_date">Incident Date <span class="opt">(purchase / air_accident)</span></label>
            <input id="incident_date" name="incident_date" type="date" />
          </div>
          <div>
            <label for="flight_number">Flight Number <span class="opt">(travel / baggage / accident)</span></label>
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
          <textarea id="incident_desc" name="incident_desc" rows="4" placeholder="Describe what happened..."></textarea>
        </div>
        <div>
          <label for="documents">Document Upload</label>
          <input id="documents" name="documents" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.txt" />
          <p class="opt" style="margin-top:4px;">Attach invoice, ID proof, supporting docs (.pdf, .jpg, .png, .txt).</p>
        </div>
        <div>
          <button type="submit" id="submit-btn" class="btn btn-primary btn-block">Submit Claim</button>
        </div>
      </form>
    </section>

    <section id="success-section" class="card hidden">
      <div class="success-banner">
        <h3>Claim form completed (demo)</h3>
        <p>Reference: <span class="ref" id="ref-number"></span></p>
      </div>
      <h2 style="font-size:16px; margin-bottom:12px;">Submitted Details</h2>
      <table class="summary" id="summary-table"><thead><tr><th>Field</th><th>Value</th></tr></thead><tbody></tbody></table>
      <div style="margin-top:20px;">
        <button type="button" id="file-another-btn" class="btn btn-primary">File Another Claim</button>
      </div>
    </section>

    <p class="footer-note">ClaimGuard Claim Form Demo &middot; Simulates ${bankSafe}&rsquo;s claim form &middot; No real claim is filed</p>
  </main>

  <script>
    (function() {
      var claimForm = document.getElementById('claim-form');
      var claimSection = document.getElementById('claim-section');
      var successSection = document.getElementById('success-section');
      var summaryTbody = document.querySelector('#summary-table tbody');
      var refNumberEl = document.getElementById('ref-number');
      var fileAnotherBtn = document.getElementById('file-another-btn');

      // Highlight a field when it gets filled (visual feedback for the demo)
      claimForm.addEventListener('input', function(e) {
        if (e.target.matches('input, textarea, select') && e.target.value) {
          e.target.classList.add('filled');
        } else if (e.target.matches('input, textarea, select')) {
          e.target.classList.remove('filled');
        }
      });

      claimForm.addEventListener('submit', function(e) {
        e.preventDefault();
        var fd = new FormData(claimForm);
        var summary = {};
        var order = ['cardholder_name','email','mobile','card_last4','card_name','merchant','txn_date','txn_amount','claim_amount','claim_type','incident_date','flight_number','delay_duration','baggage_tag','product_name','warranty_expiry','incident_desc','documents'];
        var labels = {cardholder_name:'Cardholder Name',email:'Email',mobile:'Mobile Number',card_last4:'Card Last 4',card_name:'Card Variant',merchant:'Merchant',txn_date:'Txn Date',txn_amount:'Txn Amount',claim_amount:'Claim Amount',claim_type:'Claim Type',incident_date:'Incident Date',flight_number:'Flight Number',delay_duration:'Delay (hrs)',baggage_tag:'Baggage Tag',product_name:'Product Name',warranty_expiry:'Warranty Expiry',incident_desc:'Description',documents:'Documents'};
        order.forEach(function(key) {
          if (key === 'documents') {
            var files = fd.getAll('documents');
            summary[key] = files.length ? files.map(function(f){return f.name;}).join(', ') : '(none)';
          } else {
            var v = fd.get(key);
            summary[key] = (v === null || v === '') ? '(blank)' : String(v);
          }
        });
        var ref = 'DEMO-' + Date.now().toString(36).toUpperCase();
        refNumberEl.textContent = ref;
        summaryTbody.innerHTML = '';
        order.forEach(function(key) {
          var tr = document.createElement('tr');
          var th = document.createElement('th'); th.textContent = labels[key] || key;
          var td = document.createElement('td'); td.textContent = summary[key];
          tr.appendChild(th); tr.appendChild(td);
          summaryTbody.appendChild(tr);
        });
        claimSection.classList.add('hidden');
        successSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.__lastSubmittedClaim = { reference: ref, summary: summary };
      });

      fileAnotherBtn.addEventListener('click', function() {
        claimForm.reset();
        successSection.classList.add('hidden');
        claimSection.classList.remove('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    })();
  </script>

  <!-- Live form-filling: connects to the Playwright service socket.io and
       mirrors the field-filling in real time so the user can watch. -->
  <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
  <script>
    (function() {
      var params = new URLSearchParams(window.location.search);
      var sessionId = params.get('session');
      var statusPill = document.getElementById('status-pill');
      if (!sessionId || typeof io === 'undefined') {
        if (statusPill) statusPill.textContent = 'Form ready';
        return;
      }
      if (statusPill) {
        statusPill.textContent = 'Connecting…';
        statusPill.classList.add('live');
      }
      var socket = io({ path: '/socket.io', transports: ['polling', 'websocket'] });
      socket.on('connect', function() {
        socket.emit('join', sessionId);
        if (statusPill) statusPill.textContent = 'Waiting for engine…';
      });
      socket.on('automation:step', function(ev) {
        // Update status pill based on step
        if (statusPill && ev.action) {
          if (ev.status === 'running') statusPill.textContent = ev.action + '…';
          else if (ev.status === 'done') statusPill.textContent = ev.action + ' ✓';
          else if (ev.status === 'failed') { statusPill.textContent = ev.action + ' ✗'; statusPill.classList.remove('live'); }
        }
      });
      socket.on('fill:field', function(data) {
        // data: { key, label, value, type }
        try {
          var el = document.querySelector('#' + data.key + ', [name="' + data.key + '"]');
          if (!el && data.label) {
            // Fallback: find label with matching text, then its associated input
            var labels = Array.from(document.querySelectorAll('label'));
            var lbl = labels.find(function(l){ return l.textContent.indexOf(data.label) === 0; });
            if (lbl) {
              var forId = lbl.getAttribute('for');
              if (forId) el = document.getElementById(forId);
            }
          }
          if (!el) return;
          el.classList.add('filling');
          // Animate the value being typed in
          if (el.tagName === 'SELECT') {
            el.value = data.value;
            el.classList.add('filled');
          } else {
            // Type character by character for a visible effect
            var val = data.value || '';
            var i = 0;
            el.value = '';
            el.focus();
            var iv = setInterval(function() {
              el.value = val.slice(0, i);
              i++;
              if (i > val.length) {
                clearInterval(iv);
                el.classList.remove('filling');
                el.classList.add('filled');
              }
            }, 25);
          }
          // Scroll the field into view
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch(e) { /* ignore */ }
      });
      socket.on('disconnect', function() {
        if (statusPill) statusPill.textContent = 'Disconnected';
      });
    })();
  </script>
</body>
</html>`;
}

import { createServer, IncomingMessage, ServerResponse } from "http";

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
    const bank = url.searchParams.get("bank") || "Your Bank";
    const bankUrl = url.searchParams.get("bankUrl") || undefined;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(htmlPage({ bank, bankUrl }));
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "claim-form-demo" }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ ok: false, error: "Not found" }));
});

server.listen(PORT, () => {
  console.log(`[claim-form-demo] serving on http://localhost:${PORT} (accepts ?bank=<name>)`);
});

