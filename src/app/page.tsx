"use client";

import { useEffect } from "react";
import { ShieldCheck, Cpu, Workflow, Lock, Sparkles } from "lucide-react";
import { api } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { LoginScreen } from "@/components/auth/login-screen";
import { Header } from "@/components/dashboard/header";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { ParserPanel } from "@/components/dashboard/parser-panel";
import { BenefitList } from "@/components/dashboard/benefit-list";
import { TransactionList } from "@/components/dashboard/transaction-list";
import { ClaimHistory } from "@/components/dashboard/claim-history";
import { ClaimDetail } from "@/components/dashboard/claim-detail";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  const { user, authLoading, setUser, setAuthLoading, tab, setTab, refreshNonce, bumpRefresh } = useAppStore();

  // check existing session on mount
  useEffect(() => {
    api<{ user: { id: string; email: string; name?: string | null; phone?: string | null } | null }>("/api/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  // when user logs in and has no benefits yet, auto-seed demo data once
  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const ben = await api<{ benefits: unknown[] }>("/api/benefits");
        if (active && ben.benefits.length === 0) {
          await api("/api/seed", { method: "POST" });
          bumpRefresh();
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  if (authLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground grid place-items-center cba-pulse">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <p className="text-sm text-muted-foreground">Loading ClaimGuard…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 py-5 space-y-5">
        {/* Hero strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Welcome back, {user.name?.split(" ")[0] ?? user.email.split("@")[0]} 👋
            </h1>
            <p className="text-sm text-muted-foreground">
              Your cards are being watched for unused insurance &amp; protection benefits.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Engine live
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border px-2 py-1">
              <Cpu className="h-3 w-3" /> 5 banks · 6 benefit types
            </span>
          </div>
        </div>

        <StatsCards />

        <div className="grid lg:grid-cols-3 gap-5">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-3">
            <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
              <TabsList className="grid grid-cols-3 w-full max-w-md">
                <TabsTrigger value="benefits">Benefits</TabsTrigger>
                <TabsTrigger value="transactions">Transactions</TabsTrigger>
                <TabsTrigger value="claims">Claims</TabsTrigger>
              </TabsList>
              <TabsContent value="benefits" className="mt-3">
                <BenefitList />
              </TabsContent>
              <TabsContent value="transactions" className="mt-3">
                <TransactionList />
              </TabsContent>
              <TabsContent value="claims" className="mt-3">
                <ClaimHistory />
              </TabsContent>
            </Tabs>
          </div>

          {/* Side column */}
          <div className="space-y-4">
            <div className="lg:sticky lg:top-[4.5rem] space-y-4">
              <ParserPanel />
              <HowItWorksCard />
            </div>
          </div>
        </div>
      </main>

      <ClaimDetail />

      <footer className="mt-auto border-t bg-card/50 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <span>ClaimGuard — Card Benefit Activation Engine</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> No credentials stored</span>
            <span className="flex items-center gap-1"><Workflow className="h-3 w-3" /> Playwright auto-fill</span>
            <span className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Real-time detection</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksCard() {
  const steps = [
    { icon: Sparkles, title: "Detect", desc: "SMS & email transactions are parsed and matched to your card's benefit catalog in real time." },
    { icon: ShieldCheck, title: "Pre-fill", desc: "Qualifying benefits auto-generate a complete claim form — no manual data entry." },
    { icon: Workflow, title: "File", desc: "Playwright opens the bank portal, you log in once, and the engine submits the claim." },
  ];
  return (
    <Card className="border-primary/10">
      <CardContent className="p-4 space-y-3">
        <p className="text-sm font-semibold">How it works</p>
        <div className="space-y-3">
          {steps.map((s, i) => (
            <div key={s.title} className="flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
                  <s.icon className="h-4 w-4" />
                </div>
                {i < steps.length - 1 && (
                  <div className="absolute left-1/2 top-8 -translate-x-1/2 w-px h-3 bg-border" />
                )}
              </div>
              <div className="pt-0.5">
                <p className="text-xs font-medium">{s.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
