// API helpers: typed JSON responses + error handling.

import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ ok: false, error: message, details }, { status });
}

export function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function handle<T>(
  fn: () => Promise<T>
): Promise<NextResponse> {
  try {
    const result = await fn();
    if (result instanceof NextResponse) return result;
    return ok(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Internal error";
    if (msg === "UNAUTHORIZED") return unauthorized();
    return fail(msg, 500);
  }
}
