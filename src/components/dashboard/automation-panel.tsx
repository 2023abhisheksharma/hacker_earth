"use client";

import { CheckCircle2, Loader2, XCircle, Clock, Play, Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAppStore } from "@/store/app-store";
import { useAutomationSocket } from "@/hooks/use-automation-socket";
import { useState } from "react";

const STATUS_ICON = {
  done: CheckCircle2,
  running: Loader2,
  pending: Clock,
  failed: XCircle,
  waiting_user: Play,
};

const STATUS_CLS = {
  done: "text-emerald-600 dark:text-emerald-400",
  running: "text-primary",
  pending: "text-muted-foreground",
  failed: "text-rose-600 dark:text-rose-400",
  waiting_user: "text-amber-600 dark:text-amber-400",
};

export function AutomationPanel() {
  useAutomationSocket();
  const steps = useAppStore((s) => s.automationSteps);
  const sessionId = useAppStore((s) => s.automationSessionId);
  const [showShot, setShowShot] = useState<string | null>(null);

  if (!sessionId && steps.length === 0) {
    return null;
  }

  const latestShot = [...steps].reverse().find((s) => s.screenshot)?.screenshot;
  const lastStep = steps[steps.length - 1];
  const isRunning = steps.some((s) => s.status === "running" || s.status === "waiting_user" || s.status === "pending");
  const failed = steps.some((s) => s.status === "failed");

  return (
    <Card className="border-primary/20 overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 to-transparent px-4 py-3 border-b">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className={`h-8 w-8 rounded-lg grid place-items-center ${failed ? "bg-rose-500/10 text-rose-600" : isRunning ? "bg-primary/15 text-primary cba-pulse" : "bg-emerald-500/10 text-emerald-600"}`}>
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : failed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Automation engine</p>
              <p className="text-[11px] text-muted-foreground leading-tight">
                {failed ? "Submission failed — see steps below" : isRunning ? "Playwright is filling your claim…" : "Claim submitted"}
              </p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] gap-1">
            <Camera className="h-3 w-3" /> {steps.filter((s) => s.screenshot).length} screenshots
          </Badge>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {/* Latest screenshot */}
        {latestShot && (
          <button
            onClick={() => setShowShot(latestShot)}
            className="block w-full rounded-lg overflow-hidden border bg-muted/30 hover:opacity-90 transition relative group"
          >
            <img src={latestShot} alt="Automation preview" className="w-full h-auto max-h-[220px] object-contain" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition text-white text-xs bg-black/60 px-2 py-1 rounded">
                Click to enlarge
              </span>
            </div>
            <div className="absolute top-1.5 left-1.5 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
              {lastStep?.action}
            </div>
          </button>
        )}

        {/* Step list */}
        <div className="space-y-1.5 max-h-[280px] overflow-y-auto cba-scroll pr-1">
          {steps.map((s) => {
            const Icon = STATUS_ICON[s.status] ?? Clock;
            const cls = STATUS_CLS[s.status] ?? STATUS_CLS.pending;
            return (
              <div key={s.step} className="flex items-start gap-2.5 text-xs">
                <div className="flex flex-col items-center pt-0.5">
                  <Icon className={`h-4 w-4 ${cls} ${s.status === "running" ? "animate-spin" : ""}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`font-medium ${s.status === "pending" ? "text-muted-foreground" : ""}`}>
                      <span className="text-muted-foreground mr-1">{s.step}.</span> {s.action}
                    </p>
                    {s.screenshot && (
                      <button
                        onClick={() => setShowShot(s.screenshot!)}
                        className="text-[10px] text-primary hover:underline shrink-0"
                      >
                        view
                      </button>
                    )}
                  </div>
                  {s.detail && (
                    <p className={`text-[11px] mt-0.5 leading-relaxed ${s.status === "failed" ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>
                      {s.detail}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Enlarged screenshot lightbox */}
      {showShot && (
        <div
          className="fixed inset-0 z-50 bg-black/80 grid place-items-center p-4"
          onClick={() => setShowShot(null)}
        >
          <img src={showShot} alt="Screenshot" className="max-w-full max-h-full rounded-lg shadow-2xl" />
        </div>
      )}
    </Card>
  );
}
