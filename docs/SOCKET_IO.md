# Game Client 連線與程序

> Hunger Run 2026 — WeOW Server  
> 供**現場 Game Client（Unity / 自訂 App 等）**整合 Server 的 HTTP API 與 Socket.io 說明

本專案**唔需要**使用網頁 `/display`；Game Client 自行負責登入、建立 Session、顯示 QR、連 Socket 同處理 UI。

---

## 架構

```
┌──────────────────┐     HTTP + WebSocket      ┌──────────────────┐
│  Game Client     │◄────── /socket.io ───────►│  WeOW Server     │
│  （自訂程式）     │     /api/game-auth        │  Node.js         │
│                  │     /api/games/.../info   │                  │
└──────────────────┘                           └────────▲─────────┘
                                                          │
                                               玩家手機掃 QR 後連線
```

| 協議 | 路徑 | 用途 |
|------|------|------|
| HTTP | `/api/game-auth/login` | Game Client 登入取 JWT |
| HTTP | `/api/games/{sectionId}/info` | 建立 Session、取得 QR |
| HTTP | `/api/games/sessions/{id}/submit-score` | 提交分數（Game Client 端遊戲完成後） |
| WebSocket | `/socket.io` | 即時接收玩家進度 |

---

## 一、前置準備

### 1. 建立 Section

```http
POST /api/sections
Header: X-Admin-Key: <ADMIN_API_KEY>

{
  "name": "現場 A 區",
  "seasonKey": "season-1",
  "isActive": true
}
```

記下回應 `data.item._id` → **`sectionId`**

### 2. 建立 Game Client 憑證

```http
POST /api/game-clients
Header: X-Admin-Key: <ADMIN_API_KEY>

{
  "clientId": "unity-hall-a",
  "name": "現場 Game Client",
  "isActive": true
}
```

記下：
- **`clientId`**
- **`clientSecret`**（只回傳一次，請妥善保存）

以上三個值由 Game Client 程式自行配置（唔關乎 weow 前端 `.env`）。

---

## 二、整合程序（每局遊戲）

### Step 1 — 登入

```http
POST /api/game-auth/login
Content-Type: application/json

{
  "clientId": "unity-hall-a",
  "clientSecret": "xxxxxxxx"
}
```

回應：

```json
{
  "data": {
    "token": "eyJhbG...",
    "expiresAt": "2026-07-30T10:00:00.000Z"
  }
}
```

`token` 為 JWT，預設約 30 日有效，之後 API 請求帶：

```
Authorization: Bearer <token>
```

---

### Step 2 — 建立 Session + 取得 QR

```http
GET /api/games/{sectionId}/info
Authorization: Bearer <token>
```

回應重點：

```json
{
  "data": {
    "session": {
      "_id": "674a1b2c3d4e5f6789012345",
      "socketCode": "ABC12XYZ",
      "status": "created",
      "expiresAt": "..."
    },
    "qr": {
      "joinUrl": "https://domain/play/674a...?sig=...&code=ABC12XYZ",
      "imageUrl": "https://domain/api/games/sessions/674a.../qrcode.png?sig=...",
      "sig": "..."
    },
    "section": {
      "hasGiftA": true,
      "hasGiftB": true,
      "playtime": {
        "withinHours": true,
        "start": "10:30",
        "end": "19:30",
        "timezone": "Asia/Hong_Kong"
      },
      "scoreThresholds": {
        "minPrizeScore": 100,
        "giftAMaxScore": 400
      }
    }
  }
}
```

Game Client 應：
- 儲存 **`sessionId`**、**`socketCode`**
- 用 `qr.joinUrl` 或 `qr.imageUrl` 顯示俾玩家掃描
- 狀態設為 **`created`**（等待掃描）

---

### Step 3 — 連接 Socket.io

連線後**立即** emit `gameClient:join`（顯示 QR 之前必須已 join room）：

```javascript
const socket = io('https://your-server.com', { path: '/socket.io' });

socket.on('connect', () => {
  socket.emit('gameClient:join', {
    sessionId: '674a1b2c3d4e5f6789012345',
    sectionId: '674a1b2c3d4e5f6789012346',
  });
});
```

