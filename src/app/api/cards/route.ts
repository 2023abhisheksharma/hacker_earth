import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { cards: [] };
    const cards = await db.card.findMany({
      where: { userId: user.id },
      include: { benefits: true },
      orderBy: { createdAt: "desc" },
    });
    return { cards };
  });
}
