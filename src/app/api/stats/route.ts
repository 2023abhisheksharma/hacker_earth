import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import type { DashboardStats } from "@/lib/types";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) {
      const empty: DashboardStats = {
        totalBenefits: 0,
        unclaimedBenefits: 0,
        unclaimedValue: 0,
        claimsFiled: 0,
        savingsUnlocked: 0,
        approvalRate: 0,
      };
      return { stats: empty };
    }

    const benefits = await db.benefit.findMany({ where: { userId: user.id } });
    const claims = await db.claim.findMany({ where: { userId: user.id } });

    const unclaimed = benefits.filter(
      (b) => !["submitted", "approved", "rejected", "expired"].includes(b.status)
    );
    const filed = claims.filter((c) => ["submitted", "under_review", "approved"].includes(c.status));
    const approved = claims.filter((c) => c.status === "approved");
    const savings = approved.reduce((s, c) => {
      const b = benefits.find((x) => x.id === c.benefitId);
      return s + (b?.coverageAmount ?? 0);
    }, 0);

    const stats: DashboardStats = {
      totalBenefits: benefits.length,
      unclaimedBenefits: unclaimed.length,
      unclaimedValue: unclaimed.reduce((s, b) => s + b.coverageAmount, 0),
      claimsFiled: filed.length,
      savingsUnlocked: savings,
      approvalRate: filed.length ? Math.round((approved.length / filed.length) * 100) : 0,
    };
    return { stats };
  });
}
