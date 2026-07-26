import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { seedDemoTransactions } from "@/lib/seed";

// POST /api/seed/transactions — load sample SMS transactions + run detection
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const result = await seedDemoTransactions(user.id);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load transactions" },
      { status: 500 }
    );
  }
}
