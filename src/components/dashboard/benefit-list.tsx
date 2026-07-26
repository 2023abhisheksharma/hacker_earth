"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Loader2, Sparkles, FileText, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { api, formatINR, formatDate } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { BENEFIT_TYPES } from "@/lib/constants";
import { BenefitIcon, ACCENT_CLASSES } from "./benefit-icon";
import type { BenefitType } from "@/lib/types";

interface BenefitRow {
  id: string;
  type: string;
  status: string;
  coverageAmount: number;
  reason: string;
  confidence: number;
  expiresAt: string | null;
  detectedAt: string;
  transaction: {
    id: string;
    amount: number;
    merchant: string;
    date: string;
    category: string;
    card?: { bankName: string; cardName: string; last4: string } | null;
  };
  claims: { id: string; status: string }[];
}

export function BenefitList() {
  const { selectedBenefitId, selectBenefit, refreshNonce, bumpRefresh } = useAppStore();
  const [rows, setRows] = useState<BenefitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ benefits: BenefitRow[] }>("/api/benefits")
      .then((d) => active && setRows(d.benefits))
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
        <p className="text-sm">Scanning transactions for qualifying benefits…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 grid place-items-center mb-3">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <p className="font-medium">No benefits detected yet</p>
        <p className="text-sm text-muted-foreground max-w-sm mt-1">
          Click <span className="font-medium text-foreground">Load demo data</span> in the header, or paste your bank SMS in the
          Ingest panel to start detecting card protections.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={bumpRefresh}>
          Refresh
        </Button>
      </div>
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {rows.map((b) => {
        const info = BENEFIT_TYPES[b.type as BenefitType] ?? BENEFIT_TYPES.purchase_protection;
        const accent = ACCENT_CLASSES[info.accent] ?? ACCENT_CLASSES.emerald;
        const isSelected = selectedBenefitId === b.id;
        const hasClaim = b.claims.length > 0;
        const daysLeft = b.expiresAt
          ? Math.max(0, Math.ceil((new Date(b.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
          : null;
        return (
          <Card
            key={b.id}
            className={`p-4 cursor-pointer transition hover:shadow-md hover:-translate-y-0.5 border ${
              isSelected ? "border-primary ring-2 ring-primary/20" : "border-border"
            }`}
            onClick={() => selectBenefit(isSelected ? null : b.id)}
          >
            <div className="flex items-start gap-3">
              <div className={`h-10 w-10 rounded-lg ${accent.bg} ${accent.text} grid place-items-center shrink-0`}>
                <BenefitIcon type={b.type as BenefitType} className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm leading-tight truncate">{info.label}</p>
                  {hasClaim ? (
                    <Badge variant="secondary" className="text-[10px] gap-1 shrink-0">
                      <FileText className="h-3 w-3" /> Claim
                    </Badge>
                  ) : (
                    <Badge className={`text-[10px] gap-1 shrink-0 ${accent.bg} ${accent.text} border-0`} variant="outline">
                      <ShieldCheck className="h-3 w-3" /> New
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                  {b.transaction.merchant} · {b.transaction.card?.bankName ?? "Card"} ···{b.transaction.card?.last4 ?? b.transaction.card?.last4}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] text-muted-foreground">Potential cover</p>
                <p className={`text-lg font-bold ${accent.text}`}>{formatINR(b.coverageAmount)}</p>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-muted-foreground">Spent</p>
                <p className="text-sm font-semibold">{formatINR(b.transaction.amount)}</p>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Confidence
                </span>
                <span className="font-medium">{Math.round(b.confidence * 100)}%</span>
              </div>
              <Progress value={b.confidence * 100} className="h-1.5" />
            </div>

            <p className="mt-2 text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{b.reason}</p>

            <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {daysLeft !== null ? `${daysLeft}d left to file` : formatDate(b.transaction.date)}
              </span>
              <span>{formatDate(b.transaction.date)}</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
