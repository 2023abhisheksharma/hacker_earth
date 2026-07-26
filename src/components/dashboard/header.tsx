"use client";

import { ShieldCheck, LogOut, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAppStore } from "@/store/app-store";
import { api } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export function Header() {
  const { user, setUser, bumpRefresh } = useAppStore();
  const { toast } = useToast();
  const [seeding, setSeeding] = useState(false);

  async function seedDemo() {
    setSeeding(true);
    try {
      const res = await api<{ cards: number; transactions: number; benefits: number }>("/api/seed", { method: "POST" });
      toast({
        title: "Demo data ready",
        description: `${res.cards} cards · ${res.transactions} transactions · ${res.benefits} benefits detected.`,
      });
      bumpRefresh();
    } catch (e) {
      toast({ title: "Seed failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setUser(null);
  }

  const initials = (user?.name ?? user?.email ?? "U")
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-primary text-primary-foreground grid place-items-center shrink-0">
            <ShieldCheck className="h-4.5 w-4.5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold leading-tight truncate">ClaimGuard</p>
            <p className="text-[11px] text-muted-foreground leading-tight truncate hidden sm:block">
              Card Benefit Activation Engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={seedDemo} disabled={seeding} className="gap-1.5">
            {seeding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">Load demo data</span>
            <span className="sm:hidden">Demo</span>
          </Button>
          <div className="flex items-center gap-2 pl-2 border-l">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-primary/10 text-primary text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div className="hidden md:block text-right">
              <p className="text-xs font-medium leading-tight truncate max-w-[140px]">{user?.name ?? "Card Member"}</p>
              <p className="text-[10px] text-muted-foreground leading-tight truncate max-w-[140px]">{user?.email}</p>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
