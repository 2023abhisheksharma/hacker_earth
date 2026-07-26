"use client";

import { useEffect, useState } from "react";
import { Wallet, TrendingUp, FileCheck2, Percent, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { api, formatINR } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import type { DashboardStats } from "@/lib/types";

export function StatsCards() {
  const refreshNonce = useAppStore((s) => s.refreshNonce);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ stats: DashboardStats }>("/api/stats")
      .then((d) => active && setStats(d.stats))
      .catch(() => active && setStats(null))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [refreshNonce]);

  const cards = [
    {
      label: "Unclaimed benefits",
      value: stats ? String(stats.unclaimedBenefits) : "—",
      sub: stats ? `${formatINR(stats.unclaimedValue)} potential cover` : "",
      icon: Wallet,
      accent: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Claims filed",
      value: stats ? String(stats.claimsFiled) : "—",
      sub: "via auto-submission",
      icon: FileCheck2,
      accent: "text-cyan-600 dark:text-cyan-400",
      bg: "bg-cyan-500/10",
    },
    {
      label: "Savings unlocked",
      value: stats ? formatINR(stats.savingsUnlocked) : "—",
      sub: "approved reimbursements",
      icon: TrendingUp,
      accent: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
    },
    {
      label: "Approval rate",
      value: stats ? `${stats.approvalRate}%` : "—",
      sub: "of filed claims",
      icon: Percent,
      accent: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {cards.map((c) => (
        <Card key={c.label} className="p-4 sm:p-5 relative overflow-hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-muted-foreground truncate">{c.label}</p>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin mt-2 text-muted-foreground" />
              ) : (
                <p className="text-xl sm:text-2xl font-bold mt-1 tracking-tight truncate">{c.value}</p>
              )}
              <p className="text-[11px] text-muted-foreground mt-1 truncate">{c.sub}</p>
            </div>
            <div className={`h-9 w-9 rounded-lg ${c.bg} grid place-items-center shrink-0`}>
              <c.icon className={`h-4.5 w-4.5 ${c.accent}`} />
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
