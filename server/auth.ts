import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { env } from "./env";
import { HttpError } from "./errors";
import { users, type Role } from "./schema";

export type AuthUser = { id: number; name: string; email: string; role: Role; identifier: string };

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function signToken(userId: number) {
  if (env.jwtSecret.length < 16) throw new HttpError(500, "JWT_SECRET is not configured on the server.");
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "12h" });
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!token) throw new HttpError(401, "Please sign in to continue.");
    let id: number;
    try {
      const payload = jwt.verify(token, env.jwtSecret) as unknown as { sub: number };
      id = Number(payload.sub);
    } catch {
      throw new HttpError(401, "Your session has expired. Please sign in again.");
    }
    const [row] = await db().select().from(users).where(eq(users.id, id)).limit(1);
    if (!row || !row.isActive) throw new HttpError(401, "Your session has expired. Please sign in again.");
    req.user = { id: row.id, name: row.name, email: row.email, role: row.role, identifier: row.identifier };
    next();
  } catch (err) {
    next(err);
  }
}

export const requireRole =
  (role: Role) => (req: Request, _res: Response, next: NextFunction) => {
    if (req.user?.role !== role) return next(new HttpError(403, "You do not have permission to do this."));
    next();
  };

export const registrarOnly = requireRole("registrar");
export const me = (req: Request) => req.user as AuthUser;
