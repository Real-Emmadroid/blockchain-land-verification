import { eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { me, registrarOnly, requireAuth } from "../auth";
import { sendTx, toBytes32, waitForReceipt } from "../chain";
import { db } from "../db";
import { syncDocument } from "../docs";
import { asyncHandler, HttpError, parse } from "../errors";
import { assertCanView, requireDocumentById } from "../queries";
import { documents } from "../schema";

export const documentsRouter = Router();
documentsRouter.use(requireAuth);

documentsRouter.get(
  "/:id/file",
  asyncHandler(async (req, res) => {
    const doc = await requireDocumentById(Number(req.params.id));
    await assertCanView(me(req), doc.propertyId);
    const [row] = await db()
      .select({ fileData: documents.fileData, fileName: documents.fileName, fileType: documents.fileType })
      .from(documents)
      .where(eq(documents.id, doc.id));
    res.json({ fileName: row.fileName, fileType: row.fileType, fileBase64: Buffer.from(row.fileData).toString("base64") });
  }),
);

const revokeSchema = z.object({ reason: z.string().trim().min(3, "Give a reason of at least 3 characters.").max(300) });

documentsRouter.post(
  "/:id/revoke",
  registrarOnly,
  asyncHandler(async (req, res) => {
    const doc = await requireDocumentById(Number(req.params.id));
    const { reason } = parse(revokeSchema, req.body);
    if (doc.revoked) throw new HttpError(409, "This document has already been revoked.");

    const { hash } = await sendTx("revokeDocument", [toBytes32(doc.sha256), reason]);
    if ((await waitForReceipt(hash)) === "failed") {
      throw new HttpError(502, "The blockchain rejected the revocation (the transaction was reverted).");
    }
    await db().update(documents).set({ revoked: true, revokeReason: reason }).where(eq(documents.id, doc.id));
    res.json(await requireDocumentById(doc.id));
  }),
);

documentsRouter.post(
  "/:id/sync",
  registrarOnly,
  asyncHandler(async (req, res) => {
    res.json(await syncDocument(Number(req.params.id)));
  }),
);
