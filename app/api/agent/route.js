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
  const daily = buildDailyForecast(weeklyLocation, 7)
  return {
    current: buildCurrentWeather({ observation, hourlyLocation }),
    hourly: buildHourlyForecast(hourlyLocation),
    daily,
    today: daily[0] ?? null,
  }
}

function formatContext(countyName, { current, hourly, daily, today }) {
  const hours = hourly
    .map((h) => `${h.time} ${fmt(h.temperature, '°C')} ${KIND_TEXT[h.kind] ?? ''}`)
    .join('、')

  const dailyLines = daily.map(
    (d) =>
      `${d.day}（${d.date}）：最高 ${fmt(d.high, '°C')}、最低 ${fmt(d.low, '°C')}，降雨機率 ${fmt(d.rainChance, '%')}`
  )

  return [
    `城市：${countyName}`,
    `現在：${current.description}，氣溫 ${fmt(current.temperature, '°C')}，體感 ${fmt(current.feelsLike, '°C')}，濕度 ${fmt(current.humidity, '%')}，紫外線指數 ${fmt(current.uvIndex, '')}`,
    `未來逐時：${hours || '暫無資料'}`,
    '未來幾天預報：',
    ...(dailyLines.length ? dailyLines : ['暫無預報資料']),
  ].join('\n')
}

const WEEKDAY_NAMES = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

function taipeiMidnightUtc(now) {
  const [y, m, d] = new Date(now)
    .toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
    .split('-')
    .map(Number)
  return Date.UTC(y, m - 1, d)
}

// dailyForecast 的 day 欄位在今天與明天是「今天」「明天」而非星期名（見 API-CONTRACT.md），
// 所以改由 date（「9月22日」）還原真實日期，算出離今天第幾天。無法解析時回 null。
function dayOffset(item, todayUtc) {
  const matched = /^(\d{1,2})月(\d{1,2})日$/.exec(item.date ?? '')
  if (!matched) return null

  const [, month, day] = matched.map(Number)
  const baseYear = new Date(todayUtc).getUTCFullYear()
  // date 沒有年份；預報範圍不超過一週，取離今天最近的年份即可涵蓋跨年
  const utc = [baseYear - 1, baseYear, baseYear + 1]
    .map((year) => Date.UTC(year, month - 1, day))
    .reduce((a, b) => (Math.abs(a - todayUtc) <= Math.abs(b - todayUtc) ? a : b))

  return Math.round((utc - todayUtc) / 86400000)
}

const DAY_KEYWORDS = [
  '今天',
  '明天',
  '後天',
  '週末',
  '週一',
  '週二',
  '週三',
  '週四',
  '週五',
  '週六',
  '週日',
]

// 預報最多七天，0..6 內每個星期名恰好各出現一次
const FORECAST_DAYS = 7

// 關鍵字對應到離今天第幾天，與手上有沒有資料無關 ——
// 這樣「週四到週日」即使缺週四的資料，仍算得出整段範圍。
function keywordOffsets(keyword, todayUtc) {
  if (keyword === '今天') return [0]
  if (keyword === '明天') return [1]
  if (keyword === '後天') return [2]

  const wanted = keyword === '週末' ? ['週六', '週日'] : [keyword]
  const offsets = []
  for (let offset = 0; offset < FORECAST_DAYS; offset++) {
    const weekday = WEEKDAY_NAMES[new Date(todayUtc + offset * 86400000).getUTCDay()]
    if (wanted.includes(weekday)) offsets.push(offset)
  }
  return offsets
}

// 只支援「日期＋連接詞＋日期」，允許空白，不猜其他中文語意。
const RANGE_CONNECTIVE = /^\s*[到至~～]\s*$/

function isContinuous(offsets) {
  return offsets.every((offset, i) => i === 0 || offset === offsets[i - 1] + 1)
}

function targetOffsets(pattern, todayUtc) {
  const mentions = []
  for (const keyword of DAY_KEYWORDS) {
    let at = pattern.indexOf(keyword)
    while (at !== -1) {
      mentions.push({ keyword, at, offsets: keywordOffsets(keyword, todayUtc) })
      at = pattern.indexOf(keyword, at + keyword.length)
    }
  }
  mentions.sort((a, b) => a.at - b.at)

  const targets = new Set()
  for (const [index, mention] of mentions.entries()) {
    mention.offsets.forEach((offset) => targets.add(offset))

    const next = mentions[index + 1]
    if (!next) continue
    const between = pattern.slice(mention.at + mention.keyword.length, next.at)
    if (!RANGE_CONNECTIVE.test(between)) continue

    // 週日開始的七天中，週末是 [0, 6]，不是同一個連續週末。
    // 這類端點及反向／跨週區間先交由使用者拆開詢問，不默默顛倒起訖。
    const start = mention.offsets[0]
    const end = next.offsets.at(-1)
    if (
      !isContinuous(mention.offsets) ||
      !isContinuous(next.offsets) ||
      start > next.offsets[0] ||
      mention.offsets.at(-1) > end
    ) {
      return null
    }
    for (let offset = start; offset <= end; offset++) {
      targets.add(offset)
    }
  }

  return targets
}

// 先由問題算出要哪幾天，再從 daily 挑出有資料的那幾筆；
// 範圍中間缺資料的日期直接略過。回傳維持 daily 原本的日期順序。
// null 表示不支援的區間；[] 表示可以解析，但沒有符合的資料。
export function findDayByPattern(daily, pattern, now = new Date()) {
  const todayUtc = taipeiMidnightUtc(now)
  const targets = targetOffsets(pattern, todayUtc)
  if (targets === null) return null
  if (targets.size === 0) return []

  return daily.filter((item) => {
    const offset = dayOffset(item, todayUtc)
    if (offset !== null) return targets.has(offset)
    // date 缺失時只靠標籤辨認今天與明天，其他日期不猜
    if (item.day === '今天') return targets.has(0)
    if (item.day === '明天') return targets.has(1)
    return false
  })
}

function formatDayForecast(d) {
  return `${d.day}（${d.date}）最高 ${fmt(d.high, '°C')}、最低 ${fmt(d.low, '°C')}，降雨機率 ${fmt(d.rainChance, '%')}`
}

export function answerByRules(
  question,
  countyName,
  { current, hourly, daily, today },
  now = new Date()
) {
  const rain = today?.rainChance ?? null
  const rainyHours = hourly.filter((h) => h.kind === 'rain').map((h) => h.time)

  // Multi-day / weekend questions
  if (/週末|週六|週日|明天|後天|週一|週二|週三|週四|週五/.test(question)) {
    const matched = findDayByPattern(daily, question, now)
    if (matched === null) {
      return `${countyName}目前無法判讀這個日期區間，跨週或反向範圍暫不支援，請把日期拆開問。`
    }
    if (matched.length) {
      const forecast = matched.map(formatDayForecast).join('；')
      return `${countyName}${forecast}。`
    }
    return `${countyName}目前預報資料中沒有該日期的天氣資訊。`
  }

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
