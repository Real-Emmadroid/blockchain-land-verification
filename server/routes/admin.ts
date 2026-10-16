import { desc, eq, sql } from "drizzle-orm";
import { Router } from "express";
import { registrarOnly, requireAuth } from "../auth";
import { chainStatus, ensureContract, requireConfigured } from "../chain";
import { db } from "../db";
import { asyncHandler } from "../errors";
import { documents, properties, transfers, users, verificationLog } from "../schema";

export const reportsRouter = Router();
export const chainRouter = Router();
reportsRouter.use(requireAuth, registrarOnly);
chainRouter.use(requireAuth, registrarOnly);

async function countBy<T extends string>(table: any, column: any, keys: readonly T[]) {
  const rows = (await db()
    .select({ key: column, n: sql<number>`count(*)::int` })
    .from(table)
    .groupBy(column)) as { key: T; n: number }[];
  const out = Object.fromEntries(keys.map((k) => [k, 0])) as Record<T, number>;
  for (const r of rows) if (r.key in out) out[r.key] = Number(r.n);
  return out;
}

const count = async (table: any, where?: any) => {
  const q = db().select({ n: sql<number>`count(*)::int` }).from(table);
  const [row] = await (where ? q.where(where) : q);
  return Number(row.n);
};

reportsRouter.get(
  "/overview",
  asyncHandler(async (_req, res) => {
    const [propertyCount, documentCount, ownerCount, revokedCount, byChainStatus, transferCounts, verifications, recent] =
      await Promise.all([
        count(properties),
        count(documents),
        count(users, eq(users.role, "owner")),
        count(documents, eq(documents.revoked, true)),
        countBy(documents, documents.chainStatus, ["pending", "confirmed", "failed"] as const),
        countBy(transfers, transfers.status, ["pending", "processing", "completed", "rejected"] as const),
        countBy(verificationLog, verificationLog.result, ["authentic", "revoked", "not_found"] as const),
        db().select().from(verificationLog).where(eq(verificationLog.result, "not_found")).orderBy(desc(verificationLog.id)).limit(10),
      ]);

    res.json({
      totals: { properties: propertyCount, documents: documentCount, owners: ownerCount, revokedDocuments: revokedCount },
      byChainStatus,
      transfers: transferCounts,
      verifications,
      recentNotFound: recent.map((r) => ({ id: r.id, sha256: r.sha256, result: r.result, createdAt: r.createdAt.toISOString() })),
    });
  }),
);

chainRouter.get(
  "/status",
  asyncHandler(async (_req, res) => {
    res.json(await chainStatus());
  }),
);

chainRouter.post(
  "/deploy",
  asyncHandler(async (_req, res) => {
    requireConfigured();
    await ensureContract();
    res.json(await chainStatus());
  }),
);
