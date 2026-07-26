"use client";

// Tiny fetch wrapper for the frontend. Returns parsed {ok, data} or throws.

export async function api<T = unknown>(
  path: string,
  opts?: RequestInit & { query?: Record<string, string> }
): Promise<T> {
  const { query, ...init } = opts ?? {};
  let url = path;
  if (query) {
    const qs = new URLSearchParams(query).toString();
    url += (path.includes("?") ? "&" : "?") + qs;
  }
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });
  const json = await res.json().catch(() => ({ ok: false, error: "Invalid response" }));
  if (!res.ok || !json.ok) {
    throw new Error(json.error || `Request failed (${res.status})`);
  }
  return json.data as T;
}

export function apiUpload(path: string, formData: FormData) {
  return fetch(path, { method: "POST", credentials: "include", body: formData }).then((r) =>
    r.json()
  );
}

export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function timeAgo(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}
