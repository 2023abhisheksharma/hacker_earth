"use client";

import {
  ShieldCheck,
  RotateCcw,
  Plane,
  Luggage,
  BadgePercent,
  Umbrella,
  type LucideIcon,
} from "lucide-react";
import type { BenefitType } from "@/lib/types";

const MAP: Record<BenefitType, LucideIcon> = {
  purchase_protection: ShieldCheck,
  return_protection: RotateCcw,
  travel_delay: Plane,
  lost_baggage: Luggage,
  extended_warranty: BadgePercent,
  air_accident: Umbrella,
};

export function BenefitIcon({ type, className }: { type: BenefitType; className?: string }) {
  const Icon = MAP[type] ?? ShieldCheck;
  return <Icon className={className} />;
}

export const ACCENT_CLASSES: Record<string, { bg: string; text: string; ring: string; dot: string }> = {
  emerald: { bg: "bg-emerald-500/10", text: "text-emerald-700 dark:text-emerald-300", ring: "ring-emerald-500/20", dot: "bg-emerald-500" },
  amber: { bg: "bg-amber-500/10", text: "text-amber-700 dark:text-amber-300", ring: "ring-amber-500/20", dot: "bg-amber-500" },
  cyan: { bg: "bg-cyan-500/10", text: "text-cyan-700 dark:text-cyan-300", ring: "ring-cyan-500/20", dot: "bg-cyan-500" },
  rose: { bg: "bg-rose-500/10", text: "text-rose-700 dark:text-rose-300", ring: "ring-rose-500/20", dot: "bg-rose-500" },
  violet: { bg: "bg-violet-500/10", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-500/20", dot: "bg-violet-500" },
  slate: { bg: "bg-slate-500/10", text: "text-slate-700 dark:text-slate-300", ring: "ring-slate-500/20", dot: "bg-slate-500" },
};
