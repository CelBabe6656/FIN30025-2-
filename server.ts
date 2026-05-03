import express from "express";
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ limit: '20mb', extended: true }));

  // API routes
  if (!process.env.GEMINI_API_KEY) {
    console.error("CRITICAL: GEMINI_API_KEY is missing from server environment.");
  }

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini Proxy Routes
  app.post("/api/gemini/analyze", async (req, res) => {
    try {
      const { base64Image, mimeType } = req.body;
      const { analyzeDocument } = await import("./src/services/geminiService.ts");
      const result = await analyzeDocument(base64Image, mimeType);
      res.json(result);
    } catch (error) {
      console.error("Server-side Gemini Error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "AI Analysis failed" });
    }
  });

  app.post("/api/gemini/suggest-category", async (req, res) => {
    try {
      const { vendor, categories } = req.body;
      const { suggestCategory } = await import("./src/services/geminiService.ts");
      const result = await suggestCategory(vendor, categories);
      res.json({ category: result });
    } catch (error) {
      res.status(500).json({ error: "Category suggestion failed" });
    }
  });

  app.post("/api/gemini/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;
      const { chatWithTradie } = await import("./src/services/geminiService.ts");
      const result = await chatWithTradie(messages, context);
      res.json({ response: result });
    } catch (error) {
      res.status(500).json({ error: "Chat failed" });
    }
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
