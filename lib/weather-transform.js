// 把 CWA 原始資料轉成 /api/weather 要回傳、前端可以直接吃的形狀。
// hourlyForecast / dailyForecast 的欄位刻意對齊 lib/weather-data.js 現有的 mock 資料，
// 前端只要把 import 換成 fetch('/api/weather?city=...') 的結果，元件不用改。

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function textToKind(text, isNight) {
  if (!text) return isNight ? 'moon' : 'sun'
  if (/雷|雨/.test(text)) return 'rain'
  if (/晴.*雲|雲.*晴/.test(text)) return isNight ? 'moon' : 'partly'
  if (/陰|多雲/.test(text)) return 'cloud'
  if (/晴/.test(text)) return isNight ? 'moon' : 'sun'
  return isNight ? 'moon' : 'sun'
}

// CWA 時間戳一律帶 +08:00（台灣時間），直接從字串取年/月/日/時，
// 不透過 Date 的 local getter——避免部署主機時區不是 Asia/Taipei 時，
// 每小時預報、日夜判斷、日期標籤全部跟著主機時區跑掉。
function parseTaipeiTime(isoString) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(isoString)
  if (!match) {
    const d = new Date(isoString)
    return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate(), hour: d.getHours(), weekday: d.getDay() }
  }
  const [, year, month, day, hour] = match.map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay()
  return { year, month, day, hour, weekday }
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

function formatDayLabel(isoString, index) {
  if (index === 0) return '今天'
  if (index === 1) return '明天'
  return WEEKDAY_NAMES[parseTaipeiTime(isoString).weekday]
}

function formatDateLabel(isoString) {
  const { month, day } = parseTaipeiTime(isoString)
  return `${month}月${day}日`
}

function toNumber(value) {
  if (value === undefined || value === null) return null
  const n = Number(value)
  if (Number.isNaN(n)) return null
  // CWA 用 -99 / -999 表示該測站缺這項資料
  if (n <= -90) return null
  return n
}

// F-D0047-089 -> [{ time, temperature, kind }]
export function buildHourlyForecast(hourlyLocation, count = 8) {
  const temperature = findElement(hourlyLocation?.WeatherElement, '溫度')
  const weather = findElement(hourlyLocation?.WeatherElement, '天氣現象')
  if (!temperature) return []

  return temperature.Time.slice(0, count).map((entry, index) => {
    const window = weather ? find3HourWindow(weather.Time, entry.DataTime) : null
    const text = window?.ElementValue?.[0]?.Weather
    return {
      time: formatHourLabel(entry.DataTime, index),
      temperature: Math.round(toNumber(entry.ElementValue[0].Temperature) ?? 0),
      kind: textToKind(text, isNightTime(entry.DataTime)),
    }
  })
}

// F-D0047-091（逐12小時，白天/夜晚各一筆）-> [{ day, date, high, low, kind, rainChance }]
export function buildDailyForecast(weeklyLocation, days = 7) {
  const maxT = findElement(weeklyLocation?.WeatherElement, '最高溫度')
  const minT = findElement(weeklyLocation?.WeatherElement, '最低溫度')
  const pop = findElement(weeklyLocation?.WeatherElement, '12小時降雨機率')
  const weather = findElement(weeklyLocation?.WeatherElement, '天氣現象')
  if (!maxT || !minT) return []

  const result = []
  for (let i = 0; i < days; i++) {
    const dayIdx = i * 2
    const nightIdx = i * 2 + 1
    const dayEntry = maxT.Time[dayIdx]
    if (!dayEntry) break

    const dayHigh = toNumber(dayEntry.ElementValue[0].MaxTemperature)
    const nightHigh = maxT.Time[nightIdx] ? toNumber(maxT.Time[nightIdx].ElementValue[0].MaxTemperature) : null
    const dayLow = toNumber(minT.Time[dayIdx]?.ElementValue?.[0]?.MinTemperature)
    const nightLow = minT.Time[nightIdx] ? toNumber(minT.Time[nightIdx].ElementValue[0].MinTemperature) : null

    const dayPop = toNumber(pop?.Time[dayIdx]?.ElementValue?.[0]?.ProbabilityOfPrecipitation) ?? 0
    const nightPop = pop?.Time[nightIdx]
      ? (toNumber(pop.Time[nightIdx].ElementValue[0].ProbabilityOfPrecipitation) ?? 0)
      : dayPop

    const dayWeatherText = weather?.Time[dayIdx]?.ElementValue?.[0]?.Weather
    const nightWeatherText = weather?.Time[nightIdx]?.ElementValue?.[0]?.Weather

    result.push({
      day: formatDayLabel(dayEntry.StartTime, i),
      date: formatDateLabel(dayEntry.StartTime),
      high: Math.round(Math.max(dayHigh ?? nightHigh ?? 0, nightHigh ?? dayHigh ?? 0)),
      low: Math.round(Math.min(dayLow ?? nightLow ?? 0, nightLow ?? dayLow ?? 0)),
      kind: textToKind(dayWeatherText ?? nightWeatherText, false),
      rainChance: Math.round(Math.max(dayPop, nightPop)),
    })
  }
  return result
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
  const forecastTemp = forecastFirst ? toNumber(forecastFirst.ElementValue[0].Temperature) : null
  const forecastApparent = apparent?.Time?.[0]
    ? toNumber(apparent.Time[0].ElementValue[0].ApparentTemperature)
    : null
  const forecastHumidity = humidity?.Time?.[0] ? toNumber(humidity.Time[0].ElementValue[0].RelativeHumidity) : null
  const forecastWindow = weather ? find3HourWindow(weather.Time, forecastFirst?.DataTime ?? new Date().toISOString()) : null
  const forecastWeatherText = forecastWindow?.ElementValue?.[0]?.Weather ?? null

  const referenceIso = observation?.ObsTime?.DateTime ?? forecastFirst?.DataTime ?? new Date().toISOString()
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
    humidity: obsHumidity !== null ? Math.round(obsHumidity) : forecastHumidity !== null ? Math.round(forecastHumidity) : null,
    windSpeed: windSpeedKmh,
    pressure: obsPressure,
    uvIndex: obsUv,
    updatedAt: referenceIso,
    sunrise: sun?.SunRiseTime ?? null,
    sunset: sun?.SunSetTime ?? null,
  }
}
