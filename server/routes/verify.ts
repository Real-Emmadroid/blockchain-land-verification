import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { registrarOnly, requireAuth } from "../auth";
import { chainError, getReadContract, toBytes32 } from "../chain";
import { db } from "../db";
import { asyncHandler, parse } from "../errors";
import { explorerUrl } from "../queries";
import { documents, verificationLog, type VerifyResult } from "../schema";

export const verifyRouter = Router();
export const verificationsRouter = Router();

const verifyLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  message: { error: "Too many checks in a short time. Please wait a minute and try again." },
});

const verifySchema = z.object({
  sha256: z
    .string()
    .trim()
    .transform((s) => s.toLowerCase().replace(/^0x/, ""))
    .pipe(z.string().regex(/^[a-f0-9]{64}$/, "Enter a 64-character hexadecimal fingerprint.")),
});

const toIso = (seconds: bigint) => new Date(Number(seconds) * 1000).toISOString();

// PUBLIC. The caller is not recorded: only the fingerprint and the result are logged.
verifyRouter.post(
  "/",
  verifyLimiter,
  asyncHandler(async (req, res) => {
    const { sha256 } = parse(verifySchema, req.body);

    let r: { exists: boolean; revoked: boolean; propertyId: string; docType: string; registeredAt: bigint; revokedAt: bigint; revokeReason: string };
    try {
      const contract = await getReadContract();
      r = await contract.verifyDocument(toBytes32(sha256));
    } catch (err) {
      throw chainError(err);
    }

    const result: VerifyResult = !r.exists ? "not_found" : r.revoked ? "revoked" : "authentic";
    const [known] = r.exists
      ? await db().select({ txHash: documents.txHash }).from(documents).where(eq(documents.sha256, sha256)).limit(1)
      : [];
    await db().insert(verificationLog).values({ sha256, result });

    res.json({
      result,
      sha256,
      propertyCode: r.exists ? r.propertyId : null,
      docType: r.exists ? r.docType : null,
      registeredAt: r.exists ? toIso(r.registeredAt) : null,
      revokedAt: r.exists && r.revoked ? toIso(r.revokedAt) : null,
      revokeReason: r.exists && r.revoked ? r.revokeReason : null,
      txHash: known?.txHash ?? null,
      explorerUrl: explorerUrl(known?.txHash ?? null),
    });
  }),
);

verificationsRouter.get(
  "/",
  requireAuth,
  registrarOnly,
  asyncHandler(async (req, res) => {
    const result = (["authentic", "revoked", "not_found"] as const).find((v) => v === req.query.result);
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const q = db().select().from(verificationLog);
    const rows = await (result ? q.where(eq(verificationLog.result, result)) : q).orderBy(desc(verificationLog.id)).limit(limit);
    res.json(rows.map((r) => ({ id: r.id, sha256: r.sha256, result: r.result, createdAt: r.createdAt.toISOString() })));
  }),
);
