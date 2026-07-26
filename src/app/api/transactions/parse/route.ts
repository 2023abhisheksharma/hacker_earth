import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { ingestParsed } from "@/lib/seed";
import { parseSmsBatch } from "@/lib/parser/sms-parser";
import { parseEmail } from "@/lib/parser/email-parser";

// POST /api/transactions/parse
// body: { source: "sms" | "email", text: string, subject?: string, from?: string, receivedAt?: string }
// Parses pasted SMS / email content, persists transactions, runs detection.
export async function POST(req: Request) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;

    const body = await req.json().catch(() => ({}));
    const source = String(body.source ?? "sms");
    const text = String(body.text ?? "");

    let parsed: import("@/lib/types").ParsedTransaction[] = [];
    if (source === "email") {
      parsed = parseEmail({
        subject: body.subject,
        from: body.from,
        body: text,
        receivedAt: body.receivedAt,
      });
    } else {
      parsed = parseSmsBatch(text);
    }

    const result = await ingestParsed(user.id, parsed);
    return { parsed: parsed.length, ...result };
  });
}
