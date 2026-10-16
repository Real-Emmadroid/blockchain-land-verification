import { and, desc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";
import { documents, ownershipHistory, properties, transfers, users } from "./schema";

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

// ---------- Users ----------
export type UserRow = typeof users.$inferSelect;
export const toUser = (u: UserRow) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  identifier: u.identifier,
  isActive: u.isActive,
  createdAt: iso(u.createdAt)!,
});

// ---------- Properties ----------
const ownerAlias = alias(users, "owner");

const propertyCols = {
  id: properties.id,
  propertyCode: properties.propertyCode,
  title: properties.title,
  propertyType: properties.propertyType,
  location: properties.location,
  sizeSqm: properties.sizeSqm,
  description: properties.description,
  currentOwnerId: properties.currentOwnerId,
  currentOwnerName: ownerAlias.name,
  status: properties.status,
  documentCount: sql<number>`(select count(*)::int from documents d where d.property_id = ${properties.id})`,
  createdAt: properties.createdAt,
};

type PropertyRow = {
  id: number;
  propertyCode: string;
  title: string;
  propertyType: "land" | "building";
  location: string;
  sizeSqm: string | null;
  description: string;
  currentOwnerId: number;
  currentOwnerName: string;
  status: "registered" | "transfer_pending";
  documentCount: number;
  createdAt: Date;
};

export const toProperty = (p: PropertyRow) => ({
  id: p.id,
  propertyCode: p.propertyCode,
  title: p.title,
  propertyType: p.propertyType,
  location: p.location,
  sizeSqm: p.sizeSqm === null ? null : Number(p.sizeSqm),
  description: p.description,
  currentOwnerId: p.currentOwnerId,
  currentOwnerName: p.currentOwnerName,
  status: p.status,
  documentCount: Number(p.documentCount),
  createdAt: iso(p.createdAt)!,
});

export function propertyQuery() {
  return db()
    .select(propertyCols)
    .from(properties)
    .innerJoin(ownerAlias, eq(ownerAlias.id, properties.currentOwnerId));
}

export async function getPropertyById(id: number) {
  const [row] = await propertyQuery().where(eq(properties.id, id)).limit(1);
  return row ? toProperty(row) : null;
}

export async function requirePropertyById(id: number) {
  if (!Number.isInteger(id)) throw new HttpError(404, "Property not found.");
  const p = await getPropertyById(id);
  if (!p) throw new HttpError(404, "Property not found.");
  return p;
}

// ---------- Documents ----------
const uploader = alias(users, "uploader");

export const documentCols = {
  id: documents.id,
  propertyId: documents.propertyId,
  propertyCode: properties.propertyCode,
  docType: documents.docType,
  fileName: documents.fileName,
  fileType: documents.fileType,
  fileSize: documents.fileSize,
  sha256: documents.sha256,
  chainStatus: documents.chainStatus,
  txHash: documents.txHash,
  chainError: documents.chainError,
  revoked: documents.revoked,
  revokeReason: documents.revokeReason,
  uploadedByName: uploader.name,
  createdAt: documents.createdAt,
};

export type DocumentRow = {
  id: number;
  propertyId: number;
  propertyCode: string;
  docType: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  sha256: string;
  chainStatus: string;
  txHash: string | null;
  chainError: string | null;
  revoked: boolean;
  revokeReason: string | null;
  uploadedByName: string;
  createdAt: Date;
};

export const toDocument = (d: DocumentRow) => ({ ...d, createdAt: iso(d.createdAt)! });

export function documentQuery() {
  return db()
    .select(documentCols)
    .from(documents)
    .innerJoin(properties, eq(properties.id, documents.propertyId))
    .innerJoin(uploader, eq(uploader.id, documents.uploadedBy));
}

export async function getDocumentById(id: number) {
  if (!Number.isInteger(id)) return null;
  const [row] = await documentQuery().where(eq(documents.id, id)).limit(1);
  return row ? toDocument(row) : null;
}

export async function requireDocumentById(id: number) {
  const d = await getDocumentById(id);
  if (!d) throw new HttpError(404, "Document not found.");
  return d;
}

// ---------- Ownership ----------
export async function wasOwner(propertyId: number, userId: number) {
  const [row] = await db()
    .select({ id: ownershipHistory.id })
    .from(ownershipHistory)
    .where(and(eq(ownershipHistory.propertyId, propertyId), eq(ownershipHistory.ownerId, userId)))
    .limit(1);
  return Boolean(row);
}

/** Owners may view a property they own now or owned before. Registrars may view all. */
export async function assertCanView(user: { id: number; role: string }, propertyId: number) {
  if (user.role === "registrar") return;
  if (!(await wasOwner(propertyId, user.id))) throw new HttpError(403, "You do not have access to this property.");
}

// ---------- Transfers ----------
const fromUser = alias(users, "from_user");
const toUserAlias = alias(users, "to_user");

export const transferCols = {
  id: transfers.id,
  propertyId: transfers.propertyId,
  propertyCode: properties.propertyCode,
  propertyTitle: properties.title,
  fromOwnerId: transfers.fromOwnerId,
  fromOwnerName: fromUser.name,
  toOwnerId: transfers.toOwnerId,
  toOwnerName: toUserAlias.name,
  note: transfers.note,
  status: transfers.status,
  rejectionReason: transfers.rejectionReason,
  deedDocumentId: transfers.deedDocumentId,
  txHash: transfers.txHash,
  createdAt: transfers.createdAt,
  decidedAt: transfers.decidedAt,
};

export const toTransfer = <T extends { createdAt: Date; decidedAt: Date | null }>(t: T) => ({
  ...t,
  createdAt: iso(t.createdAt)!,
  decidedAt: iso(t.decidedAt),
});

export function transferQuery() {
  return db()
    .select(transferCols)
    .from(transfers)
    .innerJoin(properties, eq(properties.id, transfers.propertyId))
    .innerJoin(fromUser, eq(fromUser.id, transfers.fromOwnerId))
    .innerJoin(toUserAlias, eq(toUserAlias.id, transfers.toOwnerId));
}

export async function requireTransferById(id: number) {
  if (!Number.isInteger(id)) throw new HttpError(404, "Transfer not found.");
  const [row] = await transferQuery().where(eq(transfers.id, id)).limit(1);
  if (!row) throw new HttpError(404, "Transfer not found.");
  return toTransfer(row);
}

export const newestFirst = desc;

export const explorerUrl = (txHash: string | null) => (txHash ? `${env.explorerTxBase}${txHash}` : null);
