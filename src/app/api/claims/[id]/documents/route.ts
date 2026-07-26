import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { handle } from "@/lib/api";
import { saveUpload } from "@/lib/storage";

// POST /api/claims/[id]/documents  (multipart/form-data, field "file")
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;

    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "No file uploaded" } as const;
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    const saved = await saveUpload(claim.id, file.name, file.type, bytes);
    const doc = await db.document.create({
      data: {
        claimId: claim.id,
        filename: saved.filename,
        fileType: saved.fileType,
        mimeType: file.type || "application/octet-stream",
        dataPath: saved.dataPath,
        fileSize: saved.fileSize,
      },
    });
    return { document: doc };
  });
}

// DELETE /api/claims/[id]/documents?docId=...
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const user = await getCurrentUser();
    if (!user) return { ok: false, error: "Unauthorized" } as const;
    const { id } = await ctx.params;
    const url = new URL(req.url);
    const docId = url.searchParams.get("docId");
    if (!docId) return { ok: false, error: "docId required" } as const;
    const claim = await db.claim.findUnique({ where: { id } });
    if (!claim || claim.userId !== user.id) {
      return { ok: false, error: "Claim not found" } as const;
    }
    await db.document.delete({ where: { id: docId } }).catch(() => {});
    return { deleted: true };
  });
}
