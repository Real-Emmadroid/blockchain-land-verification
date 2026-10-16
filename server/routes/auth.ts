import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { me, requireAuth, signToken } from "../auth";
import { db } from "../db";
import { asyncHandler, HttpError, parse } from "../errors";
import { users } from "../schema";

export const authRouter = Router();

// Best effort only: serverless instances do not share memory.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  validate: false,
  message: { error: "Too many sign-in attempts. Please wait 15 minutes and try again." },
});

const loginSchema = z.object({ email: z.string().min(1, "Enter your email."), password: z.string().min(1, "Enter your password.") });
const WRONG = "Invalid email or password.";

authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(loginSchema, req.body);
    const [user] = await db().select().from(users).where(eq(users.email, body.email.trim().toLowerCase())).limit(1);
    const ok = user && user.isActive && (await bcrypt.compare(body.password, user.passwordHash));
    if (!user || !ok) throw new HttpError(401, WRONG);
    res.json({
      token: signToken(user.id),
      user: { id: user.id, name: user.name, email: user.email, role: user.role, identifier: user.identifier },
    });
  }),
);

authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const u = me(req);
    res.json({ id: u.id, name: u.name, email: u.email, role: u.role, identifier: u.identifier });
  }),
);
