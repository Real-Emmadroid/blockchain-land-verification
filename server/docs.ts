import { asc, eq } from "drizzle-orm";
import { chainError, checkReceipt, ownerRef, sendTx, toBytes32, waitForReceipt, type ReceiptState } from "./chain";
import { db } from "./db";
import { documents, ownershipHistory } from "./schema";
import { requireDocumentById } from "./queries";

async function applyReceipt(docId: number, state: ReceiptState) {
  if (state === "confirmed") {
    await db().update(documents).set({ chainStatus: "confirmed", chainError: null }).where(eq(documents.id, docId));
  } else if (state === "failed") {
    await db()
      .update(documents)
      .set({ chainStatus: "failed", chainError: "The transaction was reverted by the blockchain." })
      .where(eq(documents.id, docId));
  }
}

type PushPlan = { method: "registerProperty" | "registerDocument"; args: unknown[] };

/**
 * Sends a document's registration transaction and waits for one confirmation.
 * Never throws: failures are stored on the document so the registrar can retry.
 */
export async function pushDocument(docId: number, plan: PushPlan) {
  try {
    const { hash } = await sendTx(plan.method, plan.args);
    await db().update(documents).set({ txHash: hash, chainStatus: "pending", chainError: null }).where(eq(documents.id, docId));
    await db().update(ownershipHistory).set({ txHash: hash }).where(eq(ownershipHistory.deedDocumentId, docId));
    await applyReceipt(docId, await waitForReceipt(hash));
  } catch (err) {
    await db()
      .update(documents)
      .set({ chainStatus: "failed", chainError: chainError(err).message })
      .where(eq(documents.id, docId));
  }
}

/** Builds the right contract call for a stored document (founding document vs later document). */
export async function planFor(doc: { id: number; propertyId: number; propertyCode: string; sha256: string; docType: string }): Promise<PushPlan> {
  const [first] = await db()
    .select()
    .from(ownershipHistory)
    .where(eq(ownershipHistory.propertyId, doc.propertyId))
    .orderBy(asc(ownershipHistory.id))
    .limit(1);
  if (first && first.deedDocumentId === doc.id) {
    return {
      method: "registerProperty",
      args: [doc.propertyCode, ownerRef(first.ownerId), toBytes32(doc.sha256), doc.docType],
    };
  }
  return { method: "registerDocument", args: [doc.propertyCode, toBytes32(doc.sha256), doc.docType] };
}

/** Finishes or retries a document's chain registration. */
export async function syncDocument(docId: number) {
  const doc = await requireDocumentById(docId);
  if (doc.chainStatus === "confirmed") return doc;
  if (doc.chainStatus === "pending" && doc.txHash) {
    await applyReceipt(doc.id, await checkReceipt(doc.txHash));
  } else {
    await pushDocument(doc.id, await planFor(doc));
  }
  return requireDocumentById(docId);
}