Server 將 socket 加入：
- `session:{sessionId}`
- `section:{sectionId}`

> ⚠️ 必須喺玩家掃 QR **之前**完成 Step 3，否則收唔到 `session:bound`。

---

### Step 4 — 監聽玩家進度

見 [第三節 Socket 事件](#三socket-事件)。

---

### Step 5 — 遊戲完成後提交分數

```http
POST /api/games/sessions/{sessionId}/submit-score
Authorization: Bearer <token>
Content-Type: application/json

{ "score": 250 }
```

回應含 `giftType`、`giftNumber`、`giftStatus`、`resultUrl` 等。

---

### Step 6 — 下一局

斷開舊 Socket（如有）→ 重複 **Step 2–5**（新 `sessionId`、新 QR、新 Socket 連線）。

---

## 三、Socket 事件

### Game Client → Server

#### `gameClient:join`

| 項目 | 說明 |
|------|------|
| 時機 | Socket `connect` 後立即 |
| Payload | `{ sessionId, sectionId }` |

```json
{
  "sessionId": "674a1b2c3d4e5f6789012345",
  "sectionId": "674a1b2c3d4e5f6789012346"
}
```

---

### Server → Game Client

處理事件時建議過濾：`data.sessionId === 目前 sessionId`

#### `session:bound` — 玩家已掃描 QR

| 項目 | 說明 |
|------|------|
| 觸發 | 玩家首次連線（`created` → `connected`） |
| 次數 | 每個 session **只發一次** |

```json
{
  "sessionId": "674a1b2c3d4e5f6789012345",
  "socketCode": "ABC12XYZ",
  "status": "connected",
  "playerConnectedAt": "2026-06-30T10:35:00.000Z"
}
```

#### `session:updated` — 狀態更新

| `status` | 意義 |
|----------|------|
| `connected` | 玩家已連線 |
| `terms_accepted` | 已同意條款 |
| `registered` | 已登記 email |
| `playing` | 遊戲進行中 |
| `finished` | 已提交分數 |

#### `session:game-start` — 遊戲開始

玩家手機撳「開始遊戲」後觸發。

```json
{
  "sessionId": "...",
  "status": "playing",
  "email": "user@example.com",
  "gameStartedAt": "..."
}
```

#### `game:scoreSubmitted` — 分數已提交

```json
{
  "sessionId": "...",
  "score": 200,
  "giftType": "A",
  "giftNumber": "000001",
  "giftStatus": "awarded",
  "hasPrize": true,
  "resultUrl": "https://...",
  "resultQrImageUrl": "https://..."
}
```

---

## 四、完整時序

```
Game Client（自訂）                  Server                          玩家手機
    │                                  │                                │
    │ ① POST /api/game-auth/login      │                                │
    │─────────────────────────────────►│                                │
    │◄──────────── token ──────────────│                                │
    │                                  │                                │
    │ ② GET /api/games/:sectionId/info │                                │
    │─────────────────────────────────►│                                │
    │◄── session + QR (status:created) │                                │
    │                                  │                                │
    │ ③ io.connect + gameClient:join   │                                │
    │─────────────────────────────────►│                                │
    │  【顯示 QR，等待掃描】              │                                │
    │                                  │                                │
    │                                  │◄── 玩家掃 QR、player:join ─────│
    │◄── session:bound ────────────────│                                │
    │◄── session:updated ──────────────│  status: connected             │
    │                                  │                                │
    │                                  │◄── accept-terms ───────────────│
    │◄── session:updated ──────────────│  status: terms_accepted        │
    │                                  │                                │
    │                                  │◄── register-email ─────────────│
    │◄── session:updated ──────────────│  status: registered           │
    │                                  │                                │
    │                                  │◄── start-game ─────────────────│
    │◄── session:game-start ───────────│  status: playing               │
    │                                  │                                │
    │  【Game Client 運行遊戲】          │                                │
    │                                  │                                │
    │ ④ POST submit-score ─────────────►│                                │
    │◄── game:scoreSubmitted ──────────│                                │
    │                                  │                                │
    │ ⑤ 下一局 → 重複 ②–④              │                                │
```

---

## 五、狀態對照

| Server `status` | 建議 Game Client 處理 |
|-----------------|----------------------|
| `created` | 顯示 QR，等待掃描 |
| `connected` | 玩家已掃描，可提示準備 |
| `terms_accepted` | 玩家閱讀條款中 |
| `registered` | 玩家已登記 email |
| `playing` | 可開始／進行遊戲 |
| `finished` | 本局結束，顯示結果 |

---

## 六、參考程式（最小整合）

```javascript
import { io } from 'socket.io-client';

const BASE_URL = 'https://meow.ice-solution.hk';
const clientId = 'unity-hall-a';
const clientSecret = 'xxxxxxxx';
const sectionId = '674a1b2c3d4e5f6789012346';

// 1. 登入
const { data: auth } = await fetch(`${BASE_URL}/api/game-auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ clientId, clientSecret }),
}).then((r) => r.json());

