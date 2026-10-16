import { and, desc, eq, or } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { me, registrarOnly, requireAuth } from "../auth";
import { checkReceipt, ownerRef, requireConfigured, sendTx, toBytes32, waitForReceipt } from "../chain";
import { db } from "../db";
import { asyncHandler, HttpError, parse } from "../errors";
import { assertNotRegistered, decodeUpload, isUniqueViolation } from "../files";
import { requireTransferById, toTransfer, transferQuery } from "../queries";
import { documents, ownershipHistory, properties, transfers } from "../schema";

export const transfersRouter = Router();
transfersRouter.use(requireAuth);

const STATUSES = ["pending", "processing", "completed", "rejected"] as const;

transfersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = me(req);
    const status = STATUSES.find((s) => s === req.query.status);
    const filters = [];
    if (user.role === "owner") filters.push(or(eq(transfers.fromOwnerId, user.id), eq(transfers.toOwnerId, user.id))!);
    if (status) filters.push(eq(transfers.status, status));
    const rows = await transferQuery()
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(transfers.id));
    res.json(rows.map(toTransfer));
  }),
);

const decisionSchema = z.object({
  decision: z.enum(["approve", "reject"], "Choose approve or reject."),
  reason: z.string().trim().max(500).optional(),
  docType: z.string().optional(),
  fileName: z.string().optional(),
  fileType: z.string().optional(),
  fileBase64: z.string().optional(),
});

/** Marks a processing transfer as completed and moves ownership. Safe to call twice. */
async function completeTransfer(transferId: number) {
  await db().transaction(async (tx) => {
    const [t] = await tx
      .update(transfers)
      .set({ status: "completed", decidedAt: new Date() })
      .where(and(eq(transfers.id, transferId), eq(transfers.status, "processing")))
      .returning();
    if (!t) return;
    await tx.update(properties).set({ currentOwnerId: t.toOwnerId, status: "registered" }).where(eq(properties.id, t.propertyId));
    await tx.insert(ownershipHistory).values({
      propertyId: t.propertyId,
      ownerId: t.toOwnerId,
      deedDocumentId: t.deedDocumentId,
      txHash: t.txHash,
    });
    if (t.deedDocumentId) {
      await tx.update(documents).set({ chainStatus: "confirmed", chainError: null }).where(eq(documents.id, t.deedDocumentId));
    }
  });
}

/** The blockchain rejected the transfer: drop the unconfirmed deed and put the request back to pending. */
async function undoTransfer(transferId: number) {
  const [t] = await db().select().from(transfers).where(eq(transfers.id, transferId));
  if (!t) return;
  await db().update(transfers).set({ status: "pending", txHash: null, deedDocumentId: null, decidedAt: null }).where(eq(transfers.id, transferId));
  if (t.deedDocumentId) await db().delete(documents).where(eq(documents.id, t.deedDocumentId));
}

transfersRouter.patch(
  "/:id",
  registrarOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const t = await requireTransferById(id);
    const body = parse(decisionSchema, req.body);
    if (t.status !== "pending") throw new HttpError(409, `This request is already ${t.status}.`);

    if (body.decision === "reject") {
      if (!body.reason) throw new HttpError(422, "Give a reason for rejecting.", [{ path: "reason", message: "A reason is required." }]);
      await db().transaction(async (tx) => {
        await tx
          .update(transfers)
          .set({ status: "rejected", rejectionReason: body.reason, decidedAt: new Date() })
          .where(eq(transfers.id, id));
        await tx.update(properties).set({ status: "registered" }).where(eq(properties.id, t.propertyId));
      });
      res.json(await requireTransferById(id));
      return;
    }

    if (!body.fileName || !body.fileType || !body.fileBase64) {
      throw new HttpError(422, "The signed deed file is required to approve.", [
        { path: "fileBase64", message: "Attach the signed deed." },
      ]);
    }
    const file = decodeUpload({ fileName: body.fileName, fileType: body.fileType, fileBase64: body.fileBase64 });
    await assertNotRegistered(file.sha256);
    requireConfigured();

    // Claim the request so a second approval cannot send a second transaction.
    const [claimed] = await db()
      .update(transfers)
      .set({ status: "processing", decidedAt: new Date() })
      .where(and(eq(transfers.id, id), eq(transfers.status, "pending")))
      .returning({ id: transfers.id });
    if (!claimed) throw new HttpError(409, "This request is already being processed.");

    let hash: string;
    try {
      ({ hash } = await sendTx("transferProperty", [t.propertyCode, ownerRef(t.toOwnerId), toBytes32(file.sha256)]));
    } catch (err) {
      await db().update(transfers).set({ status: "pending", decidedAt: null }).where(eq(transfers.id, id));
      throw err;
    }

    try {
      const [deed] = await db()
        .insert(documents)
        .values({
          propertyId: t.propertyId,
          docType: "deed_of_assignment",
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.buffer.length,
          fileData: file.buffer,
          sha256: file.sha256,
          txHash: hash,
          uploadedBy: me(req).id,
        })
        .returning({ id: documents.id });
      await db().update(transfers).set({ deedDocumentId: deed.id, txHash: hash }).where(eq(transfers.id, id));
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "This exact document is already registered.");
      throw err;
    }

    const state = await waitForReceipt(hash);
    if (state === "confirmed") await completeTransfer(id);
    if (state === "failed") {
      await undoTransfer(id);
      throw new HttpError(502, "The blockchain rejected the transfer (the transaction was reverted). The request is still pending.");
    }
    res.json(await requireTransferById(id));
  }),
);

transfersRouter.post(
  "/:id/sync",
  registrarOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const t = await requireTransferById(id);
    if (t.status !== "processing") {
      res.json(t);
      return;
    }
    if (!t.txHash) {
      await undoTransfer(id);
      res.json(await requireTransferById(id));
      return;
    }
    const state = await checkReceipt(t.txHash);
    if (state === "confirmed") await completeTransfer(id);
    if (state === "failed") await undoTransfer(id);
    res.json(await requireTransferById(id));
  }),
);
