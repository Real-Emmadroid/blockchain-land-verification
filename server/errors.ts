import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
  }
}

export const CHAIN_UNAVAILABLE = "The blockchain connection is not available. Please try again shortly.";

export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  throw zodToHttp(result.error);
}

export function zodToHttp(err: ZodError) {
  return new HttpError(
    422,
    "Some fields need attention.",
    err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );
}

export function errorMiddleware(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
    return;
  }
  const e = err as { type?: string; status?: number };
  if (e?.type === "entity.too.large") {
    res.status(413).json({ error: "The upload is too large. Files must be 4 MB or smaller." });
    return;
  }
  if (e?.type === "entity.parse.failed") {
    res.status(400).json({ error: "The request body is not valid JSON." });
    return;
  }
  console.error("Unhandled error:", err instanceof Error ? err.message : err);
  res.status(500).json({ error: "Something went wrong on the server. Please try again." });
}
