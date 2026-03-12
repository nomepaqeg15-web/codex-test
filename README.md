# codex-test

这是一个合同审查工具（前后端一体）：

1. 上传 `.docx` 合同文件。
2. 后端进行规则化风险扫描。
3. 返回带 **Word 批注** 的新合同版本，供你在 Word 中直接查看修改意见。

---

## 0) 我应该在哪里输入命令？

- 在 **终端** 输入命令（如 `npm start`），不要在浏览器地址栏输入。
- 启动后再在浏览器访问 `http://localhost:8787`。
- 页面第一步是“上传合同（.docx）”，这是点选文件，不是手动输入文本。

---

## 1) 启动

```bash
npm start
```

打开：<http://localhost:8787>

---

## 2) 使用方式

1. 在页面选择合同文件（`.docx`）。
2. 点击“开始审查”。
3. 页面会展示审查摘要，并提供“下载审查后的合同（批注版）”链接。
4. 使用 Microsoft Word/WPS 打开下载后的文件，查看批注内容。

---

## 项目结构

- `src/server.mjs`：后端服务（静态页面 + `/api/review-contract`）
- `scripts/review_docx.py`：合同审查脚本（读取 docx，生成批注）
- `public/index.html`：前端页面
- `public/app.js`：前端逻辑（上传 + 审查 + 下载）
- `public/styles.css`：页面样式

---

## 后端 API

### `POST /api/review-contract`

请求体：

```json
{
  "filename": "contract.docx",
  "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "contentBase64": "..."
}
```

返回：

```json
{
  "ok": true,
  "filename": "contract.docx",
  "reviewedFilename": "contract-reviewed.docx",
  "reviewedBase64": "...",
  "issues": [
    {
      "paragraphIndex": 3,
      "text": "...",
      "comment": "..."
    }
  ]
}
```
