import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { createCardWithBenefits, findCatalogCard } from "@/lib/seed";
import { INDIAN_BANKS, NETWORKS } from "@/lib/constants";

// POST /api/cards/add — manually add a card
// body: { bankName, cardName, last4, network?, cardType? }
export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const bankName = String(body.bankName ?? "").trim();
    const cardName = String(body.cardName ?? "").trim();
    const last4 = String(body.last4 ?? "").trim();
    const network = String(body.network ?? "Visa") as (typeof NETWORKS)[number];
    const cardType = body.cardType === "debit" ? "debit" : "credit";

    if (!bankName || !cardName || !last4) {
      return NextResponse.json({ ok: false, error: "bankName, cardName and last4 are required" }, { status: 400 });
    }
    if (!/^\d{4}$/.test(last4)) {
      return NextResponse.json({ ok: false, error: "last4 must be exactly 4 digits" }, { status: 400 });
    }
    if (!INDIAN_BANKS.includes(bankName as never)) {
      return NextResponse.json({ ok: false, error: "Unsupported bank" }, { status: 400 });
    }

    const dup = await db.card.findFirst({ where: { userId: user.id, last4 } });
    if (dup) {
      return NextResponse.json({ ok: false, error: "A card ending in " + last4 + " already exists" }, { status: 409 });
    }

    const cardId = await createCardWithBenefits(user.id, { bankName, cardName, last4, network, cardType });
    const card = await db.card.findUnique({ where: { id: cardId }, include: { benefits: true } });
    const inCatalog = !!findCatalogCard(bankName, cardName);
    return NextResponse.json({
      ok: true,
      data: { card, inCatalog, benefitsLoaded: card?.benefits.length ?? 0 },
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to add card" },
      { status: 500 }
    );
  }
}
