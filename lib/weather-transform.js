// 把 CWA 原始資料轉成 /api/weather 要回傳、前端可以直接吃的形狀。
// hourlyForecast / dailyForecast 的欄位刻意對齊 lib/weather-data.js 現有的 mock 資料，
// 前端可沿用欄位名稱，並接入 API 資料及 null 顯示處理。

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function textToKind(text, isNight) {
  if (!text) return isNight ? 'moon' : 'sun'
  if (/雷|雨/.test(text)) return 'rain'
  if (/晴.*雲|雲.*晴/.test(text)) return isNight ? 'moon' : 'partly'
  if (/陰|多雲/.test(text)) return 'cloud'
  if (/晴/.test(text)) return isNight ? 'moon' : 'sun'
  return isNight ? 'moon' : 'sun'
}

// 統一轉成臺灣時間，亦支援備援時間戳的 Z（UTC），不依賴主機時區。
function parseTaipeiTime(isoString) {
  const d = new Date(new Date(isoString).getTime() + 8 * 60 * 60 * 1000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    weekday: d.getUTCDay(),
  }
}

function taipeiDateKey(isoString) {
  const { year, month, day } = parseTaipeiTime(isoString)
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function isNightTime(isoString) {
  const { hour } = parseTaipeiTime(isoString)
  return hour >= 18 || hour < 6
}

function findElement(weatherElement, name) {
  return weatherElement?.find((el) => el.ElementName === name) ?? null
}

function find3HourWindow(timeEntries, targetIso) {
  const target = new Date(targetIso).getTime()
  return (
    timeEntries.find((entry) => {
      const start = new Date(entry.StartTime).getTime()
      const end = new Date(entry.EndTime).getTime()
      return target >= start && target < end
    }) ?? timeEntries[0]
  )
}

function formatHourLabel(isoString, index) {
  if (index === 0) return '現在'
  const { hour } = parseTaipeiTime(isoString)
  return `${String(hour).padStart(2, '0')}:00`
}

function formatDayLabel(isoString, now) {
  const dateKey = taipeiDateKey(isoString)
  if (dateKey === taipeiDateKey(now)) return '今天'
  if (dateKey === taipeiDateKey(new Date(new Date(now).getTime() + 86400000))) return '明天'
  return WEEKDAY_NAMES[parseTaipeiTime(isoString).weekday]
}

function formatDateLabel(isoString) {
  const { month, day } = parseTaipeiTime(isoString)
  return `${month}月${day}日`
}

function toNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return null
  const n = Number(value)
  if (!Number.isFinite(n)) return null
  // CWA 用 -99 / -999 表示該測站缺這項資料
  if (n <= -90) return null
  return n
}

function roundNullable(value) {
  return value === null ? null : Math.round(value)
}

// F-D0047-089 -> [{ time, temperature, kind }]
export function buildHourlyForecast(hourlyLocation, count = 8) {
  const temperature = findElement(hourlyLocation?.WeatherElement, '溫度')
  const weather = findElement(hourlyLocation?.WeatherElement, '天氣現象')
  if (!temperature) return []

  return (temperature.Time ?? []).slice(0, count).map((entry, index) => {
    const window = weather ? find3HourWindow(weather.Time, entry.DataTime) : null
    const text = window?.ElementValue?.[0]?.Weather
    return {
      time: formatHourLabel(entry.DataTime, index),
      temperature: roundNullable(toNumber(entry.ElementValue?.[0]?.Temperature)),
      kind: textToKind(text, isNightTime(entry.DataTime)),
    }
  })
}

