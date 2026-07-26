"use client";

import { useState } from "react";
import { ShieldCheck, Mail, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { api } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";

export function LoginScreen() {
  const { setUser, setAuthLoading } = useAppStore();
  const { toast } = useToast();
  const [email, setEmail] = useState("arjun.mehta@example.in");
  const [name, setName] = useState("Arjun Mehta");
  const [phone, setPhone] = useState("9876543210");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const data = await api<{ user: unknown }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, name, phone }),
      });
      setUser(data.user as never);
      toast({ title: "Welcome to ClaimGuard", description: "Your card benefits are being scanned." });
    } catch (err) {
      toast({
        title: "Login failed",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setAuthLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
          {/* Left: hero */}
          <div className="hidden lg:block space-y-6 pr-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
              <ShieldCheck className="h-3.5 w-3.5" />
              Card Benefit Activation Engine
            </div>
            <h1 className="text-4xl xl:text-5xl font-bold tracking-tight leading-tight">
              Never miss a card benefit you&apos;ve{" "}
              <span className="text-primary">already paid for.</span>
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              ClaimGuard watches your transactions in real time, detects purchases that
              qualify for purchase protection, return protection, travel-delay insurance
              and more — then pre-fills the claim and files it automatically on your
              Indian bank&apos;s portal.
            </p>
            <ul className="space-y-3 text-sm">
              {[
                "Real-time SMS & email transaction ingestion",
                "Auto-detection across HDFC, ICICI, Axis, SBI & Kotak cards",
                "Playwright-powered claim filing — you log in, we fill the rest",
                "No bank credentials ever stored. Privacy-first.",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: login card */}
          <Card className="shadow-xl border-primary/10">
            <CardHeader className="space-y-3 pb-2">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground grid place-items-center">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold leading-tight">ClaimGuard</p>
                  <p className="text-xs text-muted-foreground">Sign in with email — no password needed</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.in"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full name</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Arjun Mehta"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">Mobile</Label>
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="10-digit"
                      maxLength={10}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" /> Signing in…
                    </>
                  ) : (
                    <>
                      Continue <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  We only use your email to create a session. We never store your bank
                  credentials — you log in to your bank portal yourself inside the
                  automation browser, and we discard that session immediately after.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
      <footer className="border-t bg-card/50 backdrop-blur py-4 text-center text-xs text-muted-foreground">
        ClaimGuard · Demo for Card Benefit Activation Engine · No real bank credentials are processed.
      </footer>
    </div>
  );
}
