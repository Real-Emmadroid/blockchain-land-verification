import { createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { HttpError } from "./errors";
import { documents } from "./schema";

const MAX_BYTES = 4 * 1024 * 1024;
const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

export type Upload = { fileName: string; fileType: string; fileBase64: string };
export type DecodedUpload = { fileName: string; fileType: string; buffer: Buffer; sha256: string };

const fail = (path: string, message: string) => new HttpError(422, message, [{ path, message }]);

/** Validates an upload and computes its SHA-256 on the server. Never trusts a client hash. */
export function decodeUpload(input: Upload): DecodedUpload {
  const fileName = input.fileName.trim().replace(/[\\/]/g, "_");
  const ext = fileName.includes(".") ? fileName.split(".").pop()!.toLowerCase() : "";
  if (!TYPES[ext]) {
    throw fail("fileName", "Only PDF, PNG, JPG and JPEG files are accepted.");
  }

  const raw = input.fileBase64.replace(/^data:[^;]*;base64,/, "").replace(/\s+/g, "");
  if (!raw || raw.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(raw)) {
    throw fail("fileBase64", "The file could not be read. Please choose it again.");
  }
  const buffer = Buffer.from(raw, "base64");
  if (buffer.length === 0) throw fail("fileBase64", "The file is empty.");
  if (buffer.length > MAX_BYTES) throw fail("fileBase64", "The file is larger than 4 MB.");

  return {
    fileName,
    fileType: TYPES[ext],
    buffer,
    sha256: createHash("sha256").update(buffer).digest("hex"),
  };
}

export async function assertNotRegistered(sha256: string) {
  const [dup] = await db().select({ id: documents.id }).from(documents).where(eq(documents.sha256, sha256)).limit(1);
  if (dup) throw new HttpError(409, "This exact document is already registered.");
}

export const isUniqueViolation = (err: unknown) => {
  const e = err as { code?: string; cause?: { code?: string } };
  return e?.code === "23505" || e?.cause?.code === "23505";
};
