function toDataUrl(mimeType, base64) {
  return `data:${mimeType};base64,${base64}`;
}

function pickFirst(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

export class NotebookLMClient {
  /**
   * @param {{
   *   baseUrl: string,
   *   apiKey?: string,
   *   timeoutMs?: number,
   *   uploadEndpoint?: string,
   *   chatEndpoint?: string
   * }} options
   */
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.uploadEndpoint = options.uploadEndpoint ?? "/api/files/upload";
    this.chatEndpoint = options.chatEndpoint ?? "/api/chat";
  }

  async #requestJson(path, init) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
          ...(init.headers ?? {})
        },
        signal: controller.signal
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`NotebookLM API 请求失败: ${response.status} ${response.statusText} - ${text}`);
      }

      return response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 上传 PDF 文件。
   * 返回原始响应以及自动推断出的 documentId/sourceId（如果 API 返回里存在）。
   */
  async uploadPdf({ fileBuffer, filename, mimeType = "application/pdf" }) {
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer], { type: mimeType }), filename);

    const raw = await this.#requestJson(this.uploadEndpoint, {
      method: "POST",
      body: formData
    });

    const topLevelId = pickFirst(raw, ["id", "fileId", "documentId", "sourceId"]);
    const nestedId = pickFirst(raw?.data, ["id", "fileId", "documentId", "sourceId"]);

    return {
      raw,
      sourceId: topLevelId ?? nestedId
    };
  }

  /**
   * 向 NotebookLM 提问，默认强调“返回法条原文”。
   */
  async askLegalQuestion({ question, sourceId, history = [] }) {
    const legalPrompt = [
      "你是法律助手。",
      "请只根据已上传的法条 PDF 回答。",
      "优先给出对应法条的原文，并标注条款编号。",
      "如果找不到对应条文，请明确说明未找到，不要编造。",
      `用户问题：${question}`
    ].join("\n");

    const payload = {
      message: legalPrompt,
      question: legalPrompt,
      history,
      sourceId,
      sourceIds: sourceId ? [sourceId] : undefined
    };

    const raw = await this.#requestJson(this.chatEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    return raw;
  }

  static decodeBase64File(base64) {
    return Buffer.from(base64, "base64");
  }

  static asDataUrl(mimeType, base64) {
    return toDataUrl(mimeType, base64);
  }
}
