// Local document storage. Files land in /home/z/my-project/uploads/<claimId>/.
// We never persist bank credentials - only claim documents the user uploads.

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const UPLOAD_ROOT = "/home/z/my-project/uploads";

export async function ensureDir(p: string) {
  await fs.mkdir(p, { recursive: true });
}

export function classifyFile(mimeType: string, filename: string): "image" | "pdf" | "text" {
  const mt = (mimeType ?? "").toLowerCase();
  const ext = path.extname(filename).toLowerCase();
  if (mt.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"].includes(ext)) return "image";
  if (mt === "application/pdf" || ext === ".pdf") return "pdf";
  return "text";
}

export async function saveUpload(
  claimId: string,
  filename: string,
  mimeType: string,
  bytes: Buffer
): Promise<{ dataPath: string; fileType: "image" | "pdf" | "text"; fileSize: number; filename: string }> {
  const dir = path.join(UPLOAD_ROOT, claimId);
  await ensureDir(dir);
  const safeName = `${crypto.randomBytes(4).toString("hex")}-${filename.replace(/[^\w.-]/g, "_")}`;
  const full = path.join(dir, safeName);
  await fs.writeFile(full, bytes);
  const fileType = classifyFile(mimeType, filename);
  return {
    dataPath: path.relative(UPLOAD_ROOT, full),
    fileType,
    fileSize: bytes.length,
    filename,
  };
}

export function uploadAbsolutePath(dataPath: string): string {
  return path.join(UPLOAD_ROOT, dataPath);
}

export async function readUpload(dataPath: string): Promise<{ bytes: Buffer; exists: boolean }> {
  try {
    const bytes = await fs.readFile(uploadAbsolutePath(dataPath));
    return { bytes, exists: true };
  } catch {
    return { bytes: Buffer.alloc(0), exists: false };
  }
}
