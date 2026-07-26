import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";

export async function GET() {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { transactions: [] };
    const transactions = await db.transaction.findMany({
      where: { userId: user.id },
      include: { card: true },
      orderBy: { date: "desc" },
    });
    return { transactions };
  });
}
