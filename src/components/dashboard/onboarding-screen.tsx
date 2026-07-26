"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  Plus,
  Sparkles,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { INDIAN_BANKS, NETWORKS, BENEFIT_TYPES } from "@/lib/constants";
import type { BenefitType } from "@/lib/types";

interface CardRow {
  id: string;
  bankName: string;
  cardName: string;
  last4: string;
  network: string;
  benefits: { type: string }[];
}

export function OnboardingScreen() {
  const { bumpRefresh } = useAppStore();
  const { toast } = useToast();

  const [bankName, setBankName] = useState<string>(INDIAN_BANKS[0]);
  const [cardName, setCardName] = useState("");
  const [last4, setLast4] = useState("");
  const [network, setNetwork] = useState<string>("Visa");
  const [adding, setAdding] = useState(false);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [cards, setCards] = useState<CardRow[]>([]);

  async function refreshCards() {
    try {
      const d = await api<{ cards: CardRow[] }>("/api/cards");
      setCards(d.cards);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshCards();
  }, []);

  async function addCard(e: React.FormEvent) {
    e.preventDefault();
    if (!bankName || !cardName || !/^\d{4}$/.test(last4)) {
      toast({ title: "Check your inputs", description: "Bank, card name and 4-digit last4 are required.", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      const res = await api<{ card: CardRow; inCatalog: boolean; benefitsLoaded: number }>("/api/cards/add", {
        method: "POST",
        body: JSON.stringify({ bankName, cardName, last4, network }),
      });
      toast({
        title: "Card added",
        description: res.inCatalog
          ? `${res.benefitsLoaded} protection benefits loaded from catalog.`
          : "Card added. No matching catalog entry — benefits won't be auto-detected.",
      });
      setCardName("");
      setLast4("");
      await refreshCards();
    } catch (e) {
      toast({ title: "Failed to add card", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function loadDemoCards() {
    setLoadingDemo(true);
    try {
      const res = await api<{ added: number; total: number }>("/api/cards/demo", { method: "POST" });
      toast({ title: "Demo cards loaded", description: `${res.added} new card(s) added (total ${res.total}).` });
      await refreshCards();
    } catch (e) {
      toast({ title: "Failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoadingDemo(false);
    }
  }

  function continueToDashboard() {
    bumpRefresh();
  }

  const hasCards = cards.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 sm:py-12">
      <div className="text-center mb-8">
        <div className="inline-flex h-12 w-12 rounded-2xl bg-primary/10 text-primary grid place-items-center mb-3">
          <CreditCard className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">Set up your card portfolio</h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Add the cards you hold so the engine can match your transactions to the right
          insurance &amp; protection benefits. No card numbers are stored — only the last 4 digits.
        </p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${hasCards ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground cba-pulse"}`}>
            {hasCards ? <CheckCircle2 className="h-4 w-4" /> : "1"}
          </div>
          <span className={`text-xs ${!hasCards ? "font-medium" : "text-muted-foreground"}`}>Add cards</span>
        </div>
        <div className="w-10 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${hasCards ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            2
          </div>
          <span className={`text-xs ${hasCards ? "font-medium" : "text-muted-foreground"}`}>Load transactions</span>
        </div>
        <div className="w-10 h-px bg-border" />
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${hasCards ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            3
          </div>
          <span className={`text-xs ${hasCards ? "font-medium" : "text-muted-foreground"}`}>Detect benefits</span>
        </div>
      </div>

      {/* Add card form */}
      <Card className="mb-4">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-sm flex items-center gap-1.5">
                <Plus className="h-4 w-4 text-primary" /> Add a card manually
              </p>
              <p className="text-[11px] text-muted-foreground">Enter the last 4 digits — we never store full card numbers.</p>
            </div>
            <Button variant="outline" size="sm" onClick={loadDemoCards} disabled={loadingDemo} className="gap-1.5 shrink-0">
              {loadingDemo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Load demo cards
            </Button>
          </div>

          <form onSubmit={addCard} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-[11px] text-muted-foreground">Bank</Label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDIAN_BANKS.map((b) => (
                    <SelectItem key={b} value={b} className="text-sm">{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2 sm:col-span-1">
              <Label className="text-[11px] text-muted-foreground">Card name</Label>
              <Input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="e.g. Infinia" className="h-9 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Last 4 digits</Label>
              <Input value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="8841" className="h-9 text-sm font-mono" maxLength={4} />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-muted-foreground">Network</Label>
              <Select value={network} onValueChange={setNetwork}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((n) => (
                    <SelectItem key={n} value={n} className="text-sm">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 sm:col-span-4 flex items-center gap-2 pt-1">
              <Button type="submit" disabled={adding} className="gap-1.5">
                {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add card
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Card list */}
      {hasCards && (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-muted-foreground px-1">Your cards ({cards.length})</p>
          {cards.map((c) => {
            const benefitTypes = [...new Set(c.benefits.map((b) => b.type))] as BenefitType[];
            return (
              <Card key={c.id} className="p-3.5">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-14 rounded-md bg-gradient-to-br from-primary/15 to-primary/5 grid place-items-center shrink-0">
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{c.cardName}</p>
                      <Badge variant="outline" className="text-[10px]">{c.bankName}</Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono">···· {c.last4} · {c.network}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground uppercase">{benefitTypes.length} benefits</p>
                    <div className="flex items-center gap-0.5 mt-0.5 justify-end">
                      {benefitTypes.slice(0, 5).map((bt) => (
                        <span key={bt} className="h-1.5 w-1.5 rounded-full bg-primary/60" title={BENEFIT_TYPES[bt]?.label} />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Continue button */}
      {hasCards && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/15 text-emerald-600 grid place-items-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">Cards ready — next: load transactions</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Continue to the dashboard and click <span className="font-medium">Load demo data</span> to ingest sample SMS transactions.
              </p>
            </div>
            <Button onClick={continueToDashboard} className="gap-1.5 shrink-0" size="sm">
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Privacy note */}
      <div className="mt-6 rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          We only store the last 4 digits of your card — never the full number, CVV, or expiry.
          Bank portal login happens live inside the Playwright browser when you file a claim, and is
          discarded immediately after. No bank credentials are ever persisted.
        </p>
      </div>
    </div>
  );
}
