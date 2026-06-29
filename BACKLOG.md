# 待開發項目（Backlog）

> 記錄時間：2026-06-26  
> 狀態：#1 已完成（2026-06-27）；#2、#3 待開發。

---

## 1. Email 驗證強化

### 目標
在現有 regex validation 之外，加強電郵可用性檢查，並確認當日是否已參與／已使用。

### 現況
- 前端：`EmailPage.jsx` 使用 `EMAIL_RE` regex
- 後端：`POST /api/sessions/:sessionId/register-email` 使用相同 regex
- 當日重複：`Registration` collection 以 `email + dateKey` 查詢；若當日已有記錄則 `canClaimPrize: false`，回傳 `warning: already_registered`
- **尚未**使用 `deep-email-validator` 做 MX / SMTP 等深度驗證

### 待做
- [x] 安裝並整合 [`deep-email-validator`](https://www.npmjs.com/package/deep-email-validator)（或專案指定版本）
- [x] 後端 `register-email` 流程：
  1. Regex 格式檢查（保留）
  2. `deep-email-validator` 檢查（`validateRegex`、`validateMx`、`validateTypo`、`validateDisposable`；SMTP 預設關閉，可設 `EMAIL_VALIDATE_SMTP=true`）
  3. 查詢當日 `Registration` / `GameSession`：是否已玩／已登記
- [x] 定義錯誤碼與前端對應 UI：
  - `invalid_email` — 格式錯誤
  - `email_unreachable` — deep validator 失敗
  - `already_registered` — 當日已使用（仍可繼續玩，但 `canClaimPrize: false`）
- [x] 「已玩」定義：當日已有 `Registration`（其他 session）或 `GameSession` 已 `registered`/`playing`/`finished`/`completed`
- [x] Validator 超時 8s → 回傳 `email_unreachable`（嚴格拒絕）
- [x] 更新 Postman collection

### 實作備註（2026-06-27）
- 服務：`server/services/emailValidation.js`
- 環境變數：`EMAIL_VALIDATE_TIMEOUT_MS`（預設 8000）、`EMAIL_VALIDATE_SMTP`（預設 false）

### 相關檔案
- `server/routes/sessions.js`
- `server/models/Registration.js`
- `client/src/pages/EmailPage.jsx`

---

## 2. Paw.png 位置微調

### 目標
條款頁勾選後的 `Paw.png` 向左移，使其落在 checkbox 方框內。

### 現況
- `TermsPage.jsx` — Paw 疊在 `TandC_Checkbox.png` 上
- `TermsPage.css` — `.terms-page__paw-wrap` 使用 `left: 2.8%` 絕對定位

### 待做
- [ ] 調整 `.terms-page__paw-wrap` 的 `left`（及必要時 `width` / `transform`）
- [ ] 實機（iOS / Android 多種寬度）目視確認
- [ ] 避免影響未勾選、disabled 狀態

### 相關檔案
- `client/src/pages/TermsPage.css`
- `client/src/pages/TermsPage.jsx`

---

## 3. Deployment：Cloudflare Flexible + Apache2 VirtualHost

### 目標
以 **Cloudflare SSL/TLS = Flexible** 方式部署，前端經 Cloudflare HTTPS，源站 Apache2 HTTP virtualhost 提供服務。

### 架構概要
```
用戶 ──HTTPS──▶ Cloudflare ──HTTP──▶ 源站 Apache2 (VirtualHost)
                                      └── reverse proxy / static
                                          └── Node weow_server
```

### 待做
- [ ] Cloudflare DNS：A / CNAME 指向源站 IP
- [ ] Cloudflare SSL/TLS 模式設為 **Flexible**（用戶↔CF HTTPS，CF↔源站 HTTP）
- [ ] Apache2 VirtualHost 範例（domain、DocumentRoot、`ProxyPass` 至 Node port）：
  - `/api` → `http://127.0.0.1:3001`
  - `/socket.io` → WebSocket upgrade
  - `/assets` → static 或 proxy
  - SPA fallback → `client/dist/index.html`（production build）
- [ ] 環境變數：`CLIENT_URL` 設為公開 HTTPS domain；`NODE_ENV=production`
- [ ] 注意 Flexible 限制：源站無端到端加密；長期可考慮 Full (Strict) + 源站證書
- [ ] `X-Forwarded-Proto` / `trust proxy`：確認 Express 產生正確 QR / callback URL
- [ ] Socket.io 在 Cloudflare 下的 WebSocket 設定與 timeout
- [ ] 撰寫部署 checklist（build、pm2/systemd、Apache modules: `proxy`, `proxy_http`, `proxy_wstunnel`）

### 相關檔案
- `server/index.js`
- `client/vite.config.js`
- `.env` / production env 範本
- （新建）`deploy/apache/weow.conf` 或文件內範例

---

## 優先順序建議（可調整）

| 優先 | 項目 | 理由 |
|------|------|------|
| P1 | Email 驗證強化 | 活動登記與防濫用 |
| P2 | Paw 位置 | UI 小改，低風險 |
| P3 | Cloudflare + Apache 部署 | 上線前完成 |

---

開發時請直接引用本檔案項目編號（1 / 2 / 3）。
