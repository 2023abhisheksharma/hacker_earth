"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Wand2, Send, Save, X, ShieldCheck, ExternalLink, Lock, Upload } from "lucide-react";
import { api, formatINR, formatDate } from "@/lib/client";
import { useAppStore } from "@/store/app-store";
import { useToast } from "@/hooks/use-toast";
import { BENEFIT_TYPES } from "@/lib/constants";
import { BenefitIcon, ACCENT_CLASSES } from "./benefit-icon";
import { DocumentUpload } from "./document-upload";
import { AutomationPanel } from "./automation-panel";
import type { BenefitType, ClaimFormField } from "@/lib/types";

interface BenefitDetail {
  id: string;
  type: string;
  status: string;
  coverageAmount: number;
  reason: string;
  confidence: number;
  expiresAt: string | null;
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

export function ClaimDetail() {
  const { selectedBenefitId, selectBenefit, setActiveClaimId, activeClaimId, resetAutomation, bumpRefresh, setTab } =
    useAppStore();
  const { toast } = useToast();
  const open = !!selectedBenefitId;

  const [benefit, setBenefit] = useState<BenefitDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [fields, setFields] = useState<ClaimFormField[]>([]);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimStatus, setClaimStatus] = useState<string>("draft");
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // load benefit + create/fetch claim when opened
  useEffect(() => {
    if (!selectedBenefitId) {
      setBenefit(null);
      setFields([]);
      setClaimId(null);
      return;
    }
    setLoading(true);
    api<{ benefits: BenefitDetail[] }>("/api/benefits")
      .then(async (d) => {
        const b = d.benefits.find((x) => x.id === selectedBenefitId);
        if (!b) return;
        setBenefit(b);
        // existing claim?
        const existing = b.claims[0];
        if (existing) {
          const cd = await api<{ claim: { id: string; formData: string; status: string } }>(
            `/api/claims/${existing.id}`
          );
          setClaimId(cd.claim.id);
          setActiveClaimId(cd.claim.id);
          setClaimStatus(cd.claim.status);
          setFields(cd.claim.formData ? JSON.parse(cd.claim.formData) : []);
        } else {
          // create draft
          const created = await api<{
            claim: { id: string; status: string };
            prefill: { fields: ClaimFormField[] };
          }>("/api/claims", { method: "POST", body: JSON.stringify({ benefitId: b.id }) });
          setClaimId(created.claim.id);
          setActiveClaimId(created.claim.id);
          setClaimStatus(created.claim.status);
          setFields(created.prefill.fields);
          bumpRefresh();
        }
      })
      .catch((e) => toast({ title: "Failed to load benefit", description: e instanceof Error ? e.message : "", variant: "destructive" }))
      .finally(() => setLoading(false));
  }, [selectedBenefitId, setActiveClaimId, bumpRefresh, toast]);

  function close() {
    selectBenefit(null);
    resetAutomation();
  }

  function updateField(key: string, value: string) {
    setFields((f) => f.map((x) => (x.key === key ? { ...x, value } : x)));
  }

