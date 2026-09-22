# 統籌待辦 — 洪睦筌

切塊 **C. 規格／排程／交付**。職責：開規格書、確認排程、跑 CI、部署、README、截圖、投影片簡報初稿、整合 demo。不搶寫前後端業務碼。

對齊排程見 [README.md](./README.md#排程)。前端／後端待辦：[TODO-frontend.md](./TODO-frontend.md)、[TODO-backend.md](./TODO-backend.md)。

## 檔案範圍

**可以改**

- 本 README、規格書（契約／驗收）
- CI／部署設定（如 GitHub Actions、Vercel）
- 截圖、投影片簡報

**不要動（除非卡關救火）**

- `app/api/weather/`、氣象資料邏輯（後端）
- `app/page.jsx`、`components/weather/*`、`app/globals.css`（前端）

## 分支

- `dev` — 整合／部署基準
- `frontend` — 鍾旻瑞
- `backend` — 莊宗霖

## 9/22（二）

- [x] Host Repo／基礎專案就緒；兩人能 Fork
- [x] 開規格書丟群：API 契約（對齊 `lib/weather-data.js` 資料形狀）、必做範圍、驗收條件、檔案認領
- [x] 確認排程：二～三各自開發、四中午前合併、四 23:59 交連結＋投影片簡報初稿
- [x] CI 骨架起來（至少 build 過）
- [x] 部署骨架起來（先能 deploy 現有頁；線上連結先佔位也行）
- [x] 開好三個分支：`frontend`、`backend`、`dev`

## 9/23（三）

- [ ] 盯進度：後端 shape／API、前端 props／fetch 是否對齊契約
- [x] 解卡關（契約爭議、env、權限）；仍不進 A／B 業務檔
- [x] CI 綠燈維持；必要時補環境變數說明（不把 key 寫進 git）
- [x] 投影片簡報大綱起稿（分工、demo、接法、心得）

## 9/24（四）中午前

- [ ] 合併前後端進 `main`；修衝突（只協調，業務碼仍歸原負責人）
- [ ] 串起來驗收：現在天氣＋簡單預報、搜尋／城市有作用
- [ ] README 補齊：分工表、線上成果連結
- [ ] 截圖至少一張（桌機或手機）

## 9/24（四）23:59 前

- [ ] Host Repo 連結私訊彭彭
- [ ] 投影片簡報初稿完成（可交）← **目前剩這塊**
- [ ] 線上連結再確認一次能開

## 本週驗收（統籌視角）

- 規格書有、排程有、兩人待辦有人勾
- Host 可交、線上可開、README 有分工＋連結
- 投影片簡報初稿交得出；Webhook／Agent 沒做就寫下一步，不硬充
