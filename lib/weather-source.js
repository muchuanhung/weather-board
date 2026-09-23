// 天氣資料來源：Open-Meteo（免 API key）。
// 這裡負責「打外部 API → 整理成 test/weather-contract.mjs 認得的形狀」，
// /api/weather 與 Discord 推播都走這支，避免兩邊資料兜不起來。

import { resolveCity, supportedCityNames } from './cities.js'

const OPEN_METEO_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
const DEFAULT_TIMEOUT_MS = 8000
const HOURLY_COUNT = 8
const DAILY_COUNT = 5
const TIMEZONE = 'Asia/Taipei'

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

// WMO weather code → 本專案的 kind（sun / partly / cloud / rain / moon）與繁中描述。
// kind 只有五種，雪與雷雨一律歸到 rain，描述再講清楚實際狀況。
const WEATHER_CODES = {
  0: { kind: 'sun', description: '晴朗' },
  1: { kind: 'sun', description: '大致晴朗' },
  2: { kind: 'partly', description: '多雲時晴' },
  3: { kind: 'cloud', description: '陰天' },
  45: { kind: 'cloud', description: '有霧' },
  48: { kind: 'cloud', description: '霧淞' },
  51: { kind: 'rain', description: '毛毛雨' },
  53: { kind: 'rain', description: '毛毛雨' },
  55: { kind: 'rain', description: '密集毛毛雨' },
  56: { kind: 'rain', description: '凍毛雨' },
  57: { kind: 'rain', description: '強凍毛雨' },
  61: { kind: 'rain', description: '小雨' },
  63: { kind: 'rain', description: '中雨' },
  65: { kind: 'rain', description: '大雨' },
  66: { kind: 'rain', description: '凍雨' },
  67: { kind: 'rain', description: '強凍雨' },
  71: { kind: 'rain', description: '小雪' },
  73: { kind: 'rain', description: '中雪' },
  75: { kind: 'rain', description: '大雪' },
  77: { kind: 'rain', description: '雪珠' },
  80: { kind: 'rain', description: '短暫陣雨' },
  81: { kind: 'rain', description: '陣雨' },
  82: { kind: 'rain', description: '強陣雨' },
  85: { kind: 'rain', description: '陣雪' },
  86: { kind: 'rain', description: '強陣雪' },
  95: { kind: 'rain', description: '雷雨' },
  96: { kind: 'rain', description: '雷雨伴冰雹' },
  99: { kind: 'rain', description: '強雷雨伴冰雹' },
}

export class WeatherError extends Error {
  constructor(code, message, status = 502) {
    super(message)
    this.name = 'WeatherError'
    this.code = code
    this.status = status
  }
}

export function describeWeather(code, isDay = true) {
  const base = WEATHER_CODES[code] ?? { kind: 'cloud', description: '天氣狀況不明' }
  if (!isDay && base.kind === 'sun') {
    return { kind: 'moon', description: code === 0 ? '晴朗夜空' : '夜間大致晴朗' }
  }
  return base
}

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function clampPercent(value) {
  const parsed = toNumber(value, 0)
  return Math.min(100, Math.max(0, Math.round(parsed)))
}

function hourLabel(isoLocal) {
  return typeof isoLocal === 'string' && isoLocal.length >= 16 ? isoLocal.slice(11, 16) : '—'
}

function dayLabels(isoDate, index) {
  const [year, month, day] = String(isoDate ?? '')
    .split('-')
    .map((part) => Number(part))

  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return { day: `第 ${index + 1} 天`, date: '—' }
  }

  // 用 UTC 建構避免本機時區把日期推掉一天；這裡只是要算星期幾。
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()]
  return {
    day: index === 0 ? '今天' : weekday,
    date: `${month}月${day}日`,
  }
}

function mapCurrent(raw) {
  const current = raw?.current ?? {}
  const { kind, description } = describeWeather(current.weather_code, current.is_day !== 0)

  return {
    temperature: Math.round(toNumber(current.temperature_2m)),
    feelsLike: Math.round(toNumber(current.apparent_temperature, toNumber(current.temperature_2m))),
    description,
    kind,
    updatedAt: `${hourLabel(current.time)} 更新`,
  }
}

