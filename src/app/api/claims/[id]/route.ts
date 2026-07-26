import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { prefillClaim } from "@/lib/prefill";

// GET /api/claims/[id] - claim detail
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;
    const claim = await db.claim.findUnique({
      where: { id },
      include: { benefit: { include: { transaction: { include: { card: true } } } }, documents: true },
    });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }
    return { claim };
  });
}

// PATCH /api/claims/[id] - update form data
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;
    const body = await req.json().catch(() => ({}));
    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }
    const data: Record<string, unknown> = {};
    if (body.fields) data.formData = JSON.stringify(body.fields);
    if (body.status) data.status = String(body.status);
    const updated = await db.claim.update({
      where: { id },
      data,
      include: { benefit: { include: { transaction: { include: { card: true } } } }, documents: true },
    });
    return { claim: updated };
  });
}

// Re-generate prefill for a claim (useful if user info changed)
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;
    const claim = await db.claim.findUnique({
      where: { id },
      include: { benefit: { include: { transaction: { include: { card: true } } } } },
    });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }
    const body = await req.json().catch(() => ({}));
    void body;
    const txn = claim.benefit.transaction;
    const card = txn.card;
    const prefill = prefillClaim({
      benefitType: claim.benefit.type as import("@/lib/types").BenefitType,
      bankName: card?.bankName ?? "HDFC Bank",
      cardName: card?.cardName ?? "Credit Card",
      cardLast4: txn.cardLast4 ?? card?.last4 ?? "",
      transaction: { amount: txn.amount, merchant: txn.merchant, date: txn.date, category: txn.category },
      user: { name: user.name ?? undefined, email: user.email, phone: user.phone ?? undefined },
      coverageAmount: claim.benefit.coverageAmount,
    });
    const updated = await db.claim.update({
      where: { id },
      data: { formData: JSON.stringify(prefill.fields) },
      include: { benefit: { include: { transaction: { include: { card: true } } } }, documents: true },
    });
    return { claim: updated, prefill };
  });
}
