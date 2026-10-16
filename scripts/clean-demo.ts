import { sql } from "drizzle-orm";
import { db } from "../server/db";

// Removes the seeded demo owners (owner1..3@example.com) that have no properties,
// ownership history or transfers. Anyone who owns something is left alone.
const rows = await db().execute(sql`
  delete from users u
  where u.email in ('owner1@example.com', 'owner2@example.com', 'owner3@example.com')
    and not exists (select 1 from properties p where p.current_owner_id = u.id or p.created_by = u.id)
    and not exists (select 1 from ownership_history h where h.owner_id = u.id)
    and not exists (select 1 from transfers t where t.from_owner_id = u.id or t.to_owner_id = u.id)
    and not exists (select 1 from documents d where d.uploaded_by = u.id)
  returning u.email
`);
console.log(rows.length ? `Removed: ${rows.map((r) => r.email).join(", ")}` : "No unused demo users found.");
process.exit(0);
