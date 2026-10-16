import path from "node:path";
import express from "express";
import app from "./server/app";

const port = Number(process.env.PORT) || 3000;
const production = process.env.NODE_ENV === "production" || process.argv.includes("--prod");

async function start() {
  if (production) {
    const dist = path.resolve(process.cwd(), "dist");
    app.use(express.static(dist));
    app.get("*", (_req, res) => res.sendFile(path.join(dist, "index.html")));
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  }
  app.listen(port, () => console.log(`Land registry running on http://localhost:${port}`));
}

start();
