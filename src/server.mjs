import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { NotebookLMClient } from "./notebooklmClient.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const PORT = Number(process.env.PORT || 8787);

const client = new NotebookLMClient({
  baseUrl: process.env.NOTEBOOKLM_BASE_URL || "http://localhost:3000",
  apiKey: process.env.NOTEBOOKLM_API_KEY,
  uploadEndpoint: process.env.NOTEBOOKLM_UPLOAD_ENDPOINT || "/api/files/upload",
  chatEndpoint: process.env.NOTEBOOKLM_CHAT_ENDPOINT || "/api/chat",
  timeoutMs: Number(process.env.NOTEBOOKLM_TIMEOUT_MS || 60_000)
});

/** @type {Map<string, { sourceId?: string, filename: string, uploadedAt: string, raw: unknown }>} */
const sessions = new Map();

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(payload));
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function serveStatic(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = path.join(publicDir, pathname);

  if (!filePath.startsWith(publicDir)) {
    json(res, 403, { error: "Forbidden" });
    return;
  }

  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const type = ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".js"
        ? "application/javascript; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : "application/octet-stream";

    res.writeHead(200, { "Content-Type": type });
    res.end(content);
  } catch {
    json(res, 404, { error: "Not found" });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      });
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/api/health") {
      json(res, 200, {
        ok: true,
        message: "server up",
        notebooklmBaseUrl: client.baseUrl
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/upload") {
      const body = await readJsonBody(req);
      const { filename, mimeType, contentBase64 } = body;

      if (!filename || !contentBase64) {
        json(res, 400, { error: "filename 和 contentBase64 必填" });
        return;
      }

      if (mimeType && mimeType !== "application/pdf") {
        json(res, 400, { error: "仅支持 PDF 文件" });
        return;
      }

      const uploadResult = await client.uploadPdf({
        fileBuffer: NotebookLMClient.decodeBase64File(contentBase64),
        filename,
        mimeType: "application/pdf"
      });

      const sessionId = crypto.randomUUID();
      sessions.set(sessionId, {
        sourceId: uploadResult.sourceId,
        filename,
        uploadedAt: new Date().toISOString(),
        raw: uploadResult.raw
      });

      json(res, 200, {
        ok: true,
        sessionId,
        sourceId: uploadResult.sourceId,
        filename,
        uploadRaw: uploadResult.raw
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/ask") {
      const body = await readJsonBody(req);
      const { sessionId, question } = body;

      if (!sessionId || !question) {
        json(res, 400, { error: "sessionId 和 question 必填" });
        return;
      }

      const session = sessions.get(sessionId);
      if (!session) {
        json(res, 404, { error: "未找到会话，请先上传 PDF" });
        return;
      }

      const answerRaw = await client.askLegalQuestion({
        question,
        sourceId: session.sourceId
      });

      json(res, 200, {
        ok: true,
        session,
        answerRaw
      });
      return;
    }

    if ((req.method === "GET" || req.method === "HEAD") && (req.url?.startsWith("/") ?? false)) {
      await serveStatic(req, res);
      return;
    }

    json(res, 404, { error: "Not found" });
  } catch (error) {
    json(res, 500, {
      error: "服务器内部错误",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, () => {
  console.log(`法律问答前后端示例已启动: http://localhost:${PORT}`);
});
