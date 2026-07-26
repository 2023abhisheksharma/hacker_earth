"use client";

import { useState } from "react";
import { MessageSquareText, Mail, Loader2, Wand2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { api } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";

const SAMPLE_SMS = `HDFC Bank: Rs.12,499.00 spent on your HDFC Bank Credit Card XX8841 on 22-Oct-25 at CROMA. Avl bal: Rs.2,34,500.

Axis Bank: Rs.18,500.00 spent on Axis Bank Credit Card XX2293 on 15-Oct-25 at SAMSUNG.COM. Avl bal: Rs.1,20,000.

Axis Bank: Rs.9,750.00 spent on Axis Bank Credit Card XX2293 on 12-Oct-25 at INDIGO. Avl bal: Rs.1,38,750.`;

export function ParserPanel() {
  const { bumpRefresh } = useAppStore();
  const { toast } = useToast();
  const [source, setSource] = useState<"sms" | "email">("sms");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  async function parse() {
    if (!text.trim()) {
      toast({ title: "Paste some content first", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ parsed: number; txnsCreated: number; benefitsDetected: number }>(
        "/api/transactions/parse",
        { method: "POST", body: JSON.stringify({ source, text }) }
      );
      toast({
        title: "Parsed & scanned",
        description: `${res.txnsCreated} new transaction(s) · ${res.benefitsDetected} benefit(s) detected.`,
      });
      setText("");
      bumpRefresh();
    } catch (e) {
      toast({ title: "Parse failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="border-primary/10">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary grid place-items-center">
              <Wand2 className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-sm leading-tight">Ingest transactions</p>
              <p className="text-[11px] text-muted-foreground leading-tight">SMS / email → live detection</p>
            </div>
          </div>
          <div className="flex rounded-lg border p-0.5 bg-muted/40">
            <button
              type="button"
              onClick={() => setSource("sms")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition ${
                source === "sms" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
              }`}
            >
              <MessageSquareText className="h-3.5 w-3.5" /> SMS
            </button>
            <button
              type="button"
              onClick={() => setSource("email")}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition ${
                source === "email" ? "bg-background shadow-sm text-primary" : "text-muted-foreground"
              }`}
            >
              <Mail className="h-3.5 w-3.5" /> Email
            </button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="parse-text" className="text-xs">
            Paste {source === "sms" ? "bank SMS alerts" : "statement email body"} (multiple allowed, blank-line separated)
          </Label>
          <Textarea
            id="parse-text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={source === "sms" ? "HDFC Bank: Rs.12,499.00 spent on your HDFC Bank Credit Card XX8841 on 22-Oct-25 at CROMA..." : "Dear Customer, your card was charged..."}
            className="min-h-[120px] max-h-[260px] cba-scroll text-sm font-mono"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={parse} disabled={loading} className="gap-1.5 flex-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Parse & detect
          </Button>
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                Sample <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="absolute z-30 mt-2 w-[min(92vw,420px)]">
              <Card className="shadow-lg">
                <CardContent className="p-3 space-y-2">
                  <p className="text-[11px] text-muted-foreground">Click to load sample SMS:</p>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-start text-left whitespace-normal h-auto py-2"
                    onClick={() => {
                      setSource("sms");
                      setText(SAMPLE_SMS);
                      setOpen(false);
                    }}
                  >
                    <span className="font-mono text-[11px]">3 sample HDFC/Axis SMS alerts</span>
                  </Button>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
}
