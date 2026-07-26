"use client";

import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/client";
import type { AutomationStep } from "@/lib/types";

// Connects to the Playwright service socket.io (port 3004 via gateway) when a
// sessionId is present, joins the room, and streams `automation:step` events
// into the global store. When the final submit step completes, it marks the
// claim as submitted so the history reflects the new state.
export function useAutomationSocket() {
  const sessionId = useAppStore((s) => s.automationSessionId);
  const upsertStep = useAppStore((s) => s.upsertStep);
  const bumpRefresh = useAppStore((s) => s.bumpRefresh);
  const activeClaimId = useAppStore((s) => s.activeClaimId);

  useEffect(() => {
    if (!sessionId) return;
    const socket = io("/?XTransformPort=3004", {
      path: "/",
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    let markedSubmitted = false;
    socket.on("connect", () => {
      socket.emit("join", sessionId);
    });
    socket.on("automation:step", (ev: AutomationStep) => {
      upsertStep({ ...ev, timestamp: ev.timestamp ?? new Date().toISOString() });
      // When the submit step finishes (done or failed), update the claim status.
      const isSubmitStep = /submit/i.test(ev.action ?? "");
      if (isSubmitStep && !markedSubmitted) {
        markedSubmitted = true;
        const status = ev.status === "done" ? "submitted" : ev.status === "failed" ? "failed" : null;
        if (status && activeClaimId) {
          api(`/api/claims/${activeClaimId}`, {
            method: "PATCH",
            body: JSON.stringify({ status }),
          }).catch(() => {});
        }
        // give the backend a moment, then refresh lists
        setTimeout(() => bumpRefresh(), 600);
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [sessionId, upsertStep, bumpRefresh, activeClaimId]);
}
