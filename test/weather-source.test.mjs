import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveCity, supportedCityNames } from '../lib/cities.js'
import {
  describeWeather,
  fetchWeather,
  mapOpenMeteoResponse,
  WeatherError,
} from '../lib/weather-source.js'
import { makeOpenMeteoFixture } from './open-meteo-fixture.mjs'
import { assertCurrent, assertDaily, assertHourly } from './weather-contract.mjs'

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

test('Open-Meteo 回應轉換後符合 weather-contract', () => {
  const { current, hourly, daily } = mapOpenMeteoResponse(makeOpenMeteoFixture())

  assertCurrent(current)
  assertHourly(hourly)
  assertDaily(daily)
})

test('逐時從「現在」開始，逐日第一筆是「今天」', () => {
  const { hourly, daily } = mapOpenMeteoResponse(makeOpenMeteoFixture())

  assert.equal(hourly[0].time, '現在')
  assert.equal(hourly[1].time, '14:00')
  assert.equal(daily[0].day, '今天')
  assert.equal(daily[0].date, '9月22日')
  assert.equal(daily[1].day, '週三') // 2026-09-23
})

test('夜間的晴天轉成 moon，雷雨／陣雨轉成 rain', () => {
  assert.equal(describeWeather(0, false).kind, 'moon')
  assert.equal(describeWeather(0, true).kind, 'sun')
  assert.equal(describeWeather(80, true).kind, 'rain')
  assert.equal(describeWeather(95, true).kind, 'rain')
  // 沒見過的代碼不要炸掉，退回 cloud 並給得出描述。
  assert.equal(describeWeather(12345, true).kind, 'cloud')
})

test('降雨機率被夾在 0–100，缺值當 0', () => {
  const fixture = makeOpenMeteoFixture()
  fixture.daily.precipitation_probability_max = [null, 130, -5, undefined, 55]

  const { daily } = mapOpenMeteoResponse(fixture)

  assert.deepEqual(
    daily.map((item) => item.rainChance),
    [0, 100, 0, 0, 55]
  )
  assertDaily(daily)
})

test('城市對照吃得下臺／台、市縣結尾與英文名', () => {
  assert.equal(resolveCity('台北').slug, 'taipei')
  assert.equal(resolveCity('臺北市').slug, 'taipei')
  assert.equal(resolveCity('  Taipei ').slug, 'taipei')
  assert.equal(resolveCity('kaohsiung').slug, 'kaohsiung')
  assert.equal(resolveCity('高雄市').slug, 'kaohsiung')
  assert.equal(resolveCity('New Taipei').slug, 'new-taipei')
  // 沒給城市時預設台北。
  assert.equal(resolveCity('').slug, 'taipei')
  assert.equal(resolveCity(undefined).slug, 'taipei')
  // 查不到回 null，由呼叫端決定要回幾號錯誤。
  assert.equal(resolveCity('__not_a_city__'), null)
})

test('支援的城市涵蓋常見台灣城市', () => {
  const names = supportedCityNames()
  for (const name of ['台北', '台中', '台南', '高雄', '桃園', '新竹', '花蓮']) {
    assert.ok(names.includes(name), `應該支援 ${name}`)
  }
})

test('fetchWeather 查不到城市回 400 的 WeatherError，不打外部 API', async () => {
  let called = false
  const fetchImpl = async () => {
    called = true
    return jsonResponse({})
  }

  await assert.rejects(
    () => fetchWeather('__not_a_city__', { fetchImpl }),
    (error) =>
      error instanceof WeatherError && error.status === 400 && error.code === 'unknown_city'
  )
  assert.equal(called, false)
})

test('外部 API 掛掉時丟出 502 的 WeatherError', async () => {
  const fetchImpl = async () => jsonResponse({ error: true }, 500)

  await assert.rejects(
    () => fetchWeather('Taipei', { fetchImpl }),
    (error) => error instanceof WeatherError && error.status === 502
  )
})

test('fetchWeather 帶上城市座標並回傳城市資訊', async () => {
  let requestedUrl
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url)
    return jsonResponse(makeOpenMeteoFixture())
  }

  const result = await fetchWeather('台中', { fetchImpl })

  assert.equal(result.city.name, '台中')
  assert.equal(requestedUrl.searchParams.get('latitude'), '24.1477')
  assert.equal(requestedUrl.searchParams.get('timezone'), 'Asia/Taipei')
  assertCurrent(result.current)
})
