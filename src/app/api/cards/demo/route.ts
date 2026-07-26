import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { seedDemoCards } from "@/lib/seed";

// POST /api/cards/demo — load the 5 preset Indian bank demo cards
export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    const result = await seedDemoCards(user.id);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Failed to load demo cards" },
      { status: 500 }
    );
  }
}
