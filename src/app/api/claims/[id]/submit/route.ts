import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { randomUUID } from "crypto";

// POST /api/claims/[id]/submit
// Marks the claim as submitting, fires the Playwright automation service,
// and returns a sessionId the frontend uses to subscribe to socket.io updates.
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;

    const claim = await db.claim.findUnique({
      where: { id },
      include: {
        benefit: { include: { transaction: { include: { card: true } } } },
        documents: true,
      },
    });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }

    const fields = claim.formData ? (JSON.parse(claim.formData) as import("@/lib/types").ClaimFormField[]) : [];
    const documents = claim.documents.map((d) => ({
      dataPath: d.dataPath,
      fileType: d.fileType as "image" | "pdf" | "text",
      filename: d.filename,
    }));

    const sessionId = randomUUID();
    const portalUrl = claim.portalUrl ?? "http://localhost:3005";

    // mark submitting
    await db.claim.update({
      where: { id },
      data: { status: "submitting", submissionLog: JSON.stringify([{ step: 0, action: "Initiated", status: "pending", timestamp: new Date().toISOString() }]) },
    });
    await db.benefit.update({
      where: { id: claim.benefitId },
      data: { status: "claim_started" },
    });

    // Fire the Playwright service (port 3004) via the gateway (XTransformPort query).
    // Non-blocking: we kick it off and let socket.io stream progress.
    const runBody = { portalUrl, claimId: claim.id, fields, documents, sessionId };
    fetch("http://localhost:3004/api/run?XTransformPort=3004", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(runBody),
    }).catch((e) => {
      console.error("playwright kickoff failed", e);
    });

    return { sessionId, claimId: claim.id, portalUrl };
  });
}
