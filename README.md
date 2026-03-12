# codex-test

这是一个**前后端一体**示例，满足你要的流程：

1. 后端读取你上传的 PDF（法条文件）并调用 NotebookLM API 上传。
2. 前端输入法律问题。
3. 后端调用 NotebookLM API 问答，并返回法条原文相关内容。

---

## 1) 环境变量

```bash
cp .env.example .env
source .env
```

关键变量：

- `NOTEBOOKLM_BASE_URL`：你的 `notebooklm-ts-api` 服务地址
- `NOTEBOOKLM_API_KEY`：可选
- `NOTEBOOKLM_UPLOAD_ENDPOINT`：上传 PDF 的 API 路径（默认 `/api/files/upload`）
- `NOTEBOOKLM_CHAT_ENDPOINT`：问答 API 路径（默认 `/api/chat`）

> 不同版本的 `notebooklm-ts-api` 路径可能不同，按实际接口改 `.env` 即可。

---

## 2) 启动

```bash
npm start
```

打开：<http://localhost:8787>

---

## 3) 使用方式

1. 在页面选择 PDF（法条文件）并点击“上传并建会话”。
2. 输入法律问题（例如“合同违约责任如何规定？”）并点击“提问”。
3. 页面会展示提取出的回答文本，并附带完整原始响应，便于你核对法条原文。

---

## 项目结构

- `src/server.mjs`：后端服务（静态页面 + `/api/upload` + `/api/ask`）
- `src/notebooklmClient.mjs`：调用 NotebookLM API（上传 PDF / 法律问答）
- `public/index.html`：前端页面
- `public/app.js`：前端逻辑（上传 + 提问）
- `public/styles.css`：页面样式

---

## 后端 API（本示例）

### `POST /api/upload`

请求体：

```json
{
  "filename": "civil-law.pdf",
  "mimeType": "application/pdf",
  "contentBase64": "..."
}
```

返回：

```json
{
  "ok": true,
  "sessionId": "...",
  "sourceId": "...",
  "uploadRaw": {}
}
```

### `POST /api/ask`

请求体：

```json
{
  "sessionId": "...",
  "question": "合同违约责任在法条中如何规定？"
}
```

返回：

```json
{
  "ok": true,
  "answerRaw": {}
}
```

