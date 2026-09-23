import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildAdvice,
  buildDiscordPayload,
  pickRainChance,
  readThreshold,
} from '../lib/discord-message.js'
import { notifyWeather } from '../lib/discord-notify.js'
import { makeOpenMeteoFixture } from './open-meteo-fixture.mjs'

const WEBHOOK = 'https://discord.com/api/webhooks/000/fake-token-for-test'
const SITE_URL = 'https://weather-board-liart.vercel.app/'

function makeFetchStub({ fixture = makeOpenMeteoFixture(), discordStatus = 204 } = {}) {
  const calls = { weather: [], discord: [] }

  const fetchImpl = async (input, init = {}) => {
    const url = String(input)

    if (url.includes('open-meteo')) {
      calls.weather.push(url)
      return new Response(JSON.stringify(fixture), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    }

    calls.discord.push({ url, method: init.method, payload: JSON.parse(init.body) })
    return new Response(discordStatus === 204 ? null : 'discord error', { status: discordStatus })
  }

  return { fetchImpl, calls }
}

test('readThreshold 只接受 0–100 的數字，其餘退回預設', () => {
  assert.equal(readThreshold('80'), 80)
  assert.equal(readThreshold('0'), 0)
  assert.equal(readThreshold(undefined), 60)
  assert.equal(readThreshold(''), 60)
  assert.equal(readThreshold('abc'), 60)
  assert.equal(readThreshold('120'), 60)
  assert.equal(readThreshold('-1'), 60)
})

test('pickRainChance 取今日與未來數小時的較大值', () => {
  const rain = pickRainChance({
    daily: [{ rainChance: 30 }],
    hourly: [{ rainChance: 10 }, { rainChance: 75 }, { rainChance: 20 }],
    upcomingHours: 6,
  })

  assert.equal(rain.todayRainChance, 30)
  assert.equal(rain.upcomingRainChance, 75)
  assert.equal(rain.rainChance, 75)
})

test('pickRainChance 只看指定的未來小時數', () => {
  const rain = pickRainChance({
    daily: [{ rainChance: 0 }],
    hourly: [{ rainChance: 0 }, { rainChance: 0 }, { rainChance: 90 }],
    upcomingHours: 2,
  })

  assert.equal(rain.rainChance, 0)
})

test('出門建議會隨降雨機率與氣溫改變', () => {
  assert.match(buildAdvice(90, { temperature: 26 }), /帶傘/)
  assert.match(buildAdvice(10, { temperature: 26 }), /放心出門/)
  assert.match(buildAdvice(10, { temperature: 34 }), /補充水分/)
  assert.match(buildAdvice(10, { temperature: 12 }), /外套/)
})

test('Discord payload 含城市、溫度、高低溫、降雨機率、建議與 Demo 連結', () => {
  const payload = buildDiscordPayload({
    city: { slug: 'taipei', name: '台北' },
    current: { temperature: 28, feelsLike: 30, description: '多雲時晴', updatedAt: '13:00 更新' },
    daily: [{ day: '今天', date: '9月22日', high: 30, low: 25, kind: 'partly', rainChance: 70 }],
    rain: { rainChance: 70, todayRainChance: 70, upcomingRainChance: 65, upcomingHours: 6 },
    threshold: 60,
    siteUrl: SITE_URL,
  })

  const serialized = JSON.stringify(payload)

  assert.match(payload.content, /台北/)
  assert.match(payload.content, /70%/)
  assert.equal(payload.embeds.length, 1)
  assert.equal(payload.embeds[0].url, SITE_URL)
  assert.match(serialized, /28°C/)
  assert.match(serialized, /30°C \/ 25°C/)
  assert.match(serialized, /今日 70%/)
  assert.match(serialized, /帶把傘/)
  assert.ok(serialized.includes(SITE_URL), 'payload 要帶 Demo 連結')
})

test('低於門檻時回 skipped:true 且不打 Discord', async () => {
  const { fetchImpl, calls } = makeFetchStub({
    fixture: makeOpenMeteoFixture({ hourlyRain: 10, todayRain: 20 }),
  })

  const { status, body } = await notifyWeather({
    city: 'Taipei',
    webhookUrl: WEBHOOK,
    threshold: 60,
    fetchImpl,
  })

  assert.equal(status, 200)
  assert.deepEqual(
    { ok: body.ok, skipped: body.skipped, reason: body.reason },
    { ok: true, skipped: true, reason: 'below_threshold' }
  )
  assert.equal(body.rainChance, 20)
  assert.equal(calls.discord.length, 0, '低於門檻不該打 Discord')
  assert.equal(calls.weather.length, 1)
})

test('超過門檻時實際推播，payload 送到 webhook', async () => {
  const { fetchImpl, calls } = makeFetchStub({
    fixture: makeOpenMeteoFixture({ hourlyRain: 85, todayRain: 20 }),
  })

  const { status, body } = await notifyWeather({
    city: '台北',
    webhookUrl: WEBHOOK,
    threshold: 60,
    siteUrl: SITE_URL,
    fetchImpl,
  })

  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.skipped, false)
  assert.equal(body.upcomingRainChance, 85)
  assert.equal(calls.discord.length, 1)
  assert.equal(calls.discord[0].url, WEBHOOK)
  assert.equal(calls.discord[0].method, 'POST')
  assert.match(calls.discord[0].payload.content, /台北/)
  assert.ok(calls.discord[0].payload.embeds[0].fields.length >= 4)
})

