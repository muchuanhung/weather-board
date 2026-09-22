# 後端待辦 — 莊宗霖

切塊 **A. 資料與 API**。認領：`lib/weather-data.js`、`app/api/weather/`（已建立）。選做 webhook 也放這裡。

對齊排程見 [README.md](./README.md#排程)。

API 串接規格見 [API-CONTRACT.md](./API-CONTRACT.md)。目前後端實作與本地回歸測試已完成；真實 CWA 連線、PR 回應範例及部署驗證仍待完成。

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

- [x] Fork Host Repo，開分支 `feat/weather-api`
- [x] 與統籌確認 API 契約（query：`city`；response：現在天氣＋預報欄位，對齊 `lib/weather-data.js`）
- [x] 選定資料源（CWA／Open-Meteo 等），申請／設定 API key（用 env，勿 commit）
- [x] 建 `app/api/weather/route.js`：至少回台北 mock 或真資料其一，形狀先對

## 9/23（三）

- [x] 完成「現在天氣」欄位：溫度、體感、天氣描述／kind、更新時間
- [x] 完成「簡單預報」：已提供逐時與逐日兩組預報
- [x] 支援 `?city=`（英文拼音、中文簡稱／全名、「台／臺」皆可；找不到回 400 error JSON）
- [ ] 自測：`curl`／瀏覽器打通；在 PR 註解貼一筆成功／失敗 response 範例
- [ ] （選做，有剩）Discord Webhook：天氣摘要推一則

## 本地 review 修復與驗證（9/22）

- [x] 修正「臺」開頭城市簡稱查無城市
- [x] 逐日預報依時段開始的臺灣日期分組，各氣象因子按日期對齊
- [x] 缺測溫度／降雨機率保留 `null`，有效的 `0` 不受影響
- [x] 缺少必要預報時段回 502，統一對外錯誤訊息
- [x] 更新 [API 契約](./API-CONTRACT.md)：11 個 current 欄位、缺值型別、日期歸屬與錯誤條件
- [x] 7 項回歸測試通過：`TZ=UTC node --test app/api/weather/__tests__/weather.test.mjs`
- [x] Production build 通過：`pnpm exec next build --webpack`

回歸測試使用模擬 CWA 回應，已驗證 200／400／502 與觀測資料缺少時的備援行為；不代表真實 CWA 連線或部署已通過驗證。

## 9/24（四）中午前

- [ ] 開 PR 進 Host，跟前端對過欄位後合併；衝突只動 A 區檔案
- [ ] 確認部署環境變數已設好，線上 API 能打

## 本週驗收

- `GET /api/weather?city=Taipei`（或約定城市名）回可被前端直接吃的 JSON
- 至少：現在天氣＋一種預報
- key 不進 git；線上 env 有設
