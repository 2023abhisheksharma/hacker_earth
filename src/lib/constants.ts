import type { BenefitType, BenefitTypeInfo, CardNetwork } from "./types";

// Indian banks supported by the engine
export const INDIAN_BANKS = [
  "HDFC Bank",
  "ICICI Bank",
  "Axis Bank",
  "SBI Card",
  "Kotak Mahindra",
  "Yes Bank",
  "IDFC First",
  "American Express",
] as const;

export type IndianBank = (typeof INDIAN_BANKS)[number];

// Bank claim portal URLs (mocked for demo; real portals vary)
export const BANK_PORTALS: Record<string, { url: string; name: string }> = {
  "HDFC Bank": { url: "http://localhost:3005", name: "HDFC SmartHub Claims" },
  "ICICI Bank": { url: "http://localhost:3005", name: "ICICI iProtect Claims" },
  "Axis Bank": { url: "http://localhost:3005", name: "Axis Edge Claims" },
  "SBI Card": { url: "http://localhost:3005", name: "SBI Card Secure Claims" },
  "Kotak Mahindra": { url: "http://localhost:3005", name: "Kotak Claims Hub" },
  "Yes Bank": { url: "http://localhost:3005", name: "Yes Bank Claims" },
  "IDFC First": { url: "http://localhost:3005", name: "IDFC Claims Portal" },
  "American Express": { url: "http://localhost:3005", name: "Amex Claims" },
};

export const BENEFIT_TYPES: Record<BenefitType, BenefitTypeInfo> = {
  purchase_protection: {
    type: "purchase_protection",
    label: "Purchase Protection",
    shortLabel: "Purchase",
    icon: "ShieldCheck",
    accent: "emerald",
    description:
      "Covers new items bought on the card against accidental damage or theft within 90 days of purchase.",
    defaultWindowDays: 90,
  },
  return_protection: {
    type: "return_protection",
    label: "Return Protection",
    shortLabel: "Return",
    icon: "RotateCcw",
    accent: "amber",
    description:
      "Refunds eligible items when the merchant refuses a return within the return window (typically 90 days).",
    defaultWindowDays: 90,
  },
  travel_delay: {
    type: "travel_delay",
    label: "Travel Delay Insurance",
    shortLabel: "Delay",
    icon: "Plane",
    accent: "cyan",
    description:
      "Reimburses meals and essentials when a flight is delayed beyond 4-6 hours, paid for using the card.",
    defaultWindowDays: 21,
  },
  lost_baggage: {
    type: "lost_baggage",
    label: "Lost Baggage Cover",
    shortLabel: "Baggage",
    icon: "Luggage",
    accent: "rose",
    description:
      "Compensation for checked-in baggage lost or delayed by the airline on tickets paid with the card.",
    defaultWindowDays: 21,
  },
  extended_warranty: {
    type: "extended_warranty",
    label: "Extended Warranty",
    shortLabel: "Warranty",
    icon: "BadgePercent",
    accent: "violet",
    description:
      "Extends the original manufacturer warranty on eligible electronics purchased with the card.",
    defaultWindowDays: 60,
  },
  air_accident: {
    type: "air_accident",
    label: "Air Accident Insurance",
    shortLabel: "Accident",
    icon: "Umbrella",
    accent: "slate",
    description:
      "Personal accident cover on flights ticketed using the card. Filed in case of injury during travel.",
    defaultWindowDays: 30,
  },
};

// MCC (Merchant Category Code) groups used for benefit matching
export const MCC_GROUPS: Record<string, string[]> = {
  electronics: ["5722", "5946", "5045", "4412"],
  travel_airline: ["3000", "3001", "3002", "3003", "3004", "3005", "3006", "3007", "3008", "3009", "4511"],
  travel_agency: ["4722", "4723"],
  grocery: ["5411", "5422", "5441", "5451", "5499"],
  dining: ["5811", "5812", "5813", "5814"],
  fuel: ["5541", "5983"],
  department_store: ["5310", "5311", "5651", "5699", "5300"],
  online_retail: ["5969", "5967", "5944"],
  jewelry: ["5944"],
};

// Detect a category from MCC + merchant text
export function inferCategory(mcc: string | undefined, merchant: string): import("./types").TxnCategory {
  const m = merchant.toLowerCase();
  if (mcc) {
    for (const [cat, codes] of Object.entries(MCC_GROUPS)) {
      if (codes.includes(mcc)) {
        if (cat === "travel_airline" || cat === "travel_agency") return "travel";
        if (cat === "electronics" || cat === "jewelry" || cat === "department_store" || cat === "online_retail")
          return "electronics";
        if (cat === "grocery") return "grocery";
        if (cat === "dining") return "dining";
        if (cat === "fuel") return "fuel";
      }
    }
  }
  // Heuristic merchant keywords (India-relevant)
  if (/indigo|spicejet|air(india)?|vistara|akasa|airline|flight|makemytrip|goibibo|cleartrip|yatra|irctc|oyo/.test(m))
    return "travel";
  if (/croma|reliance digital|bhiwadi|apple|samsung|mi store|vijay sales|poorvika|flipkart|amazon|nykaa|myntra|ajio/.test(m))
    return "shopping";
  if (/restaurant|cafe|bar|kitchen|dominos|kfc|mcdonald|zomato|swiggy|biryani|pizza/.test(m)) return "dining";
  if (/bigbazaar|dmart|reliance fresh|more|spencer|grocery|super ?market/.test(m)) return "grocery";
  if (/hp |bharat petroleum|indian oil|shell|fuel|petrol|diesel/.test(m)) return "fuel";
  return "other";
}

// Confidence scoring helper
export function scoreConfidence(matches: number, checks: number): number {
  if (checks === 0) return 0.5;
  return Math.min(0.98, 0.5 + (matches / checks) * 0.48);
}

export const NETWORKS: CardNetwork[] = ["Visa", "Mastercard", "RuPay", "Amex"];
