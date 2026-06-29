# WeOW Postman 測試

## 匯入步驟

1. Postman → **Import**
2. 匯入：
   - `weow-api.postman_collection.json`
   - `weow-local.postman_environment.json`
3. 右上角選環境 **WeOW Local**
4. 確認 `adminApiKey` 與 `.env` 的 `ADMIN_API_KEY` 一致

## 一鍵完整測試

1. 啟動 server：`npm run dev:server`
2. Collection **WeOW API** → **完整流程（依序執行）**
3. **Run** Collection Runner，執行 01–13

> 步驟 03 若 clientId 已存在會回 400，改跑 04 Login 即可。

## 環境變數

| 變數 | 說明 |
|------|------|
| `baseUrl` | API，預設 `http://localhost:3001` |
| `adminApiKey` | Admin 金鑰 |
| `sectionId` | Section `_id`（自動儲存） |
| `gameClientId` / `gameClientSecret` | Game Client（自動儲存 secret） |
| `gameJwt` | 遊戲端 JWT（自動儲存） |
| `sessionId` / `sig` / `socketCode` | Session（自動儲存） |
| `playerEmail` | 測試電郵（需真實 domain，建議 gmail） |
| `score` | 預設 200（禮物 A） |
| `scoreNoPrize` | 50 |
| `scoreGiftB` | 200 |
| `scoreGiftA` | 500 |
| `resultUrl` | 提交分數後自動儲存 |

## 禮物測試分數

| 分數 | 預期 |
|------|------|
| ≤99 | `no_prize`，`resultUrl` / `resultQrImageUrl` 為 null |
| 100–400 | 禮物 A（Prize2.png） |
| >400 | 禮物 B（Prize1.png） |

## 完整流程步驟

01 Health → 02 Create Section → 03 Create Game Client → 04 Login → 05 Get QR → 06 Gift Availability → 07 Get Session → 08 Accept Terms → 09 Register Email → 10 Start Game → 11 Submit Score → 12 Get Result → 13 Inventory
