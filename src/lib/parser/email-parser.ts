// Email Parser for Indian bank transaction/statement emails.
// Handles per-transaction emails and inline statement tables.

import { inferCategory } from "../constants";
import { parseAmount, parseDate } from "./sms-parser";
import type { ParsedTransaction } from "../types";

interface EmailInput {
  subject?: string;
  from?: string;
  body: string;
  receivedAt?: string; // ISO
}

// Table-row parser: rows like "24-Oct-2025  AMAZON IN  1,500.00  Shopping"
const TABLE_ROW = /(\d{1,2}[-\s][A-Za-z]{3,9}[-\s]'?\d{2,4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})\s+([A-Za-z0-9 &'.,-]{2,40})\s+([0-9][0-9,]*\.?[0-9]{0,2})/g;

export function parseEmail(input: EmailInput): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];
  const body = input.body ?? "";
  const receivedAt = input.receivedAt ? new Date(input.receivedAt) : new Date();

  // Try structured table rows first
  let m: RegExpExecArray | null;
  TABLE_ROW.lastIndex = 0;
  while ((m = TABLE_ROW.exec(body)) !== null) {
    const dateStr = m[1];
    const merchant = m[2].trim();
    const amount = parseFloat(m[3].replace(/,/g, ""));
    if (!isNaN(amount) && amount > 0) {
      const date = parseDate(dateStr) ?? receivedAt;
      results.push({
        amount,
        merchant,
        category: inferCategory(undefined, merchant),
        date,
        source: "email",
        rawText: `${dateStr} ${merchant} ${m[3]}`,
      });
    }
  }

  // Fallback: single-transaction email
  if (results.length === 0) {
    const amount = parseAmount(body);
    if (amount !== null) {
      // merchant after "at"/"on"/"via" in caps
      const atPat = /(?:at|on|via|from)\s+([A-Z][A-Z0-9 &'.,-]{2,40})/;
      const mm = body.match(atPat);
      const merchant = mm ? mm[1].trim().replace(/[.,;]+$/, "") : "Unknown Merchant";
      const date = parseDate(body) ?? receivedAt;
      results.push({
        amount,
        merchant,
        category: inferCategory(undefined, merchant),
        date,
        source: "email",
        rawText: `${input.subject ?? ""}\n${body.slice(0, 280)}`,
      });
    }
  }

  return results;
}
