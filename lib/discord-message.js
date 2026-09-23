// 組 Discord 推播訊息：門檻判斷 + embed 內容。

export const DEFAULT_SITE_URL = 'https://weather-board-liart.vercel.app/'
export const DEFAULT_RAIN_CHANCE_THRESHOLD = 60
export const DEFAULT_UPCOMING_HOURS = 6

const EMBED_COLOR_RAIN = 0x3b82f6
const EMBED_COLOR_CLEAR = 0xf59e0b

/** 環境變數轉門檻值 */
export function readThreshold(rawValue, fallback = DEFAULT_RAIN_CHANCE_THRESHOLD) {
  const text = String(rawValue ?? '').trim()
  if (text === '') return fallback

  const parsed = Number(text)
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) return fallback
  return Math.round(parsed)
}

/**
 * 取出判斷用的降雨機率：今日（daily[0]）與未來數小時（hourly）取較大值。
 * 只要其中一邊超過門檻就值得提醒使用者帶傘。
 */
export function pickRainChance({
  hourly = [],
  daily = [],
  upcomingHours = DEFAULT_UPCOMING_HOURS,
}) {
  const todayRainChance = Number.isFinite(daily[0]?.rainChance) ? daily[0].rainChance : 0

  const upcoming = hourly
    .slice(0, upcomingHours)
    .map((item) => (Number.isFinite(item?.rainChance) ? item.rainChance : 0))

  const upcomingRainChance = upcoming.length > 0 ? Math.max(...upcoming) : 0

  return {
    todayRainChance,
    upcomingRainChance,
    upcomingHours,
    rainChance: Math.max(todayRainChance, upcomingRainChance),
  }
}

/** 一句出門建議 */
export function buildAdvice(rainChance, current = {}) {
  let advice
  if (rainChance >= 80) advice = '降雨機率很高，出門務必帶傘，也留意積水路段。'
  else if (rainChance >= 60) advice = '降雨機率偏高，出門記得帶把傘。'
  else if (rainChance >= 30) advice = '可能有短暫陣雨，帶把折疊傘比較安心。'
  else advice = '降雨機率低，可以放心出門。'

  const temperature = current.temperature
  if (Number.isFinite(temperature)) {
    if (temperature >= 32) advice += ' 天氣炎熱，記得多補充水分。'
    else if (temperature <= 15) advice += ' 氣溫偏低，記得加件外套。'
  }

  return advice
}

/**
 * 組出 Discord Webhook 的 request body。
 */
export function buildDiscordPayload({
  city,
  current,
  daily = [],
  rain,
  threshold = DEFAULT_RAIN_CHANCE_THRESHOLD,
  siteUrl = DEFAULT_SITE_URL,
}) {
  const today = daily[0]
  const willRain = rain.rainChance >= threshold
  const advice = buildAdvice(rain.rainChance, current)

  const fields = [
    {
      name: '現在',
      value: `${current.temperature}°C（體感 ${current.feelsLike}°C）・${current.description}`,
      inline: false,
    },
  ]

  if (today) {
    fields.push({
      name: '今日高低溫',
      value: `${today.high}°C / ${today.low}°C`,
      inline: true,
    })
  }

  fields.push({
    name: '降雨機率',
    value: `今日 ${rain.todayRainChance}%｜未來 ${rain.upcomingHours} 小時 ${rain.upcomingRainChance}%`,
    inline: true,
  })

  fields.push({ name: '出門建議', value: advice, inline: false })
  fields.push({ name: '完整預報', value: siteUrl, inline: false })

  return {
    username: '氣象看板',
    content: willRain
      ? `☔ ${city.name}：降雨機率 ${rain.rainChance}%，出門記得帶傘。`
      : `🌤️ ${city.name}：${current.description}，目前 ${current.temperature}°C。`,
    embeds: [
      {
        title: `${city.name} 天氣提醒`,
        url: siteUrl,
        color: willRain ? EMBED_COLOR_RAIN : EMBED_COLOR_CLEAR,
        fields,
        footer: { text: `資料${current.updatedAt}・推播門檻 ${threshold}%` },
      },
    ],
  }
}
