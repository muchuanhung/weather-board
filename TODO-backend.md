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
- [x] 自測：`curl`／瀏覽器打通；在 PR 註解貼一筆成功／失敗 response 範例
- [x] （選做，有剩）Discord Webhook：天氣摘要推一則（由統籌實作於 `app/api/discord/notify`）

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

- [x] 開 PR 進 Host，跟前端對過欄位後合併；衝突只動 A 區檔案（PR #4 已合併）
- [x] 確認部署環境變數已設好，線上 API 能打（`CWA_API_KEY` 已設；production 實測 Taipei、高雄回 200。22 縣市全測是在本機完成，線上僅抽驗）

## Agent 日期比對修正（9/24）

PR #10 合併後補修 `app/api/agent/route.js` 的規則備援路徑（未設定 LLM key 或 LLM 失敗時使用）：

- 日期比對改用 `date` 還原真實日期，不再拿 `day` 比對星期——原本今天是週六時，問「週六」「週末」都會查無資料
- 區間只支援「日期＋到／至／~／～＋日期」（允許空白）；「週四到公司，週日去公園」只選週四、週日
- 保留起訖方向；反向區間或端點含不同週末（例如週日問「明天到週末」）明確請使用者拆開問，不回傳顛倒的日期
- 區間由問題語意計算，起點缺資料時仍能回傳範圍內其他日期
- `lib/agent-llm.js` 補 `stop_reason === 'max_tokens'` 檢查，截斷時退回規則答案而非回半句（跨區修改，已知會統籌）
- 新增 `app/api/agent/__tests__/agent.test.mjs`，23 項測試；區間修正新增 5 項、複審另補 1 項混合區間測試，涵蓋連接詞、反向區間及週日邊界
- 驗證：Agent 23 項＋Weather 7 項＋契約 22 項，共 52/52 通過；修改的 JS 通過 ESLint，四份修改檔已用 Prettier 格式化；`pnpm build` 通過，三支 API route 正常註冊
- 另將 production 的真實預報資料帶入本地修正程式，6 種提問結果符合預期；這不是修正版本已部署上線的驗證
- 狀態：待開 PR 給統籌 review；尚未部署

### Agent 規則備援的日期範圍（9/24 工作區修正，尚未部署）

以下只適用於 `/api/agent` 的規則備援（未設定 LLM key 或 LLM 失敗時），不改動 `/api/weather` 的回應欄位：

- 只將「日期＋到／至／~／～＋日期」視為區間，允許連接詞前後有空白。中間有其他文字或標點時不展開，例如「週四到公司，週日去公園」只選週四、週日。
- 區間保留起訖方向。反向／跨週範圍或不連續的週末端點（例如週日問「明天到週末」）暫不支援，`answer` 會明確請使用者拆開問；仍使用原本的成功回應與 `mode: "rules"`。
- 可判讀的範圍只回傳實際存在的預報日期，缺資料不補造。若完全沒有符合的資料，回答查無該日期資訊，與無法判讀區間分開處理。
- `date` 缺失時可以從「今天／明天」標籤推得日期，因此週六當天的「今天」也能匹配「週六」。
- 這是有限的關鍵字比對，不是完整中文日期解析。「大後天」「下週四」尚未支援，仍可能被其中的「後天」「週四」命中；單問「週末」仍選七天內的週六／週日，週日當天可能包含不同週末。本輪只修正區間判斷。

一句話只要有一段區間無法判讀，整句都會請使用者拆開問，不回傳其中合法的部分。例如「週四到週五，週日到週三」。回覆會包含查詢城市名稱。

## 本週驗收

- `GET /api/weather?city=Taipei`（或約定城市名）回可被前端直接吃的 JSON
- 至少：現在天氣＋一種預報
- key 不進 git；線上 env 有設
