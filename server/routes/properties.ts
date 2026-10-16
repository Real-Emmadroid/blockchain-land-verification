import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { me, registrarOnly, requireAuth, requireRole } from "../auth";
import { requireConfigured, ownerRef, toBytes32 } from "../chain";
import { db, LOCK_CODE } from "../db";
import { pushDocument } from "../docs";
import { asyncHandler, HttpError, parse } from "../errors";
import { assertNotRegistered, decodeUpload, isUniqueViolation } from "../files";
import {
  assertCanView,
  documentQuery,
  getDocumentById,
  propertyQuery,
  requirePropertyById,
  requireTransferById,
  toDocument,
  toProperty,
} from "../queries";
import { documents, ownershipHistory, properties, transfers, users } from "../schema";

export const propertiesRouter = Router();
propertiesRouter.use(requireAuth);

const DOC_TYPES = ["title_deed", "certificate_of_occupancy", "deed_of_assignment", "survey_plan", "receipt", "other"] as const;

const fileFields = {
  fileName: z.string().min(1, "Choose a file.").max(200),
  fileType: z.string().min(1).max(100),
  fileBase64: z.string().min(1, "Choose a file."),
};

const createSchema = z.object({
  title: z.string().trim().min(3, "Enter a title."),
  propertyType: z.enum(["land", "building"], "Choose land or building."),
  location: z.string().trim().min(3, "Enter the location."),
  sizeSqm: z.number("Enter a number.").positive("Size must be greater than zero.").nullish(),
  description: z.string().trim().max(2000).default(""),
  ownerId: z.number("Choose an owner.").int(),
  docType: z.enum(DOC_TYPES, "Choose a document type."),
  ...fileFields,
});

propertiesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = me(req);
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const filters = [];
    if (user.role === "owner") filters.push(eq(properties.currentOwnerId, user.id));
    if (q) {
      const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      filters.push(or(ilike(properties.propertyCode, like), ilike(properties.title, like), ilike(properties.location, like))!);
    }
    const rows = await propertyQuery()
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(properties.id));
    res.json(rows.map(toProperty));
  }),
);

propertiesRouter.post(
  "/",
  registrarOnly,
  asyncHandler(async (req, res) => {
    const user = me(req);
    const body = parse(createSchema, req.body);
    const file = decodeUpload(body);

    const [owner] = await db().select().from(users).where(eq(users.id, body.ownerId)).limit(1);
    if (!owner || owner.role !== "owner" || !owner.isActive) {
      throw new HttpError(409, "The selected person is not an active owner account.");
    }
    await assertNotRegistered(file.sha256);
    requireConfigured();

    let created: { propertyId: number; code: string; docId: number };
    try {
      created = await db().transaction(async (tx) => {
        await tx.execute(sql`select pg_advisory_xact_lock(${LOCK_CODE})`);
        const year = new Date().getFullYear();
        const prefix = `LND-${year}-`;
        const [last] = await tx
          .select({ code: properties.propertyCode })
          .from(properties)
          .where(sql`${properties.propertyCode} like ${prefix + "%"}`)
          .orderBy(desc(properties.propertyCode))
          .limit(1);
        const next = last ? Number(last.code.slice(prefix.length)) + 1 : 1;
        const code = `${prefix}${String(next).padStart(4, "0")}`;

        const [p] = await tx
          .insert(properties)
          .values({
            propertyCode: code,
            title: body.title,
            propertyType: body.propertyType,
            location: body.location,
            sizeSqm: body.sizeSqm == null ? null : String(body.sizeSqm),
            description: body.description,
            currentOwnerId: owner.id,
            createdBy: user.id,
          })
          .returning({ id: properties.id });
        const [d] = await tx
          .insert(documents)
          .values({
            propertyId: p.id,
            docType: body.docType,
            fileName: file.fileName,
            fileType: file.fileType,
            fileSize: file.buffer.length,
            fileData: file.buffer,
            sha256: file.sha256,
            uploadedBy: user.id,
          })
          .returning({ id: documents.id });
        await tx.insert(ownershipHistory).values({ propertyId: p.id, ownerId: owner.id, deedDocumentId: d.id });
        return { propertyId: p.id, code, docId: d.id };
      });
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "This exact document is already registered.");
      throw err;
    }

    await pushDocument(created.docId, {
      method: "registerProperty",
      args: [created.code, ownerRef(owner.id), toBytes32(file.sha256), body.docType],
    });

    res.status(201).json({
      property: await requirePropertyById(created.propertyId),
      document: await getDocumentById(created.docId),
    });
  }),
);

propertiesRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const property = await requirePropertyById(id);
    await assertCanView(me(req), id);

    const docs = await documentQuery().where(eq(documents.propertyId, id)).orderBy(asc(documents.id));
    const history = await db()
      .select({
        ownerId: ownershipHistory.ownerId,
        ownerName: users.name,
        since: ownershipHistory.since,
        deedSha256: documents.sha256,
        txHash: ownershipHistory.txHash,
      })
      .from(ownershipHistory)
      .innerJoin(users, eq(users.id, ownershipHistory.ownerId))
      .leftJoin(documents, eq(documents.id, ownershipHistory.deedDocumentId))
      .where(eq(ownershipHistory.propertyId, id))
      .orderBy(asc(ownershipHistory.id));

    res.json({
      property,
      documents: docs.map(toDocument),
      history: history.map((h) => ({ ...h, since: h.since.toISOString(), deedSha256: h.deedSha256 ?? "" })),
    });
  }),
);

const addDocSchema = z.object({ docType: z.enum(DOC_TYPES, "Choose a document type."), ...fileFields });

propertiesRouter.post(
  "/:id/documents",
  registrarOnly,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const property = await requirePropertyById(id);
    const body = parse(addDocSchema, req.body);
    const file = decodeUpload(body);
    await assertNotRegistered(file.sha256);
    requireConfigured();

    let docId: number;
    try {
      const [d] = await db()
        .insert(documents)
        .values({
          propertyId: id,
          docType: body.docType,
          fileName: file.fileName,
          fileType: file.fileType,
          fileSize: file.buffer.length,
          fileData: file.buffer,
          sha256: file.sha256,
          uploadedBy: me(req).id,
        })
        .returning({ id: documents.id });
      docId = d.id;
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "This exact document is already registered.");
      throw err;
    }

    await pushDocument(docId, {
      method: "registerDocument",
      args: [property.propertyCode, toBytes32(file.sha256), body.docType],
    });
    res.status(201).json(await getDocumentById(docId));
  }),
);

const requestSchema = z.object({
  toEmail: z.email("Enter a valid email address."),
  note: z.string().trim().max(500).nullish(),
});

propertiesRouter.post(
  "/:id/transfers",
  requireRole("owner"),
  asyncHandler(async (req, res) => {
    const user = me(req);
    const id = Number(req.params.id);
    const property = await requirePropertyById(id);
    if (property.currentOwnerId !== user.id) {
      throw new HttpError(403, "Only the current owner can request a transfer.");
    }
    const body = parse(requestSchema, req.body);

    const [target] = await db()
      .select()
      .from(users)
      .where(and(eq(users.email, body.toEmail.trim().toLowerCase()), eq(users.role, "owner"), eq(users.isActive, true)))
      .limit(1);
    if (!target) throw new HttpError(404, "No active owner account was found with that email.");
    if (target.id === user.id) throw new HttpError(409, "You are already the current owner of this property.");

    const [open] = await db()
      .select({ id: transfers.id })
      .from(transfers)
      .where(and(eq(transfers.propertyId, id), inArray(transfers.status, ["pending", "processing"])))
      .limit(1);
    if (open || property.status !== "registered") {
      throw new HttpError(409, "A transfer for this property is already in progress.");
    }

    const row = await db().transaction(async (tx) => {
      const [t] = await tx
        .insert(transfers)
        .values({ propertyId: id, fromOwnerId: user.id, toOwnerId: target.id, note: body.note ?? null })
        .returning({ id: transfers.id });
      await tx.update(properties).set({ status: "transfer_pending" }).where(eq(properties.id, id));
      return t;
    });
    res.status(201).json(await requireTransferById(row.id));
  }),
);
