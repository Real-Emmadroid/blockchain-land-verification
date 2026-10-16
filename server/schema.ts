import { boolean, customType, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

export type Role = "registrar" | "owner";
export type DocType = "title_deed" | "certificate_of_occupancy" | "deed_of_assignment" | "survey_plan" | "receipt" | "other";
export type ChainStatus = "pending" | "confirmed" | "failed";
export type TransferStatus = "pending" | "processing" | "completed" | "rejected";
export type PropertyStatus = "registered" | "transfer_pending";
export type VerifyResult = "authentic" | "revoked" | "not_found";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  identifier: text("identifier").notNull().default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  propertyCode: text("property_code").notNull().unique(),
  title: text("title").notNull(),
  propertyType: text("property_type").$type<"land" | "building">().notNull(),
  location: text("location").notNull(),
  sizeSqm: numeric("size_sqm"),
  description: text("description").notNull().default(""),
  currentOwnerId: integer("current_owner_id").notNull().references(() => users.id),
  status: text("status").$type<PropertyStatus>().notNull().default("registered"),
  createdBy: integer("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  docType: text("doc_type").$type<DocType>().notNull(),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileData: bytea("file_data").notNull(),
  sha256: text("sha256").notNull().unique(),
  chainStatus: text("chain_status").$type<ChainStatus>().notNull().default("pending"),
  txHash: text("tx_hash"),
  chainError: text("chain_error"),
  revoked: boolean("revoked").notNull().default(false),
  revokeReason: text("revoke_reason"),
  uploadedBy: integer("uploaded_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ownershipHistory = pgTable("ownership_history", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  since: timestamp("since", { withTimezone: true }).notNull().defaultNow(),
  deedDocumentId: integer("deed_document_id").references(() => documents.id, { onDelete: "set null" }),
  txHash: text("tx_hash"),
});

export const transfers = pgTable("transfers", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => properties.id, { onDelete: "cascade" }),
  fromOwnerId: integer("from_owner_id").notNull().references(() => users.id),
  toOwnerId: integer("to_owner_id").notNull().references(() => users.id),
  note: text("note"),
  status: text("status").$type<TransferStatus>().notNull().default("pending"),
  rejectionReason: text("rejection_reason"),
  deedDocumentId: integer("deed_document_id").references(() => documents.id, { onDelete: "set null" }),
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
});

export const verificationLog = pgTable("verification_log", {
  id: serial("id").primaryKey(),
  sha256: text("sha256").notNull(),
  result: text("result").$type<VerifyResult>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const chainSettings = pgTable("chain_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

