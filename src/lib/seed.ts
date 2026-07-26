// Demo seed: creates cards + sample transactions for a user, runs detection.
// Mirrors a "first login" onboarding where the engine ingests SMS history.

import { db } from "./db";
import { CARD_CATALOG } from "./benefits/catalog";
import { detectBenefits } from "./benefits/detector";
import { parseSmsBatch } from "./parser/sms-parser";
import { inferCategory } from "./constants";
import type { BenefitType } from "./types";

const SAMPLE_SMS = buildSampleSms();

function fmtDate(d: Date): string {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(2);
  return `${dd}-${months[d.getMonth()]}-${yy}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(12, 0, 0, 0);
  return d;
}

// Build a realistic batch of Indian bank SMS alerts with dates relative to
// "now" so they always fall inside the claim-filing windows.
function buildSampleSms(): string {
  const txns: { bank: string; last4: string; amount: string; merchant: string; days: number }[] = [
    { bank: "HDFC Bank", last4: "8841", amount: "12,499.00", merchant: "CROMA", days: 3 },
    { bank: "HDFC Bank", last4: "8841", amount: "8,250.00", merchant: "AMAZON.IN", days: 8 },
    { bank: "HDFC Bank", last4: "8841", amount: "14,800.00", merchant: "MAKEMYTRIP", days: 14 },
    { bank: "Axis Bank", last4: "2293", amount: "18,500.00", merchant: "SAMSUNG.COM", days: 16 },
    { bank: "Axis Bank", last4: "2293", amount: "9,750.00", merchant: "INDIGO", days: 5 },
    { bank: "ICICI Bank", last4: "5512", amount: "3,499.00", merchant: "FLIPKART", days: 10 },
    { bank: "HDFC Bank", last4: "8841", amount: "6,200.00", merchant: "VIJAY SALES", days: 6 },
    { bank: "SBI Card", last4: "7741", amount: "2,250.00", merchant: "BIGBASKET", days: 12 },
    { bank: "Kotak", last4: "3398", amount: "5,600.00", merchant: "APPLE", days: 9 },
  ];
  return txns
    .map(
      (t) =>
        `${t.bank}: Rs.${t.amount} spent on your ${t.bank} Credit Card XX${t.last4} on ${fmtDate(daysAgo(t.days))} at ${t.merchant}. Avl bal: Rs.1,00,000.`
    )
    .join("\n\n");
}

interface DemoCard {
  bankName: string;
  cardName: string;
  cardType: "credit" | "debit";
  network: import("./types").CardNetwork;
  last4: string;
}

const DEMO_CARDS: DemoCard[] = [
  { bankName: "HDFC Bank", cardName: "Infinia Credit Card", cardType: "credit", network: "Visa", last4: "8841" },
  { bankName: "Axis Bank", cardName: "Magnus Credit Card", cardType: "credit", network: "Mastercard", last4: "2293" },
  { bankName: "ICICI Bank", cardName: "Amazon Pay Credit Card", cardType: "credit", network: "Visa", last4: "5512" },
  { bankName: "SBI Card", cardName: "Elite Credit Card", cardType: "credit", network: "Visa", last4: "7741" },
  { bankName: "Kotak Mahindra", cardName: "Zen Credit Card", cardType: "credit", network: "Visa", last4: "3398" },
];

export async function seedUser(userId: string) {
  // 1. Create cards + their benefit entitlements from the catalog
  const cardMap: Record<string, string> = {}; // last4 -> cardId
  for (const dc of DEMO_CARDS) {
    const catalog = CARD_CATALOG.find(
      (c) => c.bankName === dc.bankName && c.cardName === dc.cardName
    );
    if (!catalog) continue;
    const existing = await db.card.findFirst({
      where: { userId, last4: dc.last4 },
    });
    if (existing) {
      cardMap[dc.last4] = existing.id;
      continue;
    }
    const card = await db.card.create({
      data: {
        userId,
        bankName: dc.bankName,
        cardName: dc.cardName,
        cardType: dc.cardType,
        network: dc.network,
        last4: dc.last4,
        benefits: {
          create: catalog.benefits.map((b) => ({
            type: b.type,
            title: b.title,
            description: b.description,
            coverageLimit: b.coverageLimit,
            windowDays: b.windowDays,
            conditions: JSON.stringify(b.conditions),
          })),
        },
      },
    });
    cardMap[dc.last4] = card.id;
  }

  // 2. Parse sample SMS into transactions, link to cards by last4
  const parsed = parseSmsBatch(SAMPLE_SMS);
  const createdTxns: { id: string; last4?: string; amount: number; merchant: string; category: string; date: Date }[] = [];

  for (const p of parsed) {
    // de-dupe by rawText+amount
    const dup = await db.transaction.findFirst({
      where: { userId, amount: p.amount, merchant: p.merchant, rawText: p.rawText ?? null },
    });
    if (dup) {
      createdTxns.push({ id: dup.id, last4: p.cardLast4, amount: dup.amount, merchant: dup.merchant, category: dup.category, date: dup.date });
      continue;
    }
    const cardId = p.cardLast4 ? cardMap[p.cardLast4] ?? null : null;
    const txn = await db.transaction.create({
      data: {
        userId,
        cardId,
        amount: p.amount,
        merchant: p.merchant,
        category: p.category,
        date: p.date,
        source: p.source,
        rawText: p.rawText,
        cardLast4: p.cardLast4,
      },
    });
    createdTxns.push({ id: txn.id, last4: p.cardLast4, amount: p.amount, merchant: p.merchant, category: p.category, date: p.date });
  }

  // 3. Run detection on each transaction against its card's benefits
  let detected = 0;
  for (const t of createdTxns) {
    const card = t.last4 ? DEMO_CARDS.find((c) => c.last4 === t.last4) : undefined;
    if (!card) continue;
    // recompute category with merchant (already done in parser, but keep consistent)
    const category = t.category as import("./types").TxnCategory;
    const results = detectBenefits({
      amount: t.amount,
      merchant: t.merchant,
      category,
      date: t.date,
      cardBankName: card.bankName,
      cardName: card.cardName,
    });
    for (const r of results) {
      // de-dupe benefit
      const exists = await db.benefit.findFirst({
        where: { transactionId: t.id, type: r.benefitType },
      });
      if (exists) continue;
      const cardBenefit = await db.cardBenefit.findFirst({
        where: {
          card: { userId, last4: card.last4 },
          type: r.benefitType as BenefitType,
        },
      });
      await db.benefit.create({
        data: {
          userId,
          transactionId: t.id,
          type: r.benefitType,
          cardBenefitId: cardBenefit?.id ?? null,
          status: "detected",
          coverageAmount: r.coverageAmount,
          reason: r.reason,
          confidence: r.confidence,
          expiresAt: r.expiresAt,
        },
      });
      detected++;
    }
  }

  return { cards: DEMO_CARDS.length, transactions: createdTxns.length, benefits: detected };
}

// Manual transaction add (also used by the SMS parser endpoint generically)
export async function ingestParsed(
  userId: string,
  parsed: import("./types").ParsedTransaction[]
) {
  const cards = await db.card.findMany({ where: { userId } });
  const byLast4: Record<string, string> = {};
  for (const c of cards) byLast4[c.last4] = c.id;

  let txnsCreated = 0;
  let benefitsDetected = 0;

  for (const p of parsed) {
    const dup = await db.transaction.findFirst({
      where: { userId, amount: p.amount, merchant: p.merchant, rawText: p.rawText ?? null },
    });
    if (dup) continue;
    const cardId = p.cardLast4 ? byLast4[p.cardLast4] ?? null : null;
    const txn = await db.transaction.create({
      data: {
        userId,
        cardId,
        amount: p.amount,
        merchant: p.merchant,
        category: p.category,
        date: p.date,
        source: p.source,
        rawText: p.rawText,
        cardLast4: p.cardLast4,
      },
    });
    txnsCreated++;

    // detect benefits
    const card = p.cardLast4 ? cards.find((c) => c.last4 === p.cardLast4) : undefined;
    if (!card) continue;
    const results = detectBenefits({
      amount: p.amount,
      merchant: p.merchant,
      category: p.category,
      date: p.date,
      cardBankName: card.bankName,
      cardName: card.cardName,
    });
    for (const r of results) {
      const exists = await db.benefit.findFirst({
        where: { transactionId: txn.id, type: r.benefitType },
      });
      if (exists) continue;
      const cardBenefit = await db.cardBenefit.findFirst({
        where: { cardId: card.id, type: r.benefitType },
      });
      await db.benefit.create({
        data: {
          userId,
          transactionId: txn.id,
          type: r.benefitType,
          cardBenefitId: cardBenefit?.id ?? null,
          status: "detected",
          coverageAmount: r.coverageAmount,
          reason: r.reason,
          confidence: r.confidence,
          expiresAt: r.expiresAt,
        },
      });
      benefitsDetected++;
    }
  }

  return { txnsCreated, benefitsDetected };
}

void inferCategory; // referenced for tree-shaking safety
