import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { clearSessionCookie, getSessionToken } from "@/lib/auth";

export async function POST() {
  try {
    const token = await getSessionToken();
    if (token) {
      await db.session.deleteMany({ where: { token } }).catch(() => {});
    }
    const res = NextResponse.json({ ok: true, data: { loggedOut: true } });
    clearSessionCookie(res);
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Logout failed" },
      { status: 500 }
    );
  }
}
