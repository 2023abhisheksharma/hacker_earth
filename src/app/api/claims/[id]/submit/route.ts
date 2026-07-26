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
    const bankName = claim.portalBank ?? "Your Bank";
    const portalUrl = claim.portalUrl ?? "https://www.hdfcbank.com/";

    // Two URLs for the claim form demo:
    //  - playwrightFormUrl: absolute localhost:3005 URL for Playwright to
    //    navigate to internally (page.goto needs an absolute URL).
    //  - demoFormUrl: gateway-relative URL (/?XTransformPort=3005&...) for the
    //    user's browser to open — only the gateway (port 81) is reachable
    //    externally; localhost:3005 is internal to the sandbox.
    const query = `bank=${encodeURIComponent(bankName)}&bankUrl=${encodeURIComponent(portalUrl)}`;
    const playwrightFormUrl = `http://localhost:3005/?${query}`;
    const demoFormUrl = `/demo-form?${query}`;

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
    // Send the absolute localhost:3005 URL to Playwright (it navigates internally).
    const runBody = { portalUrl, demoFormUrl: playwrightFormUrl, bankName, claimId: claim.id, fields, documents, sessionId };
    
    // Asynchronously kick off Playwright with automatic retries if port 3004 is warming up
    (async () => {
      const url = "http://localhost:3004/api/run?XTransformPort=3004";
      for (let attempt = 1; attempt <= 6; attempt++) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(runBody),
          });
          if (res.ok) {
            console.log(`[submit] Playwright automation kicked off successfully (attempt ${attempt})`);
            return;
          }
          console.warn(`[submit] Playwright service returned HTTP ${res.status} (attempt ${attempt})`);
        } catch (e) {
          console.warn(`[submit] Playwright kickoff attempt ${attempt}/6 failed:`, (e as Error).message);
        }
        if (attempt < 6) await new Promise((r) => setTimeout(r, 1500));
      }
      console.error("[submit] All Playwright kickoff attempts failed!");
    })();

    return { sessionId, claimId: claim.id, portalUrl, demoFormUrl, bankName };
  });
}
