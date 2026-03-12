import { NotebookLMClient } from "./notebooklmClient.mjs";

async function main() {
  const client = new NotebookLMClient({
    baseUrl: process.env.NOTEBOOKLM_BASE_URL || "http://localhost:3000",
    apiKey: process.env.NOTEBOOKLM_API_KEY,
    uploadEndpoint: process.env.NOTEBOOKLM_UPLOAD_ENDPOINT || "/api/files/upload",
    chatEndpoint: process.env.NOTEBOOKLM_CHAT_ENDPOINT || "/api/chat"
  });

  console.log("请使用 `npm start` 启动前后端一体服务，再在浏览器上传 PDF 并提问。", {
    baseUrl: client.baseUrl,
    uploadEndpoint: client.uploadEndpoint,
    chatEndpoint: client.chatEndpoint
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
