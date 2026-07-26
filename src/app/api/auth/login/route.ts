import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { createSession, setSessionCookie } from "@/lib/auth";

// Login: email only. NO passwords, NO bank credentials stored.
// A session token is issued as an httpOnly cookie on the response.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ ok: false, error: "A valid email is required" }, { status: 400 });
    }
    const name = body.name ? String(body.name).trim() : undefined;
    const phone = body.phone ? String(body.phone).trim() : undefined;

    let user = await db.user.findUnique({ where: { email } });
    if (!user) {
      user = await db.user.create({ data: { email, name, phone } });
    } else if ((name || phone) && (!user.name || !user.phone)) {
      user = await db.user.update({
        where: { id: user.id },
        data: { name: name ?? user.name, phone: phone ?? user.phone },
      });
    }

    const token = await createSession(user.id);
    const res = NextResponse.json({
      ok: true,
      data: { user: { id: user.id, email: user.email, name: user.name, phone: user.phone } },
    });
    setSessionCookie(res, token);
    return res;
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Login failed" },
      { status: 500 }
    );
  }
}