function mapHourly(raw) {
  const hourly = raw?.hourly ?? {}
  const times = Array.isArray(hourly.time) ? hourly.time : []
  if (times.length === 0) throw new WeatherError('weather_source_invalid', '氣象來源缺少逐時資料')

  const currentHour = `${String(raw?.current?.time ?? times[0]).slice(0, 13)}:00`
  const foundIndex = times.findIndex((time) => time >= currentHour)
  const startIndex = foundIndex === -1 ? 0 : foundIndex

  return times.slice(startIndex, startIndex + HOURLY_COUNT).map((time, offset) => {
    const index = startIndex + offset
    const { kind } = describeWeather(hourly.weather_code?.[index], hourly.is_day?.[index] !== 0)

    return {
      time: offset === 0 ? '現在' : hourLabel(time),
      temperature: Math.round(toNumber(hourly.temperature_2m?.[index])),
      kind,
      rainChance: clampPercent(hourly.precipitation_probability?.[index]),
    }
  })
}

function mapDaily(raw) {
  const daily = raw?.daily ?? {}
  const dates = Array.isArray(daily.time) ? daily.time : []
  if (dates.length === 0) throw new WeatherError('weather_source_invalid', '氣象來源缺少逐日資料')

  return dates.slice(0, DAILY_COUNT).map((date, index) => {
    const { kind } = describeWeather(daily.weather_code?.[index], true)
    const max = Math.round(toNumber(daily.temperature_2m_max?.[index]))
    const min = Math.round(toNumber(daily.temperature_2m_min?.[index]))

    return {
      ...dayLabels(date, index),
      high: Math.max(max, min),
      low: Math.min(max, min),
      kind,
      rainChance: clampPercent(daily.precipitation_probability_max?.[index]),
    }
  })
}

export function mapOpenMeteoResponse(raw) {
  return {
    current: mapCurrent(raw),
    hourly: mapHourly(raw),
    daily: mapDaily(raw),
  }
}

function buildRequestUrl(city) {
  const url = new URL(OPEN_METEO_ENDPOINT)
  url.searchParams.set('latitude', String(city.latitude))
  url.searchParams.set('longitude', String(city.longitude))
  url.searchParams.set('current', 'temperature_2m,apparent_temperature,weather_code,is_day')
  url.searchParams.set('hourly', 'temperature_2m,weather_code,is_day,precipitation_probability')
  url.searchParams.set(
    'daily',
    'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max'
  )
  url.searchParams.set('timezone', TIMEZONE)
  url.searchParams.set('forecast_days', String(DAILY_COUNT))
  return url
}

/**
 * 取得單一城市的天氣。
 * 城市查不到丟 400 的 WeatherError；外部 API 逾時／掛掉丟 504／502。
 */
export async function fetchWeather(
  cityInput,
  { timeoutMs = DEFAULT_TIMEOUT_MS, fetchImpl = globalThis.fetch } = {}
) {
  const city = resolveCity(cityInput)
  if (!city) {
    throw new WeatherError(
      'unknown_city',
      `查不到城市「${cityInput}」。目前支援：${supportedCityNames().join('、')}`,
      400
    )
  }

  let response
  try {
    response = await fetchImpl(buildRequestUrl(city), {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { accept: 'application/json' },
    })
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') {
      throw new WeatherError('weather_source_timeout', '氣象資料來源逾時，請稍後再試', 504)
    }
    throw new WeatherError('weather_source_unreachable', '連不上氣象資料來源，請稍後再試', 502)
  }

  if (!response.ok) {
    throw new WeatherError(
      'weather_source_failed',
      `氣象資料來源回應 ${response.status}，請稍後再試`,
      502
    )
  }

  const raw = await response.json()
  return { city, ...mapOpenMeteoResponse(raw) }
}
