import { NextResponse } from 'next/server.js'

import {
  createWeatherTool,
  displayDate,
  hasComparableEvidence,
  isoDate,
  questionCities,
  runToolAgent,
  withEvidence,
} from './tools.js'
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
  const hourly = buildHourlyForecast(hourlyLocation)
  if (!daily.length || !hourly.length) throw new Error('缺少預報資料')
  return {
    current: buildCurrentWeather({ observation, hourlyLocation }),
    hourly,
    daily,
    today: daily.find((d) => d.day === '今天') ?? null,
    retrievedAt: new Date().toISOString(),
  }
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

  const q = question.trim()
  const resolved = resolveCity(city)

  if (!resolved) {
    return NextResponse.json({
      ok: true,
      answer: `目前天氣小幫手只支援台灣縣市，還沒有「${city}」的資料。可以改搜台北、高雄等城市再問我。`,
      mode: 'rules',
    })
  }

  const q = question.trim()
  const now = new Date()
  const weatherCache = new Map()
  const loadWeather = (resolvedCity) => {
    if (!weatherCache.has(resolvedCity.countyName))
      weatherCache.set(resolvedCity.countyName, getWeather(resolvedCity))
    return weatherCache.get(resolvedCity.countyName)
  }
  const tool = createWeatherTool(loadWeather, now)
  try {
    const llm = await runToolAgent({
      question: q,
      city: resolved.countyName,
      execute: tool.execute,
      now,
    })
    if (
      llm &&
      tool.evidence.length &&
      (!/比較|還是|哪個|哪裡|哪邊/.test(q) ||
        hasComparableEvidence(tool.evidence, questionCities(q, resolved.countyName)))
    ) {
      return NextResponse.json({
        ok: true,
        answer: withEvidence(llm.answer, tool.evidence),
        mode: 'llm',
        provider: llm.provider,
        evidence: tool.evidence,
      })
    }
  } catch {
    console.warn('[Agent API] 模型未完成，改用規則回答')
  }

  // 模型失敗後重新建立證據，避免把未用於規則回答的查詢混進答案。
  const fallback = createWeatherTool(loadWeather, now)
  const cities = questionCities(q, resolved.countyName)
  if (cities.length > 3) {
    return NextResponse.json({
      ok: true,
      answer: '一次最多比較三個城市，請拆開詢問。',
      mode: 'rules',
      evidence: [],
    })
  }
  const calendar = Array.from({ length: 7 }, (_, offset) => {
    const [, month, day] = isoDate(now, offset).split('-').map(Number)
    return { date: `${month}月${day}日`, offset }
  })
  const hasDates = /今天|明天|後天|週/.test(q)
  const selected = hasDates ? findDayByPattern(calendar, q, now) : [calendar[0]]
  if (selected === null || !selected.length) {
    return NextResponse.json({
      ok: true,
      answer: `${resolved.countyName}目前無法判讀這個日期區間，請把日期拆開問。`,
      mode: 'rules',
      evidence: [],
    })
  }
  try {
    for (const city of cities)
      await fallback.execute({ city, dayOffsets: selected.map((d) => d.offset) })
    const summaries = fallback.evidence.map((e) => {
      const rows = e.daily
        .map(
          (d) =>
            `${displayDate(d.date)}：${fmt(d.low, '°C')}–${fmt(d.high, '°C')}，降雨機率 ${fmt(d.rainChance, '%')}`
        )
        .join('；')
      return `${e.city}：${rows || '暫無預報'}${e.missingDates.length ? `；缺少 ${e.missingDates.map(displayDate).join('、')} 的資料` : ''}`
    })
    let answer = summaries.join('。')
    if (cities.length === 1 && selected.length === 1 && selected[0].offset === 0) {
      answer = answerByRules(q, cities[0], await loadWeather(resolveCity(cities[0])), now)
    }
    if (cities.length > 1) {
      const complete = fallback.evidence.every(
        (e) =>
          !e.missingDates.length &&
          e.daily.every((d) => d.rainChance !== null && d.rainChance !== undefined)
      )
      if (complete) {
        const scores = fallback.evidence
          .map((e) => ({ city: e.city, rain: Math.max(...e.daily.map((d) => d.rainChance)) }))
          .sort((a, b) => a.rain - b.rain)
        answer +=
          scores[0].rain < scores[1].rain
            ? `。若以少淋雨為優先，${scores[0].city}較適合（所選日期最高降雨機率 ${scores[0].rain}%）；溫度請依活動與個人偏好比較。`
            : '。各城市最低的最高降雨機率相同，無法僅靠降雨機率選出唯一推薦。'
      } else answer += '。部分日期或降雨機率缺資料，無法可靠推薦哪個城市較適合。'
    }
    return NextResponse.json({
      ok: true,
      answer: withEvidence(answer, fallback.evidence),
      mode: 'rules',
      evidence: fallback.evidence,
    })
  } catch {
    return NextResponse.json({ ok: false, error: '氣象資料取得失敗，請稍後再試' }, { status: 502 })
  }
}
