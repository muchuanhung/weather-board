# `/api/weather` 契約

給前端串接用。對應程式：[`app/api/weather/route.js`](app/api/weather/route.js)。欄位跟格式還在跟統籌、前端對，想調整的地方都可以在 PR 底下討論。

## 請求

```
GET /api/weather?city=Taipei
```

- `city` 不帶、空字串或只有空白 → 預設查台北
- 支援英文拼音（`Taipei`）、中文簡稱（`台北`、`台中`）、官方全名（`臺北市`、`臺南市`）
- 「台」與「臺」的簡稱／全名都支援，例如 `台北`、`臺北`、`台北市`、`臺北市`；英文不分大小寫。

## 成功回應（200）

以下為示意數值，預報陣列只展示兩筆，並非實際即時回應。

```json
{
  "city": "臺北市",
  "query": "Taipei",
  "updatedAt": "2026-09-22T12:00:00+08:00",
  "current": {
    "temperature": 28,
    "feelsLike": 30,
    "description": "多雲",
    "kind": "cloud",
    "humidity": 65,
    "windSpeed": 12,
    "pressure": 1008,
    "uvIndex": 5,
    "updatedAt": "2026-09-22T12:00:00+08:00",
    "sunrise": "05:30",
    "sunset": "18:10"
  },
  "hourlyForecast": [
    { "time": "現在", "temperature": 28, "kind": "sun" },
    { "time": "13:00", "temperature": 29, "kind": "sun" }
  ],
  "dailyForecast": [
    { "day": "今天", "date": "9月22日", "high": 30, "low": 25, "kind": "partly", "rainChance": 20 },
    { "day": "明天", "date": "9月23日", "high": 31, "low": 25, "kind": "sun", "rainChance": 10 }
  ]
}
```

`hourlyForecast` / `dailyForecast` 沿用 `lib/weather-data.js` 的欄位名稱；真實資料可能有 `null`。前端需接入 API 資料及缺值顯示。`current` 共 11 個欄位。

### 畫面欄位對應

對照 `components/weather/weather-sections.jsx` 的設計稿：

| 畫面位置                | API 欄位                                          |
| ----------------------- | ------------------------------------------------- |
| 現在天氣卡片 · 大字溫度 | `current.temperature`                             |
| 現在天氣卡片 · 天氣描述 | `current.description`                             |
| 現在天氣卡片 · 天氣圖示 | `current.kind`                                    |
| 現在天氣卡片 · 體感     | `current.feelsLike`                               |
| 現在天氣卡片 · 今日最高 | `dailyForecast` 中 `day === "今天"` 那筆的 `high` |
| 現在天氣卡片 · 今日最低 | 同一筆的 `low`                                    |
| 現在天氣卡片 · 濕度     | `current.humidity`                                |
| 現在天氣卡片 · 風速     | `current.windSpeed`                               |
| 現在天氣卡片 · 氣壓     | `current.pressure`                                |
| 現在天氣卡片 · 時間標籤 | `current.updatedAt`                               |
| 日出日落卡片 · 日出     | `current.sunrise`                                 |
| 日出日落卡片 · 日落     | `current.sunset`                                  |
| 逐時預報                | `hourlyForecast`                                  |
| 逐日預報                | `dailyForecast`                                   |

`current.uvIndex` 目前設計稿沒有對應位置。今日最高／最低溫沒有放進 `current`，因為那是預報值而非即時觀測值。

### 欄位與來源

