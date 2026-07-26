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
const UPLOADS_ROOT = "/home/z/my-project/uploads";

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
  portalUrl: string;
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
  const { portalUrl, fields, documents, sessionId } = payload;

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
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
      page = await context.newPage();
      emit({ step: 1, action: currentAction, status: "done", detail: "Chromium launched (headless, 1280x900)." });
    } catch (err) {
      await fail(err);
      return;
    }

    // ---------------- STEP 2: Navigate ----------------
    currentStep = 2;
    currentAction = "Navigating to bank claim portal";
    emit({ step: 2, action: currentAction, status: "running", detail: `Going to ${portalUrl}` });
    try {
      await page.goto(portalUrl, { waitUntil: "networkidle", timeout: 30000 });
      const shot = await takeScreenshot(page);
      emit({ step: 2, action: currentAction, status: "done", detail: "Portal loaded (networkidle).", screenshot: shot });
    } catch (err) {
      await fail(err);
      return;
    }

    // ---------------- STEP 3: Login (simulated) ----------------
    currentStep = 3;
    currentAction = "Waiting for card member login";
    emit({
      step: 3,
      action: currentAction,
      status: "waiting_user",
      detail:
        "In production this step waits for the card member to log in manually; no credentials are stored. (Sandbox: simulating the login with dummy ephemeral values.)",
    });
    emit({
      step: 3,
      action: currentAction,
      status: "running",
      detail: "Simulating manual login with dummy credentials (ephemeral, not stored).",
    });
    try {
      // Dummy ephemeral credentials — represent the user's manual login in a real deployment.
      // Never persisted anywhere.
      const dummyUserId = "cardmember_demo";
      const dummyPassword = "demo_dummy_" + Date.now().toString(36);
      await page.getByLabel("User ID", { exact: false }).first().fill(dummyUserId);
      await page.getByLabel("Password", { exact: false }).first().fill(dummyPassword);
      await page.getByRole("button", { name: "Login" }).click();
      await page.waitForSelector("#claim-section:not(.hidden)", { timeout: 10000 });
      const shot = await takeScreenshot(page);
      emit({ step: 3, action: currentAction, status: "done", detail: "Login complete; claim form visible.", screenshot: shot });
    } catch (err) {
      await fail(err);
      return;
    }

    // ---------------- STEP 4: Select claim type ----------------
    currentStep = 4;
    currentAction = "Selecting claim type";
    emit({ step: 4, action: currentAction, status: "running", detail: "Looking for a claim_type select field…" });
    try {
      const claimTypeField = fields.find(
        (f) => f.key === "claim_type" || (f.type === "select" && /type/i.test(f.key)),
      );
      const selectLocator = page.locator("#claim_type");
      if (claimTypeField && claimTypeField.value) {
        // Try value match first, fallback to label match.
        try {
          await selectLocator.selectOption(claimTypeField.value);
        } catch {
          await selectLocator.selectOption({ label: claimTypeField.value });
        }
        emit({ step: 4, action: currentAction, status: "done", detail: `Selected claim type: ${claimTypeField.value}` });
      } else {
        emit({
          step: 4,
          action: currentAction,
          status: "done",
          detail: "No claim_type field provided in payload; leaving default selection.",
        });
      }
    } catch (err) {
      // Non-fatal — claim type selection is best-effort.
      const msg = err instanceof Error ? err.message : String(err);
      emit({ step: 4, action: currentAction, status: "done", detail: `Claim type selection skipped: ${msg}` });
    }

    // ---------------- STEP 5: Fill fields ----------------
    currentStep = 5;
    currentAction = "Filling claim form fields";
    emit({ step: 5, action: currentAction, status: "running", detail: `Iterating ${fields.length} field(s).` });
    let filled = 0;
    let skipped = 0;
    const halfway = Math.max(1, Math.floor(fields.length / 2));
    let halfwayShotSent = false;

    for (const field of fields) {
      if (field.key === "claim_type") continue; // handled in step 4
      if (field.type === "file") {
        // File inputs are handled in step 6.
        skipped++;
        continue;
      }
      try {
        // Try locating by label first.
        let locator = page.getByLabel(field.label, { exact: false }).first();
        let count = await locator.count();
        if (count === 0) {
          // Fallback to name/id derived from field.key.
          locator = page.locator(`[name="${field.key}"], #${field.key}`).first();
          count = await locator.count();
        }
        if (count === 0) {
          emit({
            step: 5,
            action: currentAction,
            status: "running",
            detail: `Skipped "${field.label}" (key=${field.key}) — no input found by label/name/id`,
          });
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
          // text / email / tel / date / number / textarea — all use .fill()
          await locator.fill(field.value);
        }
        filled++;

        if (!halfwayShotSent && filled >= halfway) {
          const shot = await takeScreenshot(page);
          emit({
            step: 5,
            action: currentAction,
            status: "running",
            detail: `Halfway: ${filled} field(s) filled, ${skipped} skipped.`,
            screenshot: shot,
          });
          halfwayShotSent = true;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit({
          step: 5,
          action: currentAction,
          status: "running",
          detail: `Field "${field.label}" (key=${field.key}) failed: ${msg}`,
        });
        skipped++;
      }
    }
    const s5 = await takeScreenshot(page);
    emit({
      step: 5,
      action: currentAction,
      status: "done",
      detail: `Filled ${filled} field(s); skipped ${skipped}.`,
      screenshot: s5,
    });

    // ---------------- STEP 6: Upload documents ----------------
    currentStep = 6;
    currentAction = "Uploading supporting documents";
    emit({
      step: 6,
      action: currentAction,
      status: "running",
      detail: `Resolving ${documents.length} document(s) under ${UPLOADS_ROOT}`,
    });
    try {
      const fileInput = page.locator('input[type="file"]').first();
      const existingFiles: string[] = [];
      const missingFiles: string[] = [];
      for (const doc of documents) {
        const abs = path.resolve(UPLOADS_ROOT, doc.dataPath);
        if (await fileExists(abs)) {
          existingFiles.push(abs);
        } else {
          missingFiles.push(doc.dataPath);
        }
      }

      if (existingFiles.length > 0) {
        await fileInput.setInputFiles(existingFiles);
      }

      const s6 = await takeScreenshot(page);
      const parts: string[] = [];
      if (existingFiles.length > 0) parts.push(`uploaded ${existingFiles.length} file(s)`);
      if (missingFiles.length > 0) {
        const preview = missingFiles.slice(0, 3).join(", ");
        parts.push(`missing ${missingFiles.length} (${preview}${missingFiles.length > 3 ? "…" : ""})`);
      }
      if (parts.length === 0) parts.push("no documents specified");
      emit({ step: 6, action: currentAction, status: "done", detail: parts.join("; "), screenshot: s6 });
    } catch (err) {
      // Non-fatal — keep going so we still attempt to submit.
      const msg = err instanceof Error ? err.message : String(err);
      const shot = await takeScreenshot(page);
      emit({
        step: 6,
        action: currentAction,
        status: "failed",
        detail: `Upload step failed (continuing): ${msg}`,
        screenshot: shot,
      });
    }

    // ---------------- STEP 7: Review ----------------
    currentStep = 7;
    currentAction = "Reviewing pre-filled claim";
    emit({ step: 7, action: currentAction, status: "running", detail: "Capturing final review screenshot." });
    try {
      const s7 = await takeScreenshot(page);
      emit({ step: 7, action: currentAction, status: "done", detail: "Review screenshot captured.", screenshot: s7 });
    } catch (err) {
      await fail(err);
    }

    // ---------------- STEP 8: Submit ----------------
    currentStep = 8;
    currentAction = "Submitting claim";
    emit({ step: 8, action: currentAction, status: "running", detail: "Clicking 'Submit Claim'…" });
    try {
      await page.getByRole("button", { name: "Submit Claim" }).click();
      await page.waitForSelector("#success-section:not(.hidden)", { timeout: 15000 });

      let reference = "unknown";
      try {
        const refText = await page.locator("#ref-number").textContent();
        if (refText) reference = refText.trim();
      } catch {
        /* ignore — reference extraction is best-effort */
      }

      const s8 = await takeScreenshot(page);
      emit({
        step: 8,
        action: currentAction,
        status: "done",
        detail: `Claim submitted successfully. Reference: ${reference}`,
        screenshot: s8,
      });
    } catch (err) {
      await fail(err);
    }
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
