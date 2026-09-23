import { NextResponse } from 'next/server.js'

import { askLlm, formatLlmError } from '../../../lib/agent-llm.js'
import { resolveCity } from '../../../lib/city-map.js'
import {
  fetchCurrentObservation,
  fetchHourlyForecast,
  fetchWeeklyForecast,
} from '../../../lib/cwa.js'
import {
  buildCurrentWeather,
  buildDailyForecast,
  buildHourlyForecast,
} from '../../../lib/weather-transform.js'


const KIND_TEXT = { sun: '晴', partly: '多雲時晴', cloud: '多雲', rain: '有雨', moon: '晴（夜間）' }

function fmt(value, unit) {
  return value === null || value === undefined ? '—' : `${value}${unit}`
}

async function getWeather({ countyName, stationName }) {
  const [observation, hourlyLocation, weeklyLocation] = await Promise.all([
    fetchCurrentObservation(stationName),
    fetchHourlyForecast(countyName),
    fetchWeeklyForecast(countyName),
  ])
  return {
    current: buildCurrentWeather({ observation, hourlyLocation }),
    hourly: buildHourlyForecast(hourlyLocation),
    today: buildDailyForecast(weeklyLocation, 1)[0] ?? null,
  }
}

function formatContext(countyName, { current, hourly, today }) {
  const hours = hourly
    .map((h) => `${h.time} ${fmt(h.temperature, '°C')} ${KIND_TEXT[h.kind] ?? ''}`)
    .join('、')
  return [
    `城市：${countyName}`,
    `現在：${current.description}，氣溫 ${fmt(current.temperature, '°C')}，體感 ${fmt(current.feelsLike, '°C')}，濕度 ${fmt(current.humidity, '%')}，紫外線指數 ${fmt(current.uvIndex, '')}`,
    today
      ? `今天：最高 ${fmt(today.high, '°C')}、最低 ${fmt(today.low, '°C')}，12 小時降雨機率 ${fmt(today.rainChance, '%')}`
      : '今天：暫無預報資料',
    `未來逐時：${hours || '暫無資料'}`,
  ].join('\n')
}

function answerByRules(question, countyName, { current, hourly, today }) {
  const rain = today?.rainChance ?? null
  const rainyHours = hourly.filter((h) => h.kind === 'rain').map((h) => h.time)

  if (/傘|雨/.test(question)) {
    if (rainyHours.length) {
      return `${countyName}預報 ${rainyHours[0]} 起可能有雨，今天降雨機率 ${fmt(rain, '%')}，建議帶傘。`
    }
    if (rain !== null && rain >= 50) {
      return `${countyName}未來幾小時預報沒雨，但今天降雨機率 ${rain}%，建議帶把折傘。`
    }
    return `${countyName}未來幾小時預報沒有雨，今天降雨機率 ${fmt(rain, '%')}，應該不太需要帶傘。`
  }

  if (/冷|熱|穿|外套|晚上/.test(question)) {
    const low = today?.low ?? null
    if (low === null)
      return `${countyName}目前體感 ${fmt(current.feelsLike, '°C')}，今晚低溫資料暫缺。`
    if (low <= 18) return `${countyName}今晚低溫約 ${low}°C，會有涼意，建議帶件外套。`
    if (low <= 23) return `${countyName}今晚低溫約 ${low}°C，稍涼，帶件薄外套比較保險。`
    return `${countyName}今晚低溫約 ${low}°C，不太會冷，短袖即可。`
  }

  if (/運動|戶外|跑步|散步|騎車/.test(question)) {
    if (rainyHours.length || (rain ?? 0) >= 60) {
      return `${countyName}今天降雨機率 ${fmt(rain, '%')}，戶外運動可能遇雨，建議改室內或備好雨具。`
    }
    if ((current.feelsLike ?? 0) >= 33) {
      return `${countyName}目前體感 ${current.feelsLike}°C 偏熱，建議清晨或傍晚再運動，記得補水。`
    }
    const uvNote = (current.uvIndex ?? 0) >= 8 ? '，紫外線偏強記得防曬' : ''
    return `${countyName}目前${current.description}、體感 ${fmt(current.feelsLike, '°C')}，適合戶外運動${uvNote}。`
  }

  return `${countyName}現在${current.description}，氣溫 ${fmt(current.temperature, '°C')}；今天 ${fmt(today?.low, '°C')}–${fmt(today?.high, '°C')}，降雨機率 ${fmt(rain, '%')}。`
}

export async function POST(request) {
  let body
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: '請求格式錯誤，需為 JSON' }, { status: 400 })
  }

  const { city, question } = body ?? {}
  if (!city || typeof city !== 'string') {
    return NextResponse.json({ ok: false, error: '缺少必要參數：city' }, { status: 400 })
  }
  if (!question || typeof question !== 'string' || !question.trim()) {
    return NextResponse.json({ ok: false, error: '缺少必要參數：question' }, { status: 400 })
  }
  if (question.length > 200) {
    return NextResponse.json({ ok: false, error: '提問過長，請保持在 200 字以內' }, { status: 400 })
  }

  const resolved = resolveCity(city)
  if (!resolved) {
    return NextResponse.json({ ok: false, error: `找不到城市「${city}」` }, { status: 400 })
  }

  let weather
  try {
    weather = await getWeather(resolved)
  } catch (error) {
    console.error('[Agent API] 天氣資料取得失敗', error)
    return NextResponse.json({ ok: false, error: '氣象資料取得失敗，請稍後再試' }, { status: 502 })
  }

  const q = question.trim()
  const context = formatContext(resolved.countyName, weather)

  try {
    const llm = await askLlm({ context, question: q })
    if (llm) {
      return NextResponse.json({
        ok: true,
        answer: llm.answer,
        mode: 'llm',
        provider: llm.provider,
      })
    }
  } catch (error) {
    console.error(`[Agent API] LLM 呼叫失敗${formatLlmError(error)}，改用規則回答`, error)
  }

  const answer = answerByRules(q, resolved.countyName, weather)
  return NextResponse.json({ ok: true, answer, mode: 'rules' })
}
