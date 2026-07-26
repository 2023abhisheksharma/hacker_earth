"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt, ShieldCheck } from "lucide-react";
import { api, formatINR, formatDate } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";

interface TxnRow {
  id: string;
  amount: number;
  merchant: string;
  category: string;
  date: string;
  source: string;
  cardLast4: string | null;
  card?: { bankName: string; cardName: string; last4: string } | null;
  benefits: { id: string; type: string; coverageAmount: number }[];
}

const CAT_COLORS: Record<string, string> = {
  shopping: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  travel: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  electronics: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  dining: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  grocery: "bg-lime-500/10 text-lime-700 dark:text-lime-300",
  fuel: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  other: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

export function TransactionList() {
  const refreshNonce = useAppStore((s) => s.refreshNonce);
  const selectBenefit = useAppStore((s) => s.selectBenefit);
  const setTab = useAppStore((s) => s.setTab);
  const [rows, setRows] = useState<TxnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    api<{ transactions: TxnRow[] }>("/api/transactions")
      .then((d) => active && setRows(d.transactions))
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
        <p className="text-sm">Loading transactions…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="grid place-items-center py-16 text-center text-muted-foreground">
        <Receipt className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">No transactions yet. Load demo data or paste SMS.</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="max-h-[60vh] overflow-y-auto cba-scroll">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/60 backdrop-blur z-10">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Merchant</th>
              <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Card</th>
              <th className="px-3 py-2.5 font-medium hidden md:table-cell">Category</th>
              <th className="px-3 py-2.5 font-medium hidden sm:table-cell">Date</th>
              <th className="px-3 py-2.5 font-medium text-right">Amount</th>
              <th className="px-3 py-2.5 font-medium text-right">Benefits</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} className="border-t hover:bg-muted/30 transition">
                <td className="px-3 py-2.5">
                  <div className="font-medium truncate max-w-[180px]">{t.merchant}</div>
                  <div className="text-[11px] text-muted-foreground sm:hidden">
                    {t.card?.bankName} ···{t.cardLast4 ?? t.card?.last4} · {formatDate(t.date)}
                  </div>
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell">
                  <div className="text-xs">{t.card?.bankName ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">···{t.cardLast4 ?? t.card?.last4 ?? "—"}</div>
                </td>
                <td className="px-3 py-2.5 hidden md:table-cell">
                  <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${CAT_COLORS[t.category] ?? CAT_COLORS.other}`}>
                    {t.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 hidden sm:table-cell text-xs text-muted-foreground">{formatDate(t.date)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatINR(t.amount)}</td>
                <td className="px-3 py-2.5 text-right">
                  {(t.benefits?.length ?? 0) > 0 ? (
                    <button
                      onClick={() => {
                        selectBenefit(t.benefits[0].id);
                        setTab("benefits");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t.benefits.length}
                    </button>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
