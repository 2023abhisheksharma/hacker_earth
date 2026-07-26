"use client";

import { useEffect, useState } from "react";
import { Loader2, FileCheck2, History } from "lucide-react";
import { api, formatINR, formatDate, timeAgo } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

interface ClaimRow {
  id: string;
  status: string;
  portalBank: string | null;
  createdAt: string;
  submittedAt: string | null;
  benefit: {
    id: string;
    type: string;
    coverageAmount: number;
    transaction: {
      merchant: string;
      amount: number;
      date: string;
      card?: { bankName: string; cardName: string; last4: string } | null;
    };
  };
  documents: { id: string; filename: string; fileType: string }[];
}

const STATUS_STYLE: Record<string, { label: string; cls: string }> = {
  draft: { label: "Draft", cls: "bg-slate-500/10 text-slate-700 dark:text-slate-300" },
  submitting: { label: "Submitting", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  submitted: { label: "Submitted", cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  under_review: { label: "Under review", cls: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300" },
  approved: { label: "Approved", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  rejected: { label: "Rejected", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
  failed: { label: "Failed", cls: "bg-rose-500/10 text-rose-700 dark:text-rose-300" },
};

export function ClaimHistory() {
  const refreshNonce = useAppStore((s) => s.refreshNonce);
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ claims: ClaimRow[] }>("/api/claims")
      .then((d) => active && setRows(d.claims))
      .catch(() => active && setRows([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshNonce]);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mb-2" />
        <p className="text-sm">Loading claims…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center text-muted-foreground">
        <History className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No claims filed yet.</p>
        <p className="text-xs mt-1">Select a benefit to start your first pre-filled claim.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5 max-h-[65vh] overflow-y-auto cba-scroll pr-1">
      {rows.map((c) => {
        const st = STATUS_STYLE[c.status] ?? STATUS_STYLE.draft;
        return (
          <Card key={c.id} className="p-3.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm truncate">{c.benefit.transaction.merchant}</p>
                  <Badge className={`text-[10px] border-0 ${st.cls}`} variant="outline">{st.label}</Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {c.portalBank ?? "Bank"} ···{c.benefit.transaction.card?.last4} · {formatDate(c.benefit.transaction.date)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-bold">{formatINR(c.benefit.coverageAmount)}</p>
                <p className="text-[10px] text-muted-foreground">{c.documents.length} docs</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <FileCheck2 className="h-3 w-3" /> Created {timeAgo(c.createdAt)}
              </span>
              {c.submittedAt && <span>Submitted {timeAgo(c.submittedAt)}</span>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
