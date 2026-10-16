import { sql as dsql } from "drizzle-orm";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import bcrypt from "bcryptjs";
import { env } from "./env";
import { HttpError } from "./errors";
import * as schema from "./schema";

let client: ReturnType<typeof postgres> | null = null;
let database: PostgresJsDatabase<typeof schema> | null = null;

export function db() {
  if (!database) {
    if (!env.databaseUrl) throw new HttpError(500, "DATABASE_URL is not configured on the server.");
    client = postgres(env.databaseUrl, { max: 1, prepare: false, ssl: "require" });
    database = drizzle(client, { schema });
  }
  return database;
}

export type Tx = Parameters<Parameters<ReturnType<typeof db>["transaction"]>[0]>[0];

// Advisory lock keys (transaction scoped, so they work behind a connection pooler).
export const LOCK_INIT = 7001;
export const LOCK_CHAIN = 7002;
export const LOCK_CODE = 7003;

const DDL = [
  `CREATE TABLE IF NOT EXISTS users (
    id serial PRIMARY KEY,
    name text NOT NULL,
    email text NOT NULL UNIQUE,
    password_hash text NOT NULL,
    role text NOT NULL CHECK (role IN ('registrar','owner')),
    identifier text NOT NULL DEFAULT '',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS properties (
    id serial PRIMARY KEY,
    property_code text NOT NULL UNIQUE,
    title text NOT NULL,
    property_type text NOT NULL CHECK (property_type IN ('land','building')),
    location text NOT NULL,
    size_sqm numeric,
    description text NOT NULL DEFAULT '',
    current_owner_id integer NOT NULL REFERENCES users(id),
    status text NOT NULL DEFAULT 'registered' CHECK (status IN ('registered','transfer_pending')),
    created_by integer NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS documents (
    id serial PRIMARY KEY,
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    doc_type text NOT NULL CHECK (doc_type IN ('title_deed','certificate_of_occupancy','deed_of_assignment','survey_plan','receipt','other')),
    file_name text NOT NULL,
    file_type text NOT NULL,
    file_size integer NOT NULL,
    file_data bytea NOT NULL,
    sha256 text NOT NULL UNIQUE,
    chain_status text NOT NULL DEFAULT 'pending' CHECK (chain_status IN ('pending','confirmed','failed')),
    tx_hash text,
    chain_error text,
    revoked boolean NOT NULL DEFAULT false,
    revoke_reason text,
    uploaded_by integer NOT NULL REFERENCES users(id),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS ownership_history (
    id serial PRIMARY KEY,
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    owner_id integer NOT NULL REFERENCES users(id),
    since timestamptz NOT NULL DEFAULT now(),
    deed_document_id integer REFERENCES documents(id) ON DELETE SET NULL,
    tx_hash text
  )`,
  `CREATE TABLE IF NOT EXISTS transfers (
    id serial PRIMARY KEY,
    property_id integer NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    from_owner_id integer NOT NULL REFERENCES users(id),
    to_owner_id integer NOT NULL REFERENCES users(id),
    note text,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','rejected')),
    rejection_reason text,
    deed_document_id integer REFERENCES documents(id) ON DELETE SET NULL,
    tx_hash text,
    created_at timestamptz NOT NULL DEFAULT now(),
    decided_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS verification_log (
    id serial PRIMARY KEY,
    sha256 text NOT NULL,
    result text NOT NULL CHECK (result IN ('authentic','revoked','not_found')),
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS chain_settings (
    key text PRIMARY KEY,
    value text NOT NULL
  )`,
];

const SEED_USERS = [
  { name: "Ngozi Eze", email: "registrar@example.com", password: "Registrar123!", role: "registrar", identifier: "REG/001" },
  { name: "Chinedu Okafor", email: "owner1@example.com", password: "Owner123!", role: "owner", identifier: "NIN 4471 0928 113" },
  { name: "Amina Bello", email: "owner2@example.com", password: "Owner123!", role: "owner", identifier: "NIN 2208 6615 470" },
  { name: "Folasade Adeyemi", email: "owner3@example.com", password: "Owner123!", role: "owner", identifier: "NIN 9035 1127 806" },
] as const;

async function runInit() {
  await db().transaction(async (tx) => {
    await tx.execute(dsql`select pg_advisory_xact_lock(${LOCK_INIT})`);
    for (const stmt of DDL) await tx.execute(dsql.raw(stmt));
    const existing = await tx.execute(dsql`select 1 from users where role = 'registrar' limit 1`);
    if (existing.length === 0) {
      for (const u of SEED_USERS) {
        await tx.insert(schema.users).values({
          name: u.name,
          email: u.email,
          passwordHash: bcrypt.hashSync(u.password, 10),
          role: u.role,
          identifier: u.identifier,
        });
      }
    }
  });
}

let initPromise: Promise<void> | null = null;

/** Creates tables and seeds once per warm instance. Retries after a failure. */
export function init() {
  if (!initPromise) {
    initPromise = runInit().catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}
