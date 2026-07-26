import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { benefits: [] };
    const benefits = await db.benefit.findMany({
      where: { userId: user.id },
      include: { transaction: { include: { card: true } }, claims: true, cardBenefit: true },
      orderBy: { detectedAt: "desc" },
    });
    return { benefits };
  });
}
