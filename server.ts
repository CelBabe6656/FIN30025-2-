import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mock folder export endpoint
  app.get("/api/export-sbr", (req, res) => {
    res.status(501).json({ error: "SBR Export not yet implemented" });
  });

  const distPath = path.resolve(__dirname, "dist");
  const isProd = process.env.NODE_ENV === "production" || fs.existsSync(distPath);

  if (!isProd && fs.existsSync(path.resolve(__dirname, "vite.config.ts"))) {
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
      console.log("Running in development mode with Vite middleware");
    } catch (e) {
      console.warn("Vite failed to load, falling back to static serving:", e);
      serveStatic(app, distPath);
    }
  } else {
    serveStatic(app, distPath);
    console.log("Running in production mode serving static files from dist");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

function serveStatic(app: express.Application, distPath: string) {
  app.use(express.static(distPath));
  app.get("*", (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      res.status(404).send("Production build not found. Please run 'npm run build' first.");
    }
  });
}

startServer();
