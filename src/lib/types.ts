// Shared domain types for the Card Benefit Activation Engine

export type BenefitType =
  | "purchase_protection"
  | "return_protection"
  | "travel_delay"
  | "lost_baggage"
  | "extended_warranty"
  | "air_accident";

export type BenefitStatus =
  | "detected"
  | "viewed"
  | "claim_started"
  | "submitted"
  | "approved"
  | "rejected"
  | "expired";

export type ClaimStatus =
  | "draft"
  | "submitting"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected"
  | "failed";

export type TxnCategory =
  | "shopping"
  | "travel"
  | "dining"
  | "electronics"
  | "grocery"
  | "fuel"
  | "other";

export type TxnSource = "sms" | "email" | "manual";

export type CardNetwork = "Visa" | "Mastercard" | "RuPay" | "Amex";

export interface BenefitTypeInfo {
  type: BenefitType;
  label: string;
  shortLabel: string;
  icon: string; // lucide icon name
  accent: string; // tailwind color token
  description: string;
  defaultWindowDays: number;
}

export interface ParsedTransaction {
  amount: number;
  merchant: string;
  mcc?: string;
  category: TxnCategory;
  date: Date;
  cardLast4?: string;
  source: TxnSource;
  rawText?: string;
}

export interface DetectionResult {
  benefitType: BenefitType;
  reason: string;
  coverageAmount: number;
  confidence: number;
  windowDays: number;
  expiresAt: Date;
}

export interface ClaimFormField {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "date" | "number" | "textarea" | "select" | "file";
  value: string;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface PreFilledClaim {
  benefitType: BenefitType;
  bankName: string;
  portalUrl: string;
  fields: ClaimFormField[];
  documents: { filename: string; fileType: "image" | "pdf" | "text" }[];
}

export interface AutomationStep {
  step: number;
  action: string;
  status: "pending" | "running" | "done" | "failed" | "waiting_user";
  detail?: string;
  screenshot?: string;
  timestamp: string;
}

export interface DashboardStats {
  totalBenefits: number;
  unclaimedBenefits: number;
  unclaimedValue: number;
  claimsFiled: number;
  savingsUnlocked: number;
  approvalRate: number;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  phone?: string;
}
