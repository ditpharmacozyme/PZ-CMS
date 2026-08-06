import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

  // JSON Body Parser middleware for handling large base64 upload payloads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({
      status: "ok",
      server: "Pharmacozyme Express Node Server",
      version: "2.0.0",
      timestamp: new Date().toISOString()
    });
  });

  // Local server file upload endpoint
  app.post("/api/upload", (req, res) => {
    try {
      const { fileName, base64Data, mimeType } = req.body;
      if (!base64Data) {
        return res.status(400).json({ status: "error", message: "Missing base64Data in payload" });
      }

      // Return data URL as uploaded visual URL
      const dataUrl = base64Data.startsWith("data:")
        ? base64Data
        : `data:${mimeType || "image/png"};base64,${base64Data}`;

      res.json({
        status: "success",
        message: "File uploaded successfully to Express Node Server",
        fileName: fileName || "upload.png",
        url: dataUrl,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Proxy endpoint to Google Apps Script Web App (Bypasses CORS restrictions)
  app.post("/api/appscript/proxy", async (req, res) => {
    try {
      const { scriptUrl, payload } = req.body;
      if (!scriptUrl) {
        return res.status(400).json({ status: "error", message: "Missing Google Apps Script URL" });
      }

      const response = await fetch(scriptUrl, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload || {}),
        redirect: "follow"
      });

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }

      res.json({
        status: "success",
        proxyStatus: response.status,
        data: responseData
      });
    } catch (err: any) {
      res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Vite middleware for development vs Static serving for production
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Pharmacozyme Backend Server listening on http://localhost:${PORT}`);
  });
}

startServer();
