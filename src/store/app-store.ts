"use client";

import { create } from "zustand";
import type { AutomationStep } from "@/lib/types";

export type MainTab = "benefits" | "transactions" | "claims";

interface AppState {
  // auth
  user: { id: string; email: string; name?: string | null; phone?: string | null } | null;
  authLoading: boolean;
  setUser: (u: AppState["user"]) => void;
  setAuthLoading: (v: boolean) => void;

  // main tab
  tab: MainTab;
  setTab: (t: MainTab) => void;

  // selected benefit (opens claim panel)
  selectedBenefitId: string | null;
  selectBenefit: (id: string | null) => void;

  // active claim being drafted/submitted
  activeClaimId: string | null;
  setActiveClaimId: (id: string | null) => void;

  // automation progress (Playwright)
  automationSteps: AutomationStep[];
  automationSessionId: string | null;
  liveFormUrl: string | null;
  setAutomationSessionId: (id: string | null) => void;
  setLiveFormUrl: (url: string | null) => void;
  upsertStep: (step: AutomationStep) => void;
  resetAutomation: () => void;

  // refresh nonce to trigger refetches
  refreshNonce: number;
  bumpRefresh: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  authLoading: true,
  setUser: (u) => set({ user: u }),
  setAuthLoading: (v) => set({ authLoading: v }),

  tab: "benefits",
  setTab: (t) => set({ tab: t }),

  selectedBenefitId: null,
  selectBenefit: (id) => set({ selectedBenefitId: id }),

  activeClaimId: null,
  setActiveClaimId: (id) => set({ activeClaimId: id }),

  automationSteps: [],
  automationSessionId: null,
  liveFormUrl: null,
  setAutomationSessionId: (id) => set({ automationSessionId: id }),
  setLiveFormUrl: (url) => set({ liveFormUrl: url }),
  upsertStep: (step) =>
    set((s) => {
      const idx = s.automationSteps.findIndex((x) => x.step === step.step);
      const next = [...s.automationSteps];
      if (idx >= 0) next[idx] = { ...next[idx], ...step };
      else next.push(step);
      next.sort((a, b) => a.step - b.step);
      return { automationSteps: next };
    }),
  resetAutomation: () => set({ automationSteps: [], automationSessionId: null, liveFormUrl: null }),

  refreshNonce: 0,
  bumpRefresh: () => set((s) => ({ refreshNonce: s.refreshNonce + 1 })),
}));
