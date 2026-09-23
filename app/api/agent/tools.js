import { createLlmClient, requestLlmMessage } from '../../../lib/agent-llm.js'
import { resolveCity, OFFICIAL_COUNTIES } from '../../../lib/city-map.js'

export const WEATHER_TOOL = {
  name: 'get_weather',
  description:
    '查臺灣縣市天氣。比較時每個城市使用相同的 dayOffsets。0 是台北日期的今天，1 明天，最多 6。只查問題需要的城市與日期。',
  input_schema: {
    type: 'object',
    properties: {
      city: { type: 'string', description: '臺灣縣市全名或常見別名' },
      dayOffsets: {
        type: 'array',
        items: { type: 'integer', minimum: 0, maximum: 6 },
        minItems: 1,
        maxItems: 7,
      },
    },
    required: ['city', 'dayOffsets'],
    additionalProperties: false,
  },
}

export function isoDate(now, offset = 0) {
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  return new Date(Date.parse(`${today}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
}

export function createWeatherTool(loadWeather, now = new Date()) {
  const cache = new Map()
  const evidence = []
  let calls = 0
  async function execute(input) {
    if (++calls > 4) throw new Error('查詢次數已達上限')
    if (
      !input ||
      typeof input !== 'object' ||
      Object.keys(input).some((k) => !['city', 'dayOffsets'].includes(k))
    )
      throw new Error('工具參數格式錯誤')
    const city = typeof input.city === 'string' && resolveCity(input.city)
    const offsets = input.dayOffsets
    if (!city) throw new Error('找不到臺灣縣市')
    if (
      !Array.isArray(offsets) ||
      !offsets.length ||
      offsets.length > 7 ||
      offsets.some((d) => !Number.isInteger(d) || d < 0 || d > 6)
    )
      throw new Error('日期必須為今天起 0 到 6 天')
    if (!cache.has(city.countyName)) {
      if (cache.size >= 3) throw new Error('最多查詢三個城市')
      cache.set(city.countyName, loadWeather(city))
    }
    const weather = await cache.get(city.countyName)
    const requestedDates = [...new Set(offsets)].sort((a, b) => a - b).map((d) => isoDate(now, d))
    const daily = requestedDates.flatMap((date) => {
      const [, month, day] = date.split('-').map(Number)
      const row = weather.daily.find((d) => d.date === `${month}月${day}日`)
      return row ? [{ ...row, date }] : []
    })
    const entry = {
      city: city.countyName,
      requestedDates,
      daily,
      missingDates: requestedDates.filter((date) => !daily.some((d) => d.date === date)),
      current: offsets.includes(0) ? weather.current : null,
      hourly: offsets.includes(0) ? (weather.hourly ?? []) : [],
      currentDataTime: offsets.includes(0) ? (weather.current.updatedAt ?? null) : null,
      forecastUpdatedAt: null,
      retrievedAt: weather.retrievedAt ?? new Date().toISOString(),
      source: {
        name: '中央氣象署 CWA',
        url: 'https://opendata.cwa.gov.tw/',
        datasets: ['F-D0047-091', ...(offsets.includes(0) ? ['O-A0003-001', 'F-D0047-089'] : [])],
      },
    }
    evidence.push(entry)
    return entry
  }
  return { execute, evidence }
}

export async function runToolAgent({ question, city, execute, now = new Date(), client }) {
  if (!client && !process.env.ANTHROPIC_API_KEY) return null
  client ??= createLlmClient()
  const messages = [
    { role: 'user', content: `台北今天：${isoDate(now)}；畫面城市：${city}；問題：${question}` },
  ]
  for (let round = 0; round < 3; round++) {
    const response = await requestLlmMessage(
      {
        tools: [WEATHER_TOOL],
        system:
          '你是臺灣天氣小幫手。天氣回答前必須用 get_weather 查資料。依問題自行選城市及日期，未指定城市用畫面城市。比較必須查所有候選城市的相同日期，根據降雨機率及高低溫說明取捨，不把缺值當零。只根據工具資料用繁體中文回答，不編造來源或更新時間。週末指同一個週末，超出七天或缺日期要明說，不移到另一週。不相關問題請簡短拒答。工具錯誤時不可假裝查詢成功。',
        messages,
      },
      client
    )
    const calls = response.content.filter((b) => b.type === 'tool_use')
    if (!calls.length) {
      const answer = response.content
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim()
      if (!answer) throw new Error('模型回傳空白')
      return { answer, provider: 'anthropic' }
    }
    if (calls.length > 4) throw new Error('工具呼叫過多')
    messages.push({ role: 'assistant', content: response.content })
    const results = []
    for (const call of calls) {
      try {
        if (call.name !== WEATHER_TOOL.name) throw new Error('不支援的工具')
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          content: JSON.stringify(await execute(call.input)),
        })
      } catch {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: '查詢失敗：請確認臺灣縣市、0–6 的日期範圍，或稍後再試。不可推測缺少的資料。',
        })
      }
    }
    messages.push({ role: 'user', content: results })
  }
  throw new Error('工具查詢輪數已達上限')
}

// 規則備援辨識中文全名／簡稱；新竹、嘉義的簡稱沿用 resolveCity 的預設。
export function questionCities(question, fallback) {
  const normalized = question.replaceAll('台', '臺')
  const matches = OFFICIAL_COUNTIES.filter((name) => normalized.includes(name))
  for (const name of OFFICIAL_COUNTIES) {
    const short = name.slice(0, -1)
    if (normalized.includes(short) && !matches.some((m) => m.startsWith(short))) {
      const resolved = resolveCity(short)
      if (resolved) matches.push(resolved.countyName)
    }
  }
  return matches.length ? [...new Set(matches)] : [fallback]
}

export function displayDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value ?? '')
  return match ? `${Number(match[2])}月${Number(match[3])}日` : value
}

// 比較答案必須建立在相同日期、完整雨量與溫度上，不能只靠 prompt 約束。
export function hasComparableEvidence(evidence, cities) {
  const groups = cities.map((city) => evidence.filter((entry) => entry.city === city))
  if (groups.some((entries) => !entries.length)) return false
  const dates = groups.map((entries) =>
    [...new Set(entries.flatMap((entry) => entry.requestedDates))].sort()
  )
  if (
    !dates[0]?.length ||
    dates.some((value) => JSON.stringify(value) !== JSON.stringify(dates[0]))
  )
    return false
  return groups.every((entries, index) =>
    dates[index].every((date) =>
      entries.some((entry) =>
        entry.daily.some(
          (day) => day.date === date && [day.rainChance, day.high, day.low].every(Number.isFinite)
        )
      )
    )
  )
}

export function displayTime(value) {
  if (!value || Number.isNaN(new Date(value).getTime())) return '未提供'
  return (
    new Date(value).toLocaleString('zh-TW', {
      timeZone: 'Asia/Taipei',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }) + '（台灣時間）'
  )
}

export function withEvidence(answer, evidence) {
  if (!evidence.length) return answer
  const lines = evidence.map(
    (e) =>
      `${e.city}：${e.requestedDates.map(displayDate).join('、')}；現在天氣資料時間：${displayTime(e.currentDataTime)}；預報發布時間：${displayTime(e.forecastUpdatedAt)}；資料取得時間：${displayTime(e.retrievedAt)}`
  )
  return `${answer}\n\n資料依據：中央氣象署 CWA（https://opendata.cwa.gov.tw/）\n${lines.join('\n')}`
}
