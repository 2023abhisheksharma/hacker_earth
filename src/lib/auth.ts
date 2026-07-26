// Session-based authentication. NO bank credentials are ever stored.
// A user authenticates to our app with email (+ optional name/phone) and
// receives an opaque session token. Bank portal login happens live inside
// the Playwright browser session and is discarded immediately after.

import { db } from "./db";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import type { NextResponse } from "next/server";

export const SESSION_COOKIE = "cba_session";
const SESSION_TTL_DAYS = 7;

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
}

export async function createSession(userId: string): Promise<string> {
  const token = newSessionToken();
  const expiresAt = sessionExpiry();
  await db.session.create({ data: { userId, token, expiresAt } });
  return token;
}

// Set the session cookie on a NextResponse (correct pattern for Route Handlers).
export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: sessionExpiry(),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
}

// Reads are fine via next/headers cookies().
export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getCurrentUser() {
  const token = await getSessionToken();
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
