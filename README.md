# weather-board

Wehelp 三人小組的氣象看板。

## 網站

| 環境 | 連結                                    |
| ---- | --------------------------------------- |
| 線上 | https://weather-board-liart.vercel.app/ |
| 本機 | http://localhost:3000                   |

## 分工

三人。前端、後端各認領一塊，檔案盡量不重疊；統籌不搶寫業務碼，負責把範圍與交付釘死。

| 角色 | 負責人 | 切塊                | 本週交出                                                                             |
| ---- | ------ | ------------------- | ------------------------------------------------------------------------------------ |
| 後端 | 莊宗霖 | A. 資料與 API       | 氣象資料取得，整理成前端好用的格式。                               |
| 前端 | 鍾旻瑞 | B. 介面與互動       | 頁面結構、列表／詳情、接上資料、基本操作（搜尋、切換城市）；版面／色票／RWD 一併收斂 |
| 統籌 | 洪睦筌 | C. 規格／排程／交付 | 開規格書、確認排程、跑 CI、Discord 推播、部署、README 連結、截圖、簡報、整合 demo |


### 待辦清單

- 統籌：[TODO-lead.md](./TODO-lead.md)（洪睦筌）
- 後端：[TODO-backend.md](./TODO-backend.md)（莊宗霖）
- 前端：[TODO-frontend.md](./TODO-frontend.md)（鍾旻瑞）


## 本機

```bash
pnpm install
pnpm dev
```

開 http://localhost:3000 。

## 天氣 API

`GET /api/weather?city=Taipei`，資料源是 [Open-Meteo](https://open-meteo.com/)（免申請 API key）。

回傳形狀對齊 [`test/weather-contract.mjs`](./test/weather-contract.mjs)：`current` / `hourly` / `daily`。
城市支援二十個縣市，`台北`、`臺北市`、`Taipei` 都吃得下；查不到回 400 並列出支援清單。

## Discord 推播

降雨機率偏高時，透過 Webhook 把天氣摘要推到 Discord；Vercel Cron 每天台北時間 08:00／17:00 各跑一次（預設台北）。

線上要在 Vercel 設定 `DISCORD_WEBHOOK_URL`、`CRON_SECRET`（其餘選填見 [`.env.example`](./.env.example)）。Webhook URL 與 secret **不要**寫進 git、截圖或投影片。

本機把同樣變數放進 `.env.local` 即可；細節與測試方式見程式註解／`TODO-lead.md`。