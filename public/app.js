let sessionId = "";

const pdfFileInput = document.querySelector("#pdfFile");
const uploadBtn = document.querySelector("#uploadBtn");
const uploadStatus = document.querySelector("#uploadStatus");
const questionInput = document.querySelector("#question");
const askBtn = document.querySelector("#askBtn");
const answerPre = document.querySelector("#answer");

async function fileToBase64(file) {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

function extractAnswerText(raw) {
  if (!raw || typeof raw !== "object") return "";

  const candidates = [
    raw.answer,
    raw.text,
    raw.output,
    raw.response,
    raw.message,
    raw.data?.answer,
    raw.data?.text,
    raw.result?.answer,
    raw.result?.text
  ];

  for (const item of candidates) {
    if (typeof item === "string" && item.trim()) {
      return item;
    }
  }

  return "";
}

uploadBtn.addEventListener("click", async () => {
  const file = pdfFileInput.files?.[0];
  if (!file) {
    uploadStatus.textContent = "请先选择 PDF 文件。";
    return;
  }

  if (file.type !== "application/pdf") {
    uploadStatus.textContent = "仅支持 application/pdf。";
    return;
  }

  uploadStatus.textContent = "上传中...";

  try {
    const contentBase64 = await fileToBase64(file);

    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: file.type,
        contentBase64
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "上传失败");
    }

    sessionId = payload.sessionId;
    uploadStatus.textContent = `上传成功\n会话ID: ${sessionId}\nsourceId: ${payload.sourceId || "(API未返回)"}`;
  } catch (error) {
    uploadStatus.textContent = `上传失败: ${error.message}`;
  }
});

askBtn.addEventListener("click", async () => {
  const question = questionInput.value.trim();
  if (!sessionId) {
    answerPre.textContent = "请先上传 PDF。";
    return;
  }
  if (!question) {
    answerPre.textContent = "请输入法律问题。";
    return;
  }

  answerPre.textContent = "提问中...";

  try {
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, question })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "提问失败");
    }

    const text = extractAnswerText(payload.answerRaw);
    answerPre.textContent = text
      ? `【法条原文回答】\n${text}\n\n--- 原始响应 ---\n${JSON.stringify(payload.answerRaw, null, 2)}`
      : `未在常见字段中提取到文本，请查看原始响应：\n${JSON.stringify(payload.answerRaw, null, 2)}`;
  } catch (error) {
    answerPre.textContent = `提问失败: ${error.message}`;
  }
});
