# Hunger Run 2026 — WeOW Server

Mobile-only game website with Express + MongoDB + React + Socket.io.

## API 一覽

### Admin（Header: `X-Admin-Key`）

- `GET/POST/PUT/DELETE /api/sections` — 管理 Section
- `GET/POST/DELETE /api/game-clients` — 管理 Game Client
- `POST /api/game-auth/token` — 簽發 GAME JWT

### 遊戲端（Bearer GAME JWT）

- `POST /api/game-auth/login` — clientId + clientSecret 登入
- `GET /api/games/:sectionId/info` — 建立 Session + QR
- `POST /api/games/sessions/:sessionId/submit-score` — 提交分數

### 公開

- `GET /api/games/sessions/:sessionId/qrcode.png?sig=`
- `GET /api/games/inventory/today`
- `GET/POST /api/sessions/:sessionId/...` — 玩家流程

## 禮物規則

| 分數 | 禮物 |
|------|------|
| 0–5 | 無 |
| 6–405 | 禮物 A |
| >405 | 禮物 B |

禮物編號由 `000001` 起。每日各 50 份，香港時間 07:00 各補 50 份。

## 快速測試

```bash
npm run install:all
cp .env.example .env
npm run dev
```