- `city`：解析後的官方縣市名稱。
- `query`：去掉首尾空白後的查詢；使用預設城市時為 `Taipei`。
- `updatedAt`：與 `current.updatedAt` 相同，優先使用觀測時間，其次為預報第一筆時間，兩者皆無時使用伺服器現在時間；不是所有資料集的共同更新時間。格式為 ISO 8601 含時區（`2026-09-22T16:10:00+08:00`），不是可直接顯示的文字，由前端自行格式化，例如 `new Date(updatedAt).toLocaleTimeString('zh-TW', { hour: 'numeric', minute: '2-digit' })`。保留時間戳是為了讓「資料更新於 N 分鐘前」這類相對時間也能計算。
- `current.temperature`：優先使用觀測溫度，缺值時使用逐時預報第一筆。
- `current.feelsLike`：逐時預報第一筆體感溫度，缺值時使用 `current.temperature`。
- `current.humidity`：優先使用觀測濕度，缺值時使用逐時預報第一筆。
- `current.description` / `kind`：優先使用觀測天氣描述，其次為預報；描述皆缺少時為 `—`。`kind` 為 `sun`／`partly`／`cloud`／`rain`／`moon`。目前無法判讀的描述仍使用預設日夜圖示，不代表已確認晴天。`description` 字數不固定：觀測用語較短（實測到 `晴`、`多雲`、`陰`、`陰有雨`、`陰有靄`），改用預報時較長（實測到 `晴時多雲`、`多雲時晴`、`多雲時陰`、`陰時多雲`、`多雲短暫陣雨`）。版面不要寫死寬度。
- `current.windSpeed`／`pressure`／`uvIndex`：來自觀測站；風速為 km/h，氣壓為 hPa。溫度為 °C，濕度與降雨機率為百分比。
- `current.sunrise`／`sunset`：來自獨立的日出日落資料集，格式 `HH:mm`，是否缺值與觀測站是否存在無直接關係。
- `hourlyForecast`：預報資料前 8 筆，第一筆標籤為「現在」。這是預報第一筆，未保證與即時觀測時間相同。
- `dailyForecast`：最多 7 個有溫度時段的日期，依臺灣日期排序，略過今天之前的日期。按時段 `StartTime` 的臺灣日期分組：今天 18:00 至明天 06:00 歸今天，明天白天歸明天。這是預報時段歸屬，並非精確的 00:00–24:00 統計。
- 每日 `high`／`low`／`rainChance` 分別取同組有效值的最大／最小／最大值；各因子按日期對齊，不假設陣列索引一致。`kind` 優先取同組白天最早的天氣描述，沒有白天資料時使用該組最早時段。
- `day` 的「今天／明天」以請求當下的臺灣日期判斷，其他日期使用星期名稱。

### 缺值處理

以下欄位型別為 `number | null`：

- `current.temperature`／`feelsLike`／`humidity`／`windSpeed`／`pressure`／`uvIndex`
- `hourlyForecast[].temperature`
- `dailyForecast[].high`／`low`／`rainChance`

`current.sunrise`／`sunset` 為 `string | null`。

上游數值為 `-99`、`-999`、空值或無法轉成有限數字時，視為缺值。有備援或同組其他有效值時使用有效值，全部缺少才回 `null`。真正的 `0`（例如 0°C、0%）保留為 `0`。前端可用 `value == null` 判斷是否顯示 `--`，不要以 `!value` 把真正的零當缺值。

## 錯誤回應

查無城市 → 400：

```json
{
  "error": "city_not_found",
  "message": "找不到城市「XXX」，請用臺灣縣市名稱或常見英文拼音，例如 Taipei、Kaohsiung、台中。"
}
```

逐時／一週預報請求失敗、缺少必要預報時段、資料無法處理，或伺服器未設定授權碼 → 502：

```json
{ "error": "upstream_error", "message": "氣象資料取得失敗，請稍後再試" }
```

錯誤格式固定為 HTTP status + `error` + `message`。`message` 可顯示給使用者；502 不回傳授權設定、上游網址或內部錯誤細節。

觀測站或日出日落單獨失敗，不會讓整個請求回 502；觀測欄位使用上述備援規則，日出日落回 `null`。成功的 200 回應須包含非空的逐時及逐日預報陣列，但其中個別數值仍可為 `null`。

## 本次後端修正（9/22 本地完成）

- 「台／臺」簡稱及全名皆可查詢。
- 逐日預報依臺灣日期分組，修正隔天白天併入今天的問題。
- 缺測溫度及降雨機率保留 `null`，不再補成 `0`。
- 缺少必要預報時段回 502；使用一致、可供使用者閱讀的錯誤訊息。

上述修正沿用 API 欄位名稱；前端串接時需留意數值的 `null` 型別，包含 `rainChance`。

## 後端驗證

本地驗證結果：7 項回歸測試全部通過，webpack production build 通過。執行方式：

```bash
TZ=UTC node --test app/api/weather/__tests__/weather.test.mjs
pnpm exec next build --webpack
```

自動測試使用模擬的 CWA 回應，涵蓋城市解析、日期分組、缺值及 200／400／502 回應。

真實 CWA 連線已於 9/22 在本機驗證完成，22 縣市全部回 200，查無城市回 400。實際回應範例見 [PR #4 留言](https://github.com/muchuanhung/weather-board/pull/4)。

線上部署尚未驗證通過：Preview 部署目前回 502，原因是 Vercel 尚未設定 `CWA_API_KEY`。設定後重打下列網址應回 200：

```
https://weather-board-git-feat-weather-api-muchuanhungs-projects.vercel.app/api/weather?city=Taipei
```

部署與 PR 進度記錄於 [TODO-backend.md](./TODO-backend.md)。
