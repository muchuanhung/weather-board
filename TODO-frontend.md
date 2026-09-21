# 前端待辦 — 鍾旻瑞

切塊 **B. 介面與互動**。認領：`app/page.jsx`、`components/weather/*`、`app/globals.css`。只消費後端輸出的格式，不自己打外部氣象 API。

對齊排程見 [README.md](./README.md#排程)。

## 檔案範圍

**可以改**

- `app/page.jsx`
- `components/weather/weather-sections.jsx`
- `components/weather/weather-icons.jsx`
- `app/globals.css`（色票／版面／RWD）

**不要動**

- `app/api/weather/`
- 氣象 API key
- webhook

## 9/22（二）

- [ ] Fork Host Repo，開分支 `feat/weather-ui`
- [ ] 跟後端對齊契約：元件 props／fetch 只吃 `lib/weather-data.js` 的資料形狀（或後端 export 的同一份）
- [ ] 把 `CurrentWeatherCard`、`HourlyForecast`／`DailyForecast` 從寫死常數改成吃 props／state
- [ ] 搜尋／切換城市：送出後打 `/api/weather?city=...`（先用假 fetch＋loading／error UI 也行）

## 9/23（三）

- [ ] 接上後端真實 response；loading、空資料、錯誤訊息都要有
- [ ] 現在天氣＋至少一種預報畫面完整可看
- [ ] 色票／版面收斂、RWD（手機一欄、桌機雙欄不要炸）
- [ ] 自測桌機＋手機寬度；PR 附一張截圖

## 9/24（四）中午前

- [ ] 開 PR 進 Host，跟後端串完後合併；衝突只動 B 區檔案
- [ ] 確認線上頁面能搜城市、能看到真資料（不是只有台北靜態）

## 本週驗收

- 搜尋／切換城市有作用，畫面吃的是 API 資料
- 現在天氣＋至少一種預報可看
- 手機寬度不炸；PR 有截圖
