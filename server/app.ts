import express from "express";
import helmet from "helmet";
import { env } from "./env";
import { init } from "./db";
import { asyncHandler, errorMiddleware, HttpError } from "./errors";
import { authRouter } from "./routes/auth";
import { usersRouter } from "./routes/users";
import { propertiesRouter } from "./routes/properties";
import { documentsRouter } from "./routes/documents";
import { transfersRouter } from "./routes/transfers";
import { verificationsRouter, verifyRouter } from "./routes/verify";
import { chainRouter, reportsRouter } from "./routes/admin";
import { readContractAddress } from "./chain";
import { chainConfigured } from "./env";

const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "6mb" }));

const api = express.Router();

api.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Every other route waits for the tables to exist. The promise is cached per instance.
api.use(
  asyncHandler(async (_req, _res, next) => {
    await init();
    next();
  }),
);

api.get(
  "/config",
  asyncHandler(async (_req, res) => {
    let contractAddress: string | null = null;
    if (chainConfigured()) {
      try {
        contractAddress = (await readContractAddress())?.address ?? null;
      } catch {
        contractAddress = null;
      }
    }
    res.json({
      chainId: chainConfigured() ? env.chainId : null,
      explorerTxBase: env.explorerTxBase,
      contractAddress,
      maxFileMb: 4,
    });
  }),
);

api.use("/auth", authRouter);
api.use("/users", usersRouter);
api.use("/properties", propertiesRouter);
api.use("/documents", documentsRouter);
api.use("/transfers", transfersRouter);
api.use("/verify", verifyRouter);
api.use("/verifications", verificationsRouter);
api.use("/reports", reportsRouter);
api.use("/chain", chainRouter);

api.use((_req, _res, next) => next(new HttpError(404, "This API route does not exist.")));

app.use("/api", api);
app.use("/.netlify/functions/api", api);
app.use(errorMiddleware);

export default app;