const token = auth.token;

// 2. 建立 session
const { data: info } = await fetch(`${BASE_URL}/api/games/${sectionId}/info`, {
  headers: { Authorization: `Bearer ${token}` },
}).then((r) => r.json());

const sessionId = info.session._id;
const joinUrl = info.qr.joinUrl;

// 3. Socket
const socket = io(BASE_URL, { path: '/socket.io' });

socket.on('connect', () => {
  socket.emit('gameClient:join', { sessionId, sectionId });
});

socket.on('session:bound', (data) => {
  if (data.sessionId === sessionId) onPlayerScanned();
});

socket.on('session:game-start', (data) => {
  if (data.sessionId === sessionId) onGameStart();
});

socket.on('game:scoreSubmitted', (data) => {
  if (data.sessionId === sessionId) onRoundComplete(data);
});

// 4. 遊戲結束後提交分數
async function submitScore(score) {
  const res = await fetch(`${BASE_URL}/api/games/sessions/${sessionId}/submit-score`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ score }),
  });
  return res.json();
}
```

---

## 七、部署（Server 端）

Game Client 連去同一 domain 時，Server 需支援 WebSocket：

```apache
# 需要 Apache 2.4.47+ 及：sudo a2enmod proxy proxy_http proxy_wstunnel headers
# Cloudflare：Network → WebSockets = On

# Socket.io（polling + websocket 同一條，必須在 ProxyPass / 之前）
ProxyPass        /socket.io/ http://127.0.0.1:3001/socket.io/ upgrade=websocket retry=0
ProxyPassReverse /socket.io/ http://127.0.0.1:3001/socket.io/

ProxyPass        / http://127.0.0.1:3001/
ProxyPassReverse / http://127.0.0.1:3001/
```

Cloudflare：**WebSockets = On**

Server `.env`：

```env
CLIENT_URL=https://meow.ice-solution.hk
NODE_ENV=production
```

`CLIENT_URL` 用於 QR `joinUrl` 內的玩家連結 domain。

---

## 八、常見問題

| 問題 | 檢查 |
|------|------|
| 401 登入失敗 | `clientId` / `clientSecret`；GameClient `isActive: true` |
| 無法建立 session | `sectionId` 是否存在；token 是否過期 |
| 收不到 `session:bound` | 是否已 emit `gameClient:join`；`sessionId` 是否一致；是否喺玩家掃碼前已連 Socket |
| WebSocket 斷線 / Socket 500 | Apache 是否用 Rewrite 分開 polling（http）同 upgrade（ws）；見 `deploy/apache/meow.ice-solution.hk.conf` |
| QR 連結 domain 錯 | Server `CLIENT_URL` 是否為正式 HTTPS domain |

---

## 九、Server 相關檔案

| 檔案 | 說明 |
|------|------|
| `server/socket.js` | `gameClient:join`、廣播事件 |
| `server/routes/games.js` | `GET /:sectionId/info`、`submit-score` |
| `server/routes/gameAuth.js` | `POST /login` |
| `server/routes/gameClients.js` | 建立 Game Client 憑證 |
| `deploy/apache/meow.ice-solution.hk.conf` | WebSocket proxy |

> 備註：repo 內 `client/src/pages/GameClientPage.jsx`（`/display`）僅作開發測試參考，**正式現場唔需要使用**。