test('force 可以略過門檻強制推播', async () => {
  const { fetchImpl, calls } = makeFetchStub({
    fixture: makeOpenMeteoFixture({ hourlyRain: 5, todayRain: 5 }),
  })

  const { status, body } = await notifyWeather({
    city: 'Taipei',
    force: true,
    webhookUrl: WEBHOOK,
    threshold: 60,
    fetchImpl,
  })

  assert.equal(status, 200)
  assert.equal(body.ok, true)
  assert.equal(body.skipped, false)
  assert.equal(body.forced, true)
  assert.equal(calls.discord.length, 1)
  // 沒下雨時文案不該叫人帶傘。
  assert.match(calls.discord[0].payload.content, /🌤️/)
})

test('沒設定 DISCORD_WEBHOOK_URL 回 503，且不打任何外部 API', async () => {
  const { fetchImpl, calls } = makeFetchStub()

  const { status, body } = await notifyWeather({ city: 'Taipei', webhookUrl: '', fetchImpl })

  assert.equal(status, 503)
  assert.equal(body.ok, false)
  assert.equal(body.error, 'discord_webhook_not_configured')
  assert.ok(!('stack' in body))
  assert.equal(calls.weather.length, 0)
  assert.equal(calls.discord.length, 0)
})

test('未知城市回 400 並列出支援的城市', async () => {
  const { fetchImpl, calls } = makeFetchStub()

  const { status, body } = await notifyWeather({
    city: '__not_a_city__',
    webhookUrl: WEBHOOK,
    fetchImpl,
  })

  assert.equal(status, 400)
  assert.equal(body.error, 'unknown_city')
  assert.match(body.message, /台北/)
  assert.equal(calls.weather.length, 0)
})

test('Discord 回 4xx 時回非 2xx 與 ok:false', async () => {
  const { fetchImpl } = makeFetchStub({
    fixture: makeOpenMeteoFixture({ hourlyRain: 90, todayRain: 90 }),
    discordStatus: 404,
  })

  const { status, body } = await notifyWeather({
    city: 'Taipei',
    webhookUrl: WEBHOOK,
    threshold: 60,
    fetchImpl,
  })

  assert.equal(status, 502)
  assert.equal(body.ok, false)
  assert.equal(body.error, 'discord_request_failed')
  assert.equal(body.discordStatus, 404)
})
