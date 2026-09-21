# 後端待辦 — 莊宗霖

切塊 **A. 資料與 API**。認領：`lib/weather-data.js`、`app/api/weather/`（待建）。選做 webhook 也放這裡。

對齊排程見 [README.md](./README.md#排程)。

## 檔案範圍

**可以改**

- `lib/weather-data.js`（資料形狀，見檔內註解）
- `app/api/weather/`（取得並整理；`route.js`）
- 選做：Discord webhook 相關

**不要動**

- `app/page.jsx`
- `components/weather/*`
- `app/globals.css`

## 9/22（二）

- [ ] Fork Host Repo，開分支 `feat/weather-api`
- [ ] 與統籌確認 API 契約（query：`city`；response：現在天氣＋預報欄位，對齊 `lib/weather-data.js`）
- [ ] 選定資料源（CWA／Open-Meteo 等），申請／設定 API key（用 env，勿 commit）
- [ ] 建 `app/api/weather/route.js`：至少回台北 mock 或真資料其一，形狀先對

## 9/23（三）

- [ ] 完成「現在天氣」欄位：溫度、體感、天氣描述／kind、更新時間
- [ ] 完成「簡單預報」：逐時 **或** 逐日至少一組；兩個都有更好
- [ ] 支援 `?city=`（至少常見台灣城市；找不到回明確 error JSON）
- [ ] 自測：`curl`／瀏覽器打通；在 PR 註解貼一筆成功／失敗 response 範例
- [ ] （選做，有剩）Discord Webhook：天氣摘要推一則

## 9/24（四）中午前

- [ ] 開 PR 進 Host，跟前端對過欄位後合併；衝突只動 A 區檔案
- [ ] 確認部署環境變數已設好，線上 API 能打

## 本週驗收

- `GET /api/weather?city=Taipei`（或約定城市名）回可被前端直接吃的 JSON
- 至少：現在天氣＋一種預報
- key 不進 git；線上 env 有設
