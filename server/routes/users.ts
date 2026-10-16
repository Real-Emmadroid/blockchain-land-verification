import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import { Router } from "express";
import { z } from "zod";
import { me, registrarOnly, requireAuth } from "../auth";
import { db } from "../db";
import { asyncHandler, HttpError, parse } from "../errors";
import { isUniqueViolation } from "../files";
import { toUser } from "../queries";
import { users } from "../schema";

export const usersRouter = Router();
usersRouter.use(requireAuth, registrarOnly);

usersRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const role = req.query.role;
    const q = db().select().from(users);
    const rows = await (role === "owner" || role === "registrar" ? q.where(eq(users.role, role)) : q).orderBy(desc(users.id));
    res.json(rows.map(toUser));
  }),
);

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name."),
  email: z.email("Enter a valid email address."),
  password: z.string().min(8, "Use at least 8 characters."),
  role: z.enum(["registrar", "owner"], "Choose a role."),
  identifier: z.string().trim().min(1, "Enter an identifier.").max(60),
});

usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = parse(createSchema, req.body);
    try {
      const [row] = await db()
        .insert(users)
        .values({
          name: body.name,
          email: body.email.toLowerCase(),
          passwordHash: await bcrypt.hash(body.password, 10),
          role: body.role,
          identifier: body.identifier,
        })
        .returning();
      res.status(201).json(toUser(row));
    } catch (err) {
      if (isUniqueViolation(err)) throw new HttpError(409, "A user with this email already exists.");
      throw err;
    }
  }),
);

const patchSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name.").optional(),
  isActive: z.boolean().optional(),
});

usersRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    const body = parse(patchSchema, req.body);
    if (body.isActive === false && id === me(req).id) {
      throw new HttpError(409, "You cannot deactivate your own account.");
    }
    const patch: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.isActive !== undefined) patch.isActive = body.isActive;
    if (Object.keys(patch).length === 0) throw new HttpError(422, "Nothing to update.");
    const [row] = Number.isInteger(id) ? await db().update(users).set(patch).where(eq(users.id, id)).returning() : [];
    if (!row) throw new HttpError(404, "User not found.");
    res.json(toUser(row));
  }),
);
