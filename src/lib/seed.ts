// Seed + card management logic.
// Split into: seedDemoCards (creates the 5 preset cards with benefits),
// addCard (manual single-card add), seedDemoTransactions (SMS -> txns -> detect).

import { db } from "./db";
import { CARD_CATALOG, type CatalogCard } from "./benefits/catalog";
import { detectBenefits } from "./benefits/detector";
import { parseSmsBatch } from "./parser/sms-parser";
import type { BenefitType, CardNetwork, TxnCategory } from "./types";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtDate(d: Date): string {
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

export interface DemoCard {
  bankName: string;
  cardName: string;
  cardType: "credit" | "debit";
  network: CardNetwork;
  last4: string;
}

export const DEMO_CARDS: DemoCard[] = [
  { bankName: "HDFC Bank", cardName: "Infinia Credit Card", cardType: "credit", network: "Visa", last4: "8841" },
  { bankName: "Axis Bank", cardName: "Magnus Credit Card", cardType: "credit", network: "Mastercard", last4: "2293" },
  { bankName: "ICICI Bank", cardName: "Amazon Pay Credit Card", cardType: "credit", network: "Visa", last4: "5512" },
  { bankName: "SBI Card", cardName: "Elite Credit Card", cardType: "credit", network: "Visa", last4: "7741" },
  { bankName: "Kotak Mahindra", cardName: "Zen Credit Card", cardType: "credit", network: "Visa", last4: "3398" },
];

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

// Create a card + its benefit entitlements from the catalog (idempotent by last4).
export async function createCardWithBenefits(userId: string, dc: DemoCard): Promise<string> {
  const existing = await db.card.findFirst({ where: { userId, last4: dc.last4 } });
  if (existing) return existing.id;
  const catalog = CARD_CATALOG.find(
    (c) => c.bankName === dc.bankName && c.cardName === dc.cardName
  );
  const card = await db.card.create({
    data: {
      userId,
      bankName: dc.bankName,
      cardName: dc.cardName,
      cardType: dc.cardType,
      network: dc.network,
      last4: dc.last4,
      benefits: catalog
        ? {
            create: catalog.benefits.map((b) => ({
              type: b.type,
              title: b.title,
              description: b.description,
              coverageLimit: b.coverageLimit,
              windowDays: b.windowDays,
              conditions: JSON.stringify(b.conditions),
            })),
          }
        : undefined,
    },
  });
  return card.id;
}

// Load all 5 preset demo cards (idempotent).
export async function seedDemoCards(userId: string) {
  let added = 0;
  for (const dc of DEMO_CARDS) {
    const before = await db.card.count({ where: { userId, last4: dc.last4 } });
    await createCardWithBenefits(userId, dc);
    if (before === 0) added++;
  }
  return { added, total: DEMO_CARDS.length };
}

// Load sample SMS transactions + run detection (idempotent).
export async function seedDemoTransactions(userId: string) {
  const cards = await db.card.findMany({ where: { userId } });
  const byLast4: Record<string, string> = {};
  for (const c of cards) byLast4[c.last4] = c.id;

  const parsed = parseSmsBatch(buildSampleSms());
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

    const card = p.cardLast4 ? cards.find((c) => c.last4 === p.cardLast4) : undefined;
    if (!card) continue;
    const results = detectBenefits({
      amount: p.amount,
      merchant: p.merchant,
      category: p.category as TxnCategory,
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
        where: { cardId: card.id, type: r.benefitType as BenefitType },
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

// Backward-compatible full seed (cards + transactions).
export async function seedUser(userId: string) {
  await seedDemoCards(userId);
  const t = await seedDemoTransactions(userId);
  return { cards: DEMO_CARDS.length, ...t };
}

// Manual transaction ingestion (SMS/email parser endpoint).
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

    const card = p.cardLast4 ? cards.find((c) => c.last4 === p.cardLast4) : undefined;
    if (!card) continue;
    const results = detectBenefits({
      amount: p.amount,
      merchant: p.merchant,
      category: p.category as TxnCategory,
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
        where: { cardId: card.id, type: r.benefitType as BenefitType },
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

export function findCatalogCard(bankName: string, cardName: string): CatalogCard | undefined {
  return CARD_CATALOG.find((c) => c.bankName === bankName && c.cardName === cardName);
}
