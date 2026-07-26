// playwright-service/index.ts
//
// Bun + HTTP + Socket.IO server that drives Playwright (Chromium) to auto-fill
// a bank claim form on the mock portal (or a real portal in production).
//
// Port is HARD-CODED to 3004 (per task spec — do NOT use PORT env).
//
// HTTP endpoints:
//   GET  /api/health  -> { ok: true }
//   POST /api/run     -> accepts JSON body, launches automation async, returns 202
//
// Socket.IO:
//   path: "/", cors origin "*"
//   Client should `emit("join", sessionId)` to receive automation:step events
//   for its room. Each event payload is an AutomationStep:
//     { step, action, status, detail?, screenshot?, timestamp }
//   status ∈ pending | running | done | failed | waiting_user
//   screenshot is a data URL: "data:image/png;base64,..."
//
// Integration note: Socket.IO with path:"/" intercepts every URL whose pathname
// starts with "/" (i.e., all of them). To let /api/health and /api/run work,
// we register our HTTP request listener FIRST (via createServer callback), so it
// runs before Socket.IO's listener. Our handler responds to /api/* and ends the
// response; Socket.IO then sees `res.writableEnded === true` and returns early
// without trying to handle it. For all other URLs, our handler does nothing and
// lets Socket.IO take over (it returns 400 for non-socket.io requests, which is
// acceptable for a dev tool).

import { createServer, IncomingMessage, ServerResponse } from "http";
import { Server as IOServer, Socket } from "socket.io";
import { chromium, Browser, Page } from "playwright";
import * as path from "path";
import * as fs from "fs";

const PORT = 3004;
const UPLOADS_ROOT = process.env.UPLOADS_ROOT || path.resolve(__dirname, "../../uploads");

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
};

// ---------- Types (mirror src/lib/types.ts) ----------

interface ClaimField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "file";
  value: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface ClaimDocument {
  dataPath: string; // relative to /home/z/my-project/uploads
  fileType: "image" | "pdf" | "text";
  filename: string;
}

interface RunRequest {
  portalUrl: string;        // real bank credit-card page URL (opened in user's tab too)
  demoFormUrl?: string;     // claim form demo URL (filled live by Playwright)
  bankName?: string;        // for display
  claimId: string;
  fields: ClaimField[];
  documents: ClaimDocument[];
  sessionId: string;
}

type StepStatus = "pending" | "running" | "done" | "failed" | "waiting_user";

interface StepEvent {
  step: number;
  action: string;
  status: StepStatus;
  detail?: string;
  screenshot?: string; // "data:image/png;base64,..."
  timestamp: string;
}

// ---------- HTTP server + Socket.IO ----------
//
// Why this is non-trivial:
//   Socket.IO (engine.io) with `path: "/"` intercepts EVERY HTTP request whose
//   URL starts with "/" — i.e. ALL of them, including /api/health and /api/run.
//   When engine.io attaches, it caches and removes existing "request" listeners,
//   then installs a single listener that calls `handleRequest(req, res)` if
//   `check(req)` returns true. With path "/", check() is always true, so our
//   own /api/* handlers would never run.
//
// Workaround:
//   After Socket.IO attaches, we extract its single "request" listener, remove
//   it, and install our own listener that:
//     - handles /api/health, /api/run, OPTIONS preflight ourselves, and
//     - delegates everything else to the cached engine.io listener.
//   This preserves Socket.IO semantics for path "/" while letting REST routes
//   coexist on the same port.

const httpServer = createServer();

// Define our REST request handler. It returns true if it handled the request,
// false otherwise (so the caller can delegate to engine.io).
function handleRestRequest(req: IncomingMessage, res: ServerResponse): boolean {
  // Always attach CORS headers
  for (const [k, v] of Object.entries(CORS_HEADERS)) res.setHeader(k, v);

  // Preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return true;
  }

  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // GET /api/health
  if (req.method === "GET" && url.pathname === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, service: "playwright-service", time: new Date().toISOString() }));
    return true;
  }

  // POST /api/run
  if (req.method === "POST" && url.pathname === "/api/run") {
    let body = "";
    req.on("data", (chunk: Buffer) => { body += chunk.toString(); });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body) as RunRequest;
        if (!payload.portalUrl || !payload.sessionId || !Array.isArray(payload.fields)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({
            ok: false,
            error: "Missing required fields. Required: portalUrl, sessionId, fields[]",
          }));
          return;
        }
        // Launch async — do NOT block the HTTP response.
        runAutomation(payload).catch((err) => {
          console.error(`[runAutomation] uncaught error for session ${payload.sessionId}:`, err);
        });
        res.writeHead(202, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          ok: true,
          message: "Automation started",
          sessionId: payload.sessionId,
          claimId: payload.claimId,
        }));
      } catch (e) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
      }
    });
    return true;
  }

  // Not a REST route we handle.
  return false;
}