  async function saveDraft() {
    if (!claimId) return;
    setSaving(true);
    try {
      await api(`/api/claims/${claimId}`, { method: "PATCH", body: JSON.stringify({ fields }) });
      toast({ title: "Draft saved", description: "Pre-filled fields updated." });
    } catch (e) {
      toast({ title: "Save failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function submitClaim() {
    if (!claimId) return;
    setSubmitting(true);
    resetAutomation();
    try {
      // save latest fields first
      await api(`/api/claims/${claimId}`, { method: "PATCH", body: JSON.stringify({ fields }) });
      const res = await api<{ sessionId: string; claimId: string; portalUrl: string }>(
        `/api/claims/${claimId}/submit`,
        { method: "POST" }
      );
      useAppStore.getState().setAutomationSessionId(res.sessionId);
      toast({
        title: "Automation started",
        description: "Playwright is opening the bank portal and filling your claim.",
      });
    } catch (e) {
      toast({ title: "Submit failed", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const info = benefit ? BENEFIT_TYPES[benefit.type as BenefitType] ?? BENEFIT_TYPES.purchase_protection : null;
  const accent = info ? ACCENT_CLASSES[info.accent] ?? ACCENT_CLASSES.emerald : ACCENT_CLASSES.emerald;
  const canSubmit = claimStatus === "draft" || claimStatus === "failed";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent className="w-full sm:max-w-[560px] p-0 flex flex-col" side="right">
        <SheetHeader className="px-5 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-start justify-between gap-2 pr-6">
            <div className="flex items-start gap-3 min-w-0">
              {info && (
                <div className={`h-10 w-10 rounded-lg ${accent.bg} ${accent.text} grid place-items-center shrink-0`}>
                  <BenefitIcon type={info.type} className="h-5 w-5" />
                </div>
              )}
              <div className="min-w-0">
                <SheetTitle className="text-base leading-tight">{info?.label ?? "Claim"}</SheetTitle>
                <SheetDescription className="text-xs mt-0.5">
                  {benefit?.transaction.merchant} · {benefit?.transaction.card?.bankName} ···{benefit?.transaction.card?.last4}
                </SheetDescription>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 absolute top-4 right-4" onClick={close}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {benefit && (
            <div className="flex items-center gap-3 mt-3 text-xs">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Coverage</p>
                <p className={`font-bold ${accent.text}`}>{formatINR(benefit.coverageAmount)}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Spent</p>
                <p className="font-semibold">{formatINR(benefit.transaction.amount)}</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Confidence</p>
                <p className="font-semibold">{Math.round(benefit.confidence * 100)}%</p>
              </div>
              <Separator orientation="vertical" className="h-8" />
              <div>
                <p className="text-[10px] text-muted-foreground uppercase">Txn date</p>
                <p className="font-semibold">{formatDate(benefit.transaction.date)}</p>
              </div>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto cba-scroll min-h-0">
          <div className="p-5 space-y-5">
            {loading && (
              <div className="grid place-items-center py-12 text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mb-2" />
                <p className="text-sm">Preparing pre-filled claim…</p>
              </div>
            )}

            {!loading && benefit && (
              <>
                {/* Why it qualifies */}
                <div className="rounded-lg bg-muted/50 border p-3">
                  <p className="text-[11px] font-medium text-muted-foreground mb-1 flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" /> Why this qualifies
                  </p>
                  <p className="text-xs leading-relaxed">{benefit.reason}</p>
                </div>

                {/* Pre-filled form */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold flex items-center gap-1.5">
                      <Wand2 className="h-4 w-4 text-primary" /> Pre-filled claim form
                    </p>
                    <Badge variant="outline" className="text-[10px]">
                      {fields.length} fields
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {fields.map((f) => (
                      <div key={f.key} className={`space-y-1 ${f.type === "textarea" ? "col-span-2" : ""}`}>
                        <Label htmlFor={f.key} className="text-[11px] text-muted-foreground">
                          {f.label}
                          {f.required && <span className="text-rose-500 ml-0.5">*</span>}
                        </Label>
                        {f.type === "textarea" ? (
                          <Textarea
                            id={f.key}
                            value={f.value}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            className="text-sm min-h-[70px]"
                          />
                        ) : f.type === "select" ? (
                          <Select value={f.value} onValueChange={(v) => updateField(f.key, v)}>
                            <SelectTrigger className="h-9 text-sm">
                              <SelectValue placeholder={f.placeholder ?? "Select"} />
                            </SelectTrigger>
                            <SelectContent>
                              {(f.options ?? []).map((o) => (
                                <SelectItem key={o} value={o} className="text-sm">
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            id={f.key}
                            type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                            value={f.value}
                            onChange={(e) => updateField(f.key, e.target.value)}
                            placeholder={f.placeholder}
                            className="h-9 text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                  <Button variant="outline" size="sm" onClick={saveDraft} disabled={saving} className="gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save draft
                  </Button>
                </div>

                <Separator />

                {/* Documents — prominent upload section */}
                {claimId && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold flex items-center gap-1.5">
                        <Upload className="h-4 w-4 text-primary" /> Supporting documents
                      </p>
                      <Badge variant="outline" className="text-[10px]">image · pdf · text</Badge>
                    </div>
                    <DocumentUpload key={claimId} claimId={claimId} />
                  </div>
                )}

                <Separator />

                {/* Automation */}
                <AutomationPanel />

                {/* Privacy note */}
                <div className="rounded-lg border border-primary/15 bg-primary/5 p-3 flex items-start gap-2">
                  <Lock className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs font-medium">You log in. We fill the rest.</p>
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">
                      When you submit, Playwright opens the bank portal in a secure browser. You
                      authenticate yourself — we never see or store your bank password. After login,
                      the engine fills the form, uploads your documents, and submits the claim.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <SheetFooter className="border-t p-3 shrink-0">
          <div className="flex items-center gap-2 w-full">
            <Button variant="ghost" size="sm" onClick={() => setTab("claims")} className="gap-1">
              <ExternalLink className="h-3.5 w-3.5" /> History
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={close}>
              Close
            </Button>
            <Button size="sm" onClick={submitClaim} disabled={!canSubmit || submitting || loading} className="gap-1.5">
              {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              {canSubmit ? "Auto-submit claim" : "Submitted"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
