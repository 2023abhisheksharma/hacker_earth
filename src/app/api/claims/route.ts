import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prefillClaim } from "@/lib/prefill";
import { BENEFIT_TYPES, BANK_PORTALS } from "@/lib/constants";

// GET /api/claims - list user's claims
export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { claims: [] };
    const claims = await db.claim.findMany({
      where: { userId: user.id },
      include: { benefit: { include: { transaction: { include: { card: true } } } }, documents: true },
      orderBy: { createdAt: "desc" },
    });
    return { claims };
  });
}

// POST /api/claims - create a draft claim from a benefit (pre-filled)
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;

    const body = await req.json().catch(() => ({}));
    const benefitId = String(body.benefitId ?? "");
    if (!benefitId) return { ok: false, error: "benefitId required" } as const;

    const benefit = await db.benefit.findUnique({
      where: { id: benefitId },
      include: { transaction: { include: { card: true } }, cardBenefit: true },
    });
    if (!benefit || benefit.userId !== user.id) {
      return { ok: false, error: "Benefit not found" } as const;
    }

    const txn = benefit.transaction;
    const card = txn.card;
    const prefill = prefillClaim({
      benefitType: benefit.type as import("@/lib/types").BenefitType,
      bankName: card?.bankName ?? "HDFC Bank",
      cardName: card?.cardName ?? "Credit Card",
      cardLast4: txn.cardLast4 ?? card?.last4 ?? "",
      transaction: {
        amount: txn.amount,
        merchant: txn.merchant,
        date: txn.date,
        category: txn.category,
      },
      user: { name: user.name ?? undefined, email: user.email, phone: user.phone ?? undefined },
      coverageAmount: benefit.coverageAmount,
    });

    const portal = BANK_PORTALS[card?.bankName ?? "HDFC Bank"];
    const claim = await db.claim.create({
      data: {
        userId: user.id,
        benefitId: benefit.id,
        status: "draft",
        formData: JSON.stringify(prefill.fields),
        portalUrl: portal?.url ?? "http://localhost:3005",
        portalBank: card?.bankName ?? "HDFC Bank",
      },
      include: { benefit: { include: { transaction: { include: { card: true } } } }, documents: true },
    });

    await db.benefit.update({
      where: { id: benefit.id },
      data: { status: "claim_started" },
    });

    return { claim, prefill };
  });
}

void BENEFIT_TYPES;
