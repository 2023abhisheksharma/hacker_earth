// SMS Parser for Indian bank transaction alerts.
// Supports HDFC, ICICI, Axis, SBI, Kotak, Yes, IDFC formats.
// Extracts: amount, merchant, date, card last4.

import { inferCategory } from "../constants";
import type { ParsedTransaction, TxnSource } from "../types";

const INR_PATTERN = /(?:Rs\.?|INR|₹)\s*([0-9][0-9,]*\.?[0-9]*)/i;
const LAST4_PATTERN = /(?:xx|XX|\*{4}|card|x{0,4})\s*\.?\s*([0-9]{4})/i;
const DATE_PATTERNS: RegExp[] = [
  /(\d{1,2})[-\s]([A-Za-z]{3,9})[-\s](\d{2,4})/, // 24-Oct-25 / 24 October 2025
  /(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/, // 24-10-25 / 24/10/2025
  /(\d{1,2})\s+([A-Za-z]{3,9})\s+'?(\d{2,4})/, // 24 Oct '25
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

function parseAmount(text: string): number | null {
  const m = text.match(INR_PATTERN);
  if (!m) return null;
  return parseFloat(m[1].replace(/,/g, ""));
}

function parseLast4(text: string): string | undefined {
  const m = text.match(LAST4_PATTERN);
  return m ? m[1] : undefined;
}

function parseDate(text: string): Date | null {
  for (const pat of DATE_PATTERNS) {
    const m = text.match(pat);
    if (!m) continue;
    const day = parseInt(m[1], 10);
    let month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (isNaN(month)) {
      const key = m[2].toLowerCase().slice(0, 4);
      month = MONTHS[key] ?? MONTHS[m[2].toLowerCase()];
      if (month === undefined) continue;
    }
    if (year < 100) year += 2000;
    if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
      const d = new Date(year, month, day, 12, 0, 0);
      if (!isNaN(d.getTime())) return d;
    }
  }
  // fallback: today
  return null;
}

// Bank detection from sender/text
export function detectBank(text: string, sender?: string): string {
  const hay = `${sender ?? ""} ${text}`.toLowerCase();
  if (hay.includes("hdfc")) return "HDFC Bank";
  if (hay.includes("icici")) return "ICICI Bank";
  if (hay.includes("axis") || hay.includes("axbk")) return "Axis Bank";
  if (hay.includes("sbi") || hay.includes("sbic")) return "SBI Card";
  if (hay.includes("kotak")) return "Kotak Mahindra";
  if (hay.includes("yes")) return "Yes Bank";
  if (hay.includes("idfc")) return "IDFC First";
  if (hay.includes("amex") || hay.includes("american express")) return "American Express";
  return "HDFC Bank"; // default
}

// Merchant extraction: text after "at " / "on " / "via" near the amount, before punctuation
function parseMerchant(text: string): string {
  const candidates: string[] = [];
  // "at MERCHANT" / "via MERCHANT" / "on MERCHANT" / "from MERCHANT"
  const atPat = /(?:at|via|on|from)\s+([A-Z][A-Z0-9 &'.,-]{2,40})/g;
  let m: RegExpExecArray | null;
  while ((m = atPat.exec(text)) !== null) {
    candidates.push(m[1].trim().replace(/[.,;]+$/, ""));
  }
  // prefer merchant in caps that isn't a date/amount
  let clean = candidates.filter(
    (c) => !/^(RS|INR|AVL|BAL|AVAILABLE|CREDIT|DEBIT|THRU|ON|AT)$/.test(c.toUpperCase())
  );
  let picked = clean[0] ?? "Unknown Merchant";
  // Strip trailing bank-script fragments like ". Avl", ". Bal", " Avl bal"
  picked = picked.replace(/\s*[.\-]\s*(Avl|Bal|Available|Txn|Tran|Info|Avl bal).*$|(?<=\.)\s*A\w*$|\s+Avl.*$|\s+Bal.*$/i, "");
  // Trim trailing dot/single letter fragments
  picked = picked.replace(/[.\s]+$/, "").replace(/\s+[A-Z]$/, "");
  return picked || "Unknown Merchant";
}

export function parseSms(raw: string, sender?: string): ParsedTransaction | null {
  const text = raw.trim();
  if (!text) return null;

  const amount = parseAmount(text);
  if (amount === null) return null;

  // Only treat as a spend if it looks like a debit/spend alert
  const spendHints = /spent|debited|used|purchase|charged|txn|transaction|paid/i;
  if (!spendHints.test(text)) return null;

  const merchant = parseMerchant(text);
  const date = parseDate(text) ?? new Date();
  const cardLast4 = parseLast4(text);
  const bank = detectBank(text, sender);
  const category = inferCategory(undefined, merchant);

  return {
    amount,
    merchant,
    category,
    date,
    cardLast4,
    source: "sms",
    rawText: raw,
  };
}

// Parse a batch of SMS messages separated by blank lines or "---"
export function parseSmsBatch(raw: string): ParsedTransaction[] {
  const chunks = raw
    .split(/\n\s*\n|\n---\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: ParsedTransaction[] = [];
  for (const chunk of chunks) {
    const parsed = parseSms(chunk);
    if (parsed) out.push(parsed);
  }
  return out;
}

export { parseDate, parseAmount };