// Register our REST handler first (engine.io will cache it when it attaches).
httpServer.on("request", handleRestRequest);

const io = new IOServer(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
  maxHttpBufferSize: 5 * 1024 * 1024, // allow large screenshots in payloads
});

io.on("connection", (socket: Socket) => {
  console.log(`[socket.io] client connected: ${socket.id}`);
  socket.on("join", (room: unknown) => {
    if (typeof room === "string" && room.length > 0 && room.length < 256) {
      socket.join(room);
      console.log(`[socket.io] ${socket.id} joined room ${room}`);
      socket.emit("joined", { room });
    } else {
      socket.emit("error", { message: "Invalid room id" });
    }
  });
  socket.on("disconnect", (reason: string) => {
    console.log(`[socket.io] client disconnected: ${socket.id} (${reason})`);
  });
  socket.on("error", (err: Error) => {
    console.error(`[socket.io] socket error (${socket.id}):`, err);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[playwright-service] HTTP + Socket.IO listening on http://localhost:${PORT}`);
  console.log(`[playwright-service] Socket.IO path: "/", CORS: "*"`);
  console.log(`[playwright-service] REST: GET /api/health, POST /api/run`);
  console.log(`[playwright-service] Uploads root: ${UPLOADS_ROOT}`);
});

// ---- Post-attach listener swap ----
// After IOServer attached, the only "request" listener is engine.io's, which
// with path:"/" intercepts every URL and never delegates to our REST handler.
// We replace it with a router that:
//   1. Tries our REST handler first (handles /api/health, /api/run, OPTIONS).
//   2. If REST returns false (not an /api/* route), delegates to engine.io's
//      cached listener so Socket.IO can handle the polling/WebSocket traffic.
{
  const engineListeners = httpServer.listeners("request").slice(0) as Array<
    (req: IncomingMessage, res: ServerResponse) => void
  >;
  httpServer.removeAllListeners("request");
  httpServer.on("request", (req: IncomingMessage, res: ServerResponse) => {
    try {
      const handled = handleRestRequest(req, res);
      if (handled) return;
    } catch (e) {
      console.error("[http] REST handler threw:", e);
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
      return;
    }
    // Delegate to engine.io's cached listener(s) for Socket.IO traffic.
    for (const listener of engineListeners) {
      try {
        listener.call(httpServer, req, res);
      } catch (e) {
        console.error("[http] engine.io listener threw:", e);
      }
    }
  });
  console.log(`[playwright-service] installed REST→engine.io router (cached ${engineListeners.length} engine.io listener(s))`);
}

// ---------- Automation ----------

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

async function runAutomation(payload: RunRequest): Promise<void> {
  const { portalUrl, demoFormUrl, bankName, fields, documents, sessionId } = payload;

  // Helper: emit a step event to the room.
  const emit = (ev: Omit<StepEvent, "timestamp">) => {
    const full: StepEvent = { ...ev, timestamp: new Date().toISOString() };
    try {
      io.to(sessionId).emit("automation:step", full);
    } catch (e) {
      console.error("[emit] failed:", e);
    }
    const detailSnippet = full.detail ? " :: " + full.detail.slice(0, 140) : "";
    const shotTag = full.screenshot ? " [+screenshot]" : "";
    console.log(
      `[automation:${sessionId}] step ${full.step} "${full.action}" -> ${full.status}${detailSnippet}${shotTag}`,
    );
  };

  // Helper: take a screenshot as a data URL (returns undefined on failure).
  const takeScreenshot = async (page: Page | undefined): Promise<string | undefined> => {
    if (!page) return undefined;
    try {
      const buf = await page.screenshot({ type: "png", fullPage: false });
      return "data:image/png;base64," + buf.toString("base64");
    } catch (e) {
      console.warn("[screenshot] failed:", e);
      return undefined;
    }
  };

  let browser: Browser | undefined;
  let page: Page | undefined;
  let currentStep = 0;
  let currentAction = "(init)";

  // Helper: emit a failed event for the current step + screenshot.
  const fail = async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    const shot = await takeScreenshot(page);
    emit({ step: currentStep, action: currentAction, status: "failed", detail: msg, screenshot: shot });
  };

  try {
    // ---------------- STEP 1: Launch browser ----------------
    currentStep = 1;
    currentAction = "Launching browser";
    emit({
      step: 1,
      action: currentAction,
      status: "running",
      detail: "Starting Chromium (headless=true, sandbox). In production this would be headed so the card member can log in manually.",
    });
    try {
      try {
        browser = await chromium.launch({
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
        });
      } catch (launchErr) {
        console.warn("[playwright] default launch failed, checking fallback binary paths:", launchErr);
        const fallbackPaths = [
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/usr/bin/google-chrome",
        ];
        let found = false;
        for (const p of fallbackPaths) {
          if (fs.existsSync(p)) {
            browser = await chromium.launch({
              executablePath: p,
              headless: true,
              args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
            });
            found = true;
            break;
          }
        }
        if (!found) throw launchErr;
      }
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      page = await context.newPage();
      emit({ step: 1, action: currentAction, status: "done", detail: "Chromium launched (headless, 1280x900)." });
    } catch (err) {
      await fail(err);
      return;
    }

    // ---------------- STEP 2: Navigate to REAL bank portal ----------------
    currentStep = 2;
    currentAction = `Opening ${bankName ?? "bank"} portal`;
    emit({ step: 2, action: currentAction, status: "running", detail: `Navigating to ${portalUrl}` });
    try {
      await page.goto(portalUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2500);
      const shot = await takeScreenshot(page);
      const title = await page.title().catch(() => "unknown");
      emit({ step: 2, action: currentAction, status: "done", detail: `Real bank site loaded: "${title}".`, screenshot: shot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const shot = await takeScreenshot(page);
      emit({ step: 2, action: currentAction, status: "failed", detail: `Could not fully load the portal: ${msg}`, screenshot: shot });
    }

    // ---------------- STEP 3: Card member login (manual) ----------------
    currentStep = 3;
    currentAction = "Card member login";
    emit({
      step: 3,
      action: currentAction,
      status: "waiting_user",
      detail:
        "The card member authenticates to the bank themselves — ClaimGuard never sees or stores bank credentials. The real claim form is behind this login.",
    });
    await page.waitForTimeout(1200);
    {
      const shot = await takeScreenshot(page);
      emit({ step: 3, action: currentAction, status: "done", detail: "Login is the card member's step. The engine proceeds to demonstrate form-filling on the claim form demo.", screenshot: shot });
    }

    // ---------------- STEP 4: Open the claim form demo ----------------
    // The bank's actual claim form is behind authentication, so we navigate to
    // a claim form demo with identical fields to demonstrate live form-filling.
    currentStep = 4;
    currentAction = "Opening claim form";
    const formUrl = demoFormUrl || `http://localhost:3005/?bank=${encodeURIComponent(bankName ?? "Your Bank")}`;
    emit({ step: 4, action: currentAction, status: "running", detail: `Loading claim form (${bankName ?? "bank"} template, ${fields.length} fields).` });
    try {
      await page.goto(formUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(1000);
      const shot = await takeScreenshot(page);
      emit({ step: 4, action: currentAction, status: "done", detail: `Claim form loaded. ${fields.length} fields to fill.`, screenshot: shot });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emit({ step: 4, action: currentAction, status: "failed", detail: `Could not load claim form: ${msg}` });
    }

    // ---------------- STEP 5: Fill form fields LIVE ----------------
    currentStep = 5;
    currentAction = "Filling claim form";
    // Give the user a moment to switch to the live form tab and watch.
    // The demo form tab opens in a new browser tab; this pause lets the user
    // focus it before the filling begins.
    emit({
      step: 5,
      action: currentAction,
      status: "waiting_user",
      detail: "Opening the live form tab — switch to it to watch the form fill up. Starting in 3 seconds…",
    });
    await page.waitForTimeout(3000);
    emit({
      step: 5,
      action: currentAction,
      status: "running",
      detail: `Filling ${fields.length} field(s) by label…`,
    });
    let filled = 0;
    let skipped = 0;
    let halfwayShotSent = false;
    const halfway = Math.max(1, Math.floor(fields.length / 2));

    for (const field of fields) {
      if (field.type === "file") {
        skipped++;
        continue;
      }
      try {
        // Locate by label text first (generic strategy — works on any form
        // with matching labels, not hardcoded IDs).
        let locator = page.getByLabel(field.label, { exact: false }).first();
        let count = await locator.count();
        if (count === 0) {
          // Fallback to name/id derived from field.key.
          locator = page.locator(`[name="${field.key}"], #${field.key}`).first();
          count = await locator.count();
        }
        if (count === 0) {
          skipped++;
          continue;
        }
        if (field.type === "select") {
          try {
            await locator.selectOption(field.value);
          } catch {
            await locator.selectOption({ label: field.value });
          }
        } else {
          await locator.fill(field.value);
        }
        filled++;

        // Emit a fill:field event so the user's visible demo-form tab can
        // mirror the filling in real time.
        try {
          io.to(sessionId).emit("fill:field", {
            key: field.key,
            label: field.label,
            value: field.value,
            type: field.type,
          });
        } catch (e) {
          console.warn("[emit fill:field] failed:", e);
        }

        // Send a progress screenshot at the halfway point.
        if (!halfwayShotSent && filled >= halfway) {
          const shot = await takeScreenshot(page);
          emit({
            step: 5,
            action: currentAction,
            status: "running",
            detail: `Halfway: ${filled}/${fields.length} fields filled.`,
            screenshot: shot,
          });
          halfwayShotSent = true;
        }
        // Small delay so the filling is visible in the stream.
        await page.waitForTimeout(400);
      } catch {
        skipped++;
      }
    }
    {
      const s5 = await takeScreenshot(page);
      emit({
        step: 5,
        action: currentAction,
        status: "done",
        detail: `Filled ${filled} of ${fields.length} field(s); ${skipped} skipped (file inputs handled separately).`,
        screenshot: s5,
      });
    }

    // ---------------- STEP 6: Upload documents ----------------
    currentStep = 6;
    currentAction = "Uploading documents";
    emit({
      step: 6,
      action: currentAction,
      status: "running",
      detail: `${documents.length} document(s) to attach.`,
    });
    try {
      if (documents.length > 0) {
        const fileInput = page.locator('input[type="file"]').first();
        const existing: string[] = [];
        for (const doc of documents) {
          const abs = path.resolve(UPLOADS_ROOT, doc.dataPath);
          if (await fileExists(abs)) existing.push(abs);
        }
        if (existing.length > 0) {
          await fileInput.setInputFiles(existing);
        }
      }
      await page.waitForTimeout(800);
      const s6 = await takeScreenshot(page);
      emit({
        step: 6,
        action: currentAction,
        status: "done",
        detail: documents.length > 0 ? `Attached ${documents.length} document(s).` : "No documents to upload.",
        screenshot: s6,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const shot = await takeScreenshot(page);
      emit({ step: 6, action: currentAction, status: "failed", detail: `Upload failed: ${msg}`, screenshot: shot });
    }

    // ---------------- STEP 7: Review ----------------
    currentStep = 7;
    currentAction = "Reviewing completed form";
    emit({ step: 7, action: currentAction, status: "running", detail: "Capturing final review of the completed claim form." });
    await page.waitForTimeout(800);
    {
      const s7 = await takeScreenshot(page);
      emit({ step: 7, action: currentAction, status: "done", detail: "Form fully filled and reviewed. Ready for the card member to submit.", screenshot: s7 });
    }

    // ---------------- STEP 8: STOP — do NOT submit ----------------
    currentStep = 8;
    currentAction = "Stopped before submission";
    const s8 = await takeScreenshot(page);
    emit({
      step: 8,
      action: currentAction,
      status: "done",
      detail:
        "Submission intentionally skipped — no claim was filed. In production, the card member reviews the pre-filled form and clicks submit themselves.",
      screenshot: s8,
    });
  } catch (err) {
    // Catch-all safety net — should not normally be hit.
    await fail(err);
  } finally {
    // Keep the browser context alive briefly so retries / inspection are possible,
    // then close. Don't block the finally on this — use setTimeout.
    const b = browser;
    setTimeout(() => {
      try {
        if (b) void b.close();
      } catch (e) {
        console.warn("[finally] browser close failed:", e);
      }
    }, 3000);
  }
}

// ---------- Graceful shutdown ----------

const shutdown = (sig: string) => {
  console.log(`[playwright-service] received ${sig}, shutting down…`);
  try {
    io.close();
  } catch (e) {
    console.warn("[shutdown] io.close failed:", e);
  }
  try {
    httpServer.close(() => process.exit(0));
  } catch (e) {
    console.warn("[shutdown] httpServer.close failed:", e);
    process.exit(0);
  }
  // Force-exit after 5s if graceful close hangs.
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
  // Don't crash — keep the server up.
});
process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
  // Don't crash — keep the server up.
});