// 按 StartTime 的臺灣日期分組；18:00 至隔日 06:00 歸開始日。
// 各氣象因子分別按時間歸組，不假設其陣列長度或索引相同。
export function buildDailyForecast(weeklyLocation, days = 7, now = new Date()) {
  const elements = weeklyLocation?.WeatherElement
  const groups = new Map()
  for (const [name, field, property] of [
    ['最高溫度', 'high', 'MaxTemperature'],
    ['最低溫度', 'low', 'MinTemperature'],
    ['12小時降雨機率', 'rainChance', 'ProbabilityOfPrecipitation'],
    ['天氣現象', 'weather', 'Weather'],
  ]) {
    for (const entry of findElement(elements, name)?.Time ?? []) {
      if (!Number.isFinite(new Date(entry.StartTime).getTime())) continue
      const key = taipeiDateKey(entry.StartTime)
      if (!groups.has(key)) groups.set(key, { high: [], low: [], rainChance: [], weather: [] })
      const group = groups.get(key)
      const value = entry.ElementValue?.[0]?.[property]
      if (field === 'weather') {
        if (value && value !== '-99' && value !== '-999') {
          group.weather.push({ text: value, start: entry.StartTime })
        }
      } else {
        // 保留存在但缺值的溫度時段，讓輸出維持 null。
        group.hasTemperature = group.hasTemperature || field === 'high' || field === 'low'
        const number = toNumber(value)
        if (number !== null) group[field].push(number)
      }
    }
  }

  const today = taipeiDateKey(now)
  const aggregate = (values, operation) => (values.length ? Math.round(operation(...values)) : null)
  return [...groups.entries()]
    .filter(([date, group]) => date >= today && group.hasTemperature)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, days)
    .map(([date, group]) => {
      const iso = `${date}T12:00:00+08:00`
      const weather = group.weather.sort((a, b) => new Date(a.start) - new Date(b.start))
      const representative = weather.find((entry) => !isNightTime(entry.start)) ?? weather[0]
      return {
        day: formatDayLabel(iso, now),
        date: formatDateLabel(iso),
        high: aggregate(group.high, Math.max),
        low: aggregate(group.low, Math.min),
        kind: textToKind(representative?.text, false),
        rainChance: aggregate(group.rainChance, Math.max),
      }
    })
}

// 結合「現在天氣觀測」(即時但可能缺欄位) 與「逐時預報」第一筆 (當備援)，
// 組出 current 區塊；日出日沒有查到就一併附上。
export function buildCurrentWeather({ observation, hourlyLocation, sun }) {
  const temperature = findElement(hourlyLocation?.WeatherElement, '溫度')
  const apparent = findElement(hourlyLocation?.WeatherElement, '體感溫度')
  const humidity = findElement(hourlyLocation?.WeatherElement, '相對濕度')
  const weather = findElement(hourlyLocation?.WeatherElement, '天氣現象')

  const obs = observation?.WeatherElement
  const obsTemp = toNumber(obs?.AirTemperature)
  const obsHumidity = toNumber(obs?.RelativeHumidity)
  const obsPressure = toNumber(obs?.AirPressure)
  const obsWindMs = toNumber(obs?.WindSpeed)
  const obsUv = toNumber(obs?.UVIndex)
  const obsWeatherText = obs?.Weather && obs.Weather !== '-99' ? obs.Weather : null

  const forecastFirst = temperature?.Time?.[0]
  const forecastTemp = forecastFirst ? toNumber(forecastFirst.ElementValue?.[0]?.Temperature) : null
  const forecastApparent = apparent?.Time?.[0]
    ? toNumber(apparent.Time[0].ElementValue?.[0]?.ApparentTemperature)
    : null
  const forecastHumidity = humidity?.Time?.[0]
    ? toNumber(humidity.Time[0].ElementValue?.[0]?.RelativeHumidity)
    : null
  const forecastWindow = weather
    ? find3HourWindow(weather.Time, forecastFirst?.DataTime ?? new Date().toISOString())
    : null
  const forecastWeatherText = forecastWindow?.ElementValue?.[0]?.Weather ?? null

  const referenceIso =
    observation?.ObsTime?.DateTime ?? forecastFirst?.DataTime ?? new Date().toISOString()
  const description = obsWeatherText ?? forecastWeatherText ?? '—'
  const temperatureValue = obsTemp ?? forecastTemp
  const windSpeedKmh = obsWindMs !== null ? Math.round(obsWindMs * 3.6) : null // CWA 測站風速單位為 m/s

  return {
    temperature: temperatureValue !== null ? Math.round(temperatureValue) : null,
    feelsLike:
      forecastApparent !== null
        ? Math.round(forecastApparent)
        : temperatureValue !== null
          ? Math.round(temperatureValue)
          : null,
    description,
    kind: textToKind(description, isNightTime(referenceIso)),
    humidity:
      obsHumidity !== null
        ? Math.round(obsHumidity)
        : forecastHumidity !== null
          ? Math.round(forecastHumidity)
          : null,
    windSpeed: windSpeedKmh,
    pressure: obsPressure,
    uvIndex: obsUv,
    updatedAt: referenceIso,
    sunrise: sun?.SunRiseTime ?? null,
    sunset: sun?.SunSetTime ?? null,
  }
}
