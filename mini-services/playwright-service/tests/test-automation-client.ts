// tests/test-automation-client.ts
// End-to-end test: connects to the playwright-service Socket.IO, posts /api/run,
// and prints every automation:step event received.

import { io } from "socket.io-client";

const PORT = 3004;
const sessionId = "test-session-" + Date.now();
const claimId = "test-claim-" + Date.now();

console.log(`[test] connecting to socket.io at http://localhost:${PORT}/ (path "/")`);
const socket = io(`http://localhost:${PORT}/`, {
  path: "/",
  transports: ["websocket", "polling"],
  reconnection: false,
});

const received: any[] = [];

socket.on("connect", () => {
  console.log(`[test] connected, socket.id=${socket.id}, joining room ${sessionId}`);
  socket.emit("join", sessionId);
});

socket.on("joined", (payload: any) => {
  console.log(`[test] joined ack:`, payload);
  // Now POST /api/run
  const payload2 = {
    portalUrl: "http://localhost:3005",
    claimId,
    sessionId,
    fields: [
      { key: "cardholder_name", label: "Cardholder Name", type: "text", value: "Arjun Mehta" },
      { key: "email", label: "Email", type: "email", value: "arjun.mehta@example.in" },
      { key: "mobile", label: "Mobile Number", type: "tel", value: "9876543210" },
      { key: "card_last4", label: "Card Last 4 Digits", type: "text", value: "4321" },
      { key: "card_name", label: "Card Variant", type: "text", value: "HDFC Regalia Gold" },
      { key: "merchant", label: "Merchant Name", type: "text", value: "Croma" },
      { key: "txn_date", label: "Transaction Date", type: "date", value: "2025-09-15" },
      { key: "txn_amount", label: "Transaction Amount (INR)", type: "number", value: "45000" },
      { key: "claim_amount", label: "Claim Amount (INR)", type: "number", value: "45000" },
      { key: "claim_type", label: "Claim Type", type: "select", value: "purchase_protection", options: ["Purchase Protection","Return Protection","Travel Delay","Lost Baggage","Extended Warranty","Air Accident"] },
      { key: "incident_date", label: "Incident Date", type: "date", value: "2025-10-10" },
      { key: "incident_desc", label: "Incident Description", type: "textarea", value: "Item purchased from Croma on 2025-09-15 for INR 45000 was damaged within 90 days of purchase." },
    ],
    documents: [
      { dataPath: "invoice.txt", fileType: "text", filename: "invoice.txt" },
      { dataPath: "id-proof.txt", fileType: "text", filename: "id-proof.txt" },
      { dataPath: "statement.txt", fileType: "text", filename: "statement.txt" },
    ],
  };

  console.log(`[test] POST /api/run with sessionId=${sessionId}`);
  fetch(`http://localhost:${PORT}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload2),
  })
    .then((r) => r.json())
    .then((j) => console.log("[test] /api/run response:", j))
    .catch((e) => console.error("[test] /api/run error:", e));
});

socket.on("automation:step", (ev: any) => {
  received.push(ev);
  const shotTag = ev.screenshot ? " [+shot]" : "";
  const detailSnippet = ev.detail ? " :: " + String(ev.detail).slice(0, 100) : "";
  console.log(`[step ${ev.step}] ${ev.status} — ${ev.action}${detailSnippet}${shotTag}`);

  // If this is step 8 done (or any failed final step), we can finish.
  if ((ev.step === 8 && ev.status === "done") || (ev.status === "failed" && ev.step >= 7)) {
    console.log(`[test] received ${received.length} events. Finishing in 1s.`);
    setTimeout(() => {
      console.log("[test] === ALL EVENTS ===");
      for (const e of received) {
        console.log(JSON.stringify({ step: e.step, action: e.action, status: e.status, detail: e.detail ? String(e.detail).slice(0, 80) : undefined, hasScreenshot: !!e.screenshot, timestamp: e.timestamp }));
      }
      const lastStep = received[received.length - 1];
      if (lastStep && lastStep.status === "done" && lastStep.step === 8) {
        console.log("[test] SUCCESS — automation completed");
        process.exit(0);
      } else {
        console.log("[test] automation did not complete successfully");
        process.exit(1);
      }
    }, 1500);
  }
});

socket.on("connect_error", (e: any) => {
  console.error("[test] connect_error:", e.message);
  process.exit(1);
});

socket.on("disconnect", (reason: string) => {
  console.log(`[test] disconnected: ${reason}`);
});

// Safety: exit after 90s
setTimeout(() => {
  console.error("[test] timed out after 90s");
  console.log("[test] === ALL EVENTS ===");
  for (const e of received) {
    console.log(JSON.stringify({ step: e.step, action: e.action, status: e.status, detail: e.detail ? String(e.detail).slice(0, 80) : undefined, hasScreenshot: !!e.screenshot, timestamp: e.timestamp }));
  }
  process.exit(2);
}, 90000);
