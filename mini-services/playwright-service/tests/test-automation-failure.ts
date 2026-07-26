// tests/test-automation-failure.ts
// Verifies error handling: bad portal URL should emit a `failed` step, not crash the server.

import { io } from "socket.io-client";

const PORT = 3004;
const sessionId = "test-fail-session-" + Date.now();

const socket = io(`http://localhost:${PORT}/`, {
  path: "/",
  transports: ["websocket", "polling"],
  reconnection: false,
});

let done = false;
const finish = (code: number) => {
  if (done) return;
  done = true;
  setTimeout(() => process.exit(code), 500);
};

socket.on("connect", () => {
  console.log("[test] connected, joining", sessionId);
  socket.emit("join", sessionId);
});

socket.on("joined", async () => {
  console.log("[test] posting /api/run with bad portalUrl");
  const r = await fetch(`http://localhost:${PORT}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      portalUrl: "http://localhost:59999", // nothing listening here
      claimId: "fail-test",
      sessionId,
      fields: [
        { key: "cardholder_name", label: "Cardholder Name", type: "text", value: "Test" },
      ],
      documents: [],
    }),
  });
  console.log("[test] /api/run response:", await r.json());
});

socket.on("automation:step", (ev: any) => {
  console.log(`[step ${ev.step}] ${ev.status} — ${ev.action}${ev.detail ? " :: " + String(ev.detail).slice(0, 120) : ""}`);
  if (ev.status === "failed") {
    console.log("[test] got failed event as expected");
    // Now verify the server is still up.
    setTimeout(async () => {
      try {
        const r = await fetch(`http://localhost:${PORT}/api/health`);
        const j = await r.json();
        console.log("[test] /api/health after failure:", j);
        if (j.ok === true) {
          console.log("[test] SUCCESS — server still up after failure");
          finish(0);
        } else {
          console.log("[test] FAIL — server health check returned non-ok");
          finish(1);
        }
      } catch (e) {
        console.log("[test] FAIL — server is down:", e);
        finish(1);
      }
    }, 1500);
  }
});

socket.on("connect_error", (e: any) => {
  console.error("[test] connect_error:", e.message);
  finish(1);
});

setTimeout(() => {
  console.error("[test] timed out after 60s");
  finish(2);
}, 60000);
