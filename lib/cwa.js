// 中央氣象署（CWA）開放資料平台 client。
// 文件：https://opendata.cwa.gov.tw/dist/opendata-swagger.html
//
// 用到的四個資料集：
// - O-A0003-001：現在天氣觀測報告（即時測站資料，逐分鐘更新）
// - F-D0047-089：臺灣各縣市鄉鎮未來3天天氣預報（溫度/體感逐時，天氣現象逐3小時）
// - F-D0047-091：臺灣各縣市鄉鎮未來1週天氣預報（逐12小時）
// - A-B0062-001：日出日沒時刻表

const CWA_BASE = 'https://opendata.cwa.gov.tw/api/v1/rest/datastore'

class CwaError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CwaError'
  }
}

async function cwaFetch(resourceId, params) {
  const key = process.env.CWA_API_KEY
  if (!key) {
    throw new CwaError('伺服器未設定 CWA_API_KEY，請在 .env.local 加入授權碼')
  }

  const search = new URLSearchParams({ Authorization: key, format: 'JSON', ...params })
  const res = await fetch(`${CWA_BASE}/${resourceId}?${search.toString()}`, {
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new CwaError(`CWA API（${resourceId}）回傳 HTTP ${res.status}`)
  }

  const data = await res.json()
  if (data.success !== 'true' && data.success !== true) {
    throw new CwaError(`CWA API（${resourceId}）查詢失敗`)
  }
  return data
}

// 現在天氣觀測。查無此測站或測站無資料時回傳 null，不丟錯（讓上層改用預報資料補）。
export async function fetchCurrentObservation(stationName) {
  if (!stationName) return null
  try {
    const data = await cwaFetch('O-A0003-001', { StationName: stationName })
    return data.records?.Station?.[0] ?? null
  } catch {
    return null
  }
}

// 未來 3 天逐時預報（溫度/體感每小時一筆，天氣現象每 3 小時一筆）
export async function fetchHourlyForecast(countyName) {
  const data = await cwaFetch('F-D0047-089', { LocationName: countyName })
  return data.records?.Locations?.[0]?.Location?.[0] ?? null
}

// 未來 1 週逐 12 小時預報
export async function fetchWeeklyForecast(countyName) {
  const data = await cwaFetch('F-D0047-091', { LocationName: countyName })
  return data.records?.Locations?.[0]?.Location?.[0] ?? null
}

// 日出日沒時刻。查不到時回傳 null（非必要欄位，不影響主要天氣資料）。
export async function fetchSunTimes(countyName, dateStr) {
  try {
    const data = await cwaFetch('A-B0062-001', { CountyName: countyName, Date: dateStr })
    return data.records?.locations?.location?.[0]?.time?.[0] ?? null
  } catch {
    return null
  }
}

export { CwaError }
