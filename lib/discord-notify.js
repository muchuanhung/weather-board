// Discord 推播主流程：查城市 → 取天氣 → 判門檻 → 打 webhook。

import { resolveCity, supportedCityNames } from './cities.js'
import {
  buildDiscordPayload,
  DEFAULT_RAIN_CHANCE_THRESHOLD,
  DEFAULT_SITE_URL,
  DEFAULT_UPCOMING_HOURS,
  pickRainChance,
} from './discord-message.js'
import { fetchWeather, WeatherError } from './weather-source.js'

const DISCORD_TIMEOUT_MS = 8000

/**
 * @returns {Promise<{ status: number, body: object }>} 直接對應 HTTP 回應。
 */
export async function notifyWeather({
  city: cityInput,
  force = false,
  webhookUrl,
  threshold = DEFAULT_RAIN_CHANCE_THRESHOLD,
  siteUrl = DEFAULT_SITE_URL,
  upcomingHours = DEFAULT_UPCOMING_HOURS,
  fetchImpl = globalThis.fetch,
  timeoutMs,
} = {}) {
  const city = resolveCity(cityInput)
  if (!city) {
    return {
      status: 400,
      body: {
        ok: false,
        error: 'unknown_city',
        message: `查不到城市「${cityInput}」。目前支援：${supportedCityNames().join('、')}`,
      },
    }
  }

  if (!webhookUrl) {
    return {
      status: 503,
      body: {
        ok: false,
        error: 'discord_webhook_not_configured',
        message: '伺服器尚未設定 DISCORD_WEBHOOK_URL，請在 Vercel 環境變數或本機 .env.local 補上',
      },
    }
  }

  // 3. 取天氣。
  let weather
  try {
    weather = await fetchWeather(city.slug, { fetchImpl, timeoutMs })
  } catch (error) {
    if (error instanceof WeatherError) {
      return {
        status: error.status,
        body: { ok: false, error: error.code, message: error.message },
      }
    }
    console.error('[discord/notify] 取得天氣失敗', error)
    return {
      status: 500,
      body: { ok: false, error: 'internal_error', message: '取得天氣資料失敗，請稍後再試' },
    }
  }

  // 4. 門檻判斷。force 是手動測試用的後門，其他情況低於門檻就不吵。
  const rain = pickRainChance({ hourly: weather.hourly, daily: weather.daily, upcomingHours })
  if (!force && rain.rainChance < threshold) {
    return {
      status: 200,
      body: {
        ok: true,
        skipped: true,
        reason: 'below_threshold',
        city: city.name,
        threshold,
        rainChance: rain.rainChance,
        todayRainChance: rain.todayRainChance,
        upcomingRainChance: rain.upcomingRainChance,
      },
    }
  }

  // 5. 推去 Discord。
  const payload = buildDiscordPayload({
    city,
    current: weather.current,
    daily: weather.daily,
    rain,
    threshold,
    siteUrl,
  })

  let response
  try {
    response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(DISCORD_TIMEOUT_MS),
    })
  } catch (error) {
    console.error('[discord/notify] 送不出去', error?.name ?? error)
    return {
      status: 502,
      body: { ok: false, error: 'discord_unreachable', message: '連不上 Discord Webhook' },
    }
  }

  if (!response.ok) {
    // Discord 的錯誤訊息（例如 webhook 被刪、payload 欄位不合法）留在 log 方便除錯。
    const detail = await response.text().catch(() => '')
    console.error('[discord/notify] Discord 回應', response.status, detail.slice(0, 500))
    return {
      status: 502,
      body: {
        ok: false,
        error: 'discord_request_failed',
        discordStatus: response.status,
        message: 'Discord Webhook 回應失敗，詳見伺服器 log',
      },
    }
  }

  return {
    status: 200,
    body: {
      ok: true,
      skipped: false,
      forced: Boolean(force) && rain.rainChance < threshold,
      city: city.name,
      threshold,
      rainChance: rain.rainChance,
      todayRainChance: rain.todayRainChance,
      upcomingRainChance: rain.upcomingRainChance,
    },
  }
}
