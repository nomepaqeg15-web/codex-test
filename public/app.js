const docxFileInput = document.querySelector("#docxFile");
const reviewBtn = document.querySelector("#reviewBtn");
const statusPre = document.querySelector("#status");
const issuesPre = document.querySelector("#issues");
const downloadLink = document.querySelector("#downloadLink");

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

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

reviewBtn.addEventListener("click", async () => {
  const file = docxFileInput.files?.[0];
  if (!file) {
    statusPre.textContent = "请先选择 .docx 文件。";
    return;
  }

  if (!file.name.toLowerCase().endsWith(".docx")) {
    statusPre.textContent = "仅支持 .docx 合同文件。";
    return;
  }

  statusPre.textContent = "审查中...";
  issuesPre.textContent = "正在分析条款，请稍候...";
  downloadLink.classList.add("hidden");

  try {
    const contentBase64 = await fileToBase64(file);

    const response = await fetch("/api/review-contract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        contentBase64
      })
    });

    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "审查失败");
    }

    statusPre.textContent = `审查完成：共生成 ${payload.issues.length} 条批注。`;
    issuesPre.textContent = payload.issues.length
      ? payload.issues.map((item, index) => `${index + 1}. 第 ${item.paragraphIndex + 1} 段\n原文：${item.text}\n建议：${item.comment}`).join("\n\n")
      : "未识别到风险点。";

    const blob = base64ToBlob(
      payload.reviewedBase64,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    const reviewedUrl = URL.createObjectURL(blob);
    downloadLink.href = reviewedUrl;
    downloadLink.download = payload.reviewedFilename || "reviewed-contract.docx";
    downloadLink.textContent = "点击下载审查后的合同（批注版）";
    downloadLink.classList.remove("hidden");
  } catch (error) {
    statusPre.textContent = `审查失败: ${error.message}`;
    issuesPre.textContent = "请修复问题后重试。";
  }
});
