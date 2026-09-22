import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveCity, OFFICIAL_COUNTIES } from '../../../../lib/city-map.js'
import { buildCurrentWeather, buildDailyForecast, buildHourlyForecast } from '../../../../lib/weather-transform.js'
import { GET } from '../route.js'

const time = (day, hour) => `2026-09-${day}T${hour}:00:00+08:00`
const element = (name, property, rows) => ({
  ElementName: name,
  Time: rows.map(([StartTime, value]) => ({
    StartTime, DataTime: StartTime, ElementValue: [{ [property]: value }],
  })),
})
const location = (...WeatherElement) => ({ WeatherElement })

test('台／臺 aliases, official counties, English spacing, and invalid object keys', () => {
  for (const [short, county] of [['北', '臺北市'], ['中', '臺中市'], ['南', '臺南市'], ['東', '臺東縣']]) {
    for (const prefix of ['台', '臺']) assert.equal(resolveCity(prefix + short).countyName, county)
  }
  for (const county of OFFICIAL_COUNTIES) assert.equal(resolveCity(county.replaceAll('臺', '台')).countyName, county)
  assert.equal(resolveCity(' NEW TAIPEI ').countyName, '新北市')
  for (const invalid of ['XXX', '__proto__', 'constructor', 'toString']) assert.equal(resolveCity(invalid), null)
})

test('evening forecast never merges tomorrow daytime into today; elements align by date', () => {
  const weekly = location(
    element('最高溫度', 'MaxTemperature', [[time(22, '18'), 26], [time(23, '06'), 34], [time(23, '18'), 27]]),
    element('最低溫度', 'MinTemperature', [[time(23, '18'), 23], [time(22, '18'), 22], [time(23, '06'), 28]]),
    element('12小時降雨機率', 'ProbabilityOfPrecipitation', [[time(23, '06'), 70]]),
  )
  assert.deepEqual(buildDailyForecast(weekly, 7, time(22, '20')), [
    { day: '今天', date: '9月22日', high: 26, low: 22, kind: 'sun', rainChance: null },
    { day: '明天', date: '9月23日', high: 34, low: 23, kind: 'sun', rainChance: 70 },
  ])
})

test('partial midnight period and daytime/nighttime on the same date form one row', () => {
  const weekly = location(element('最高溫度', 'MaxTemperature', [
    [time(22, '00'), 24], [time(22, '06'), 30], [time(22, '18'), 25], [time(23, '06'), 31],
  ]))
  const rows = buildDailyForecast(weekly, 7, time(22, '01'))
  assert.equal(rows.length, 2)
  assert.equal(rows[0].high, 30)
  assert.equal(rows[0].low, null)
})

test('calendar labels use Taiwan date even with a UTC clock and skip past dates', () => {
  const weekly = location(element('最高溫度', 'MaxTemperature', [
    [time(22, '06'), 30], [time(23, '06'), 31], [time(24, '06'), 32],
  ]))
  assert.deepEqual(buildDailyForecast(weekly, 7, '2026-09-22T16:30:00Z').map(x => x.day), ['今天', '明天'])
  assert.equal(buildDailyForecast(weekly, 1, time(21, '20'))[0].day, '明天')
})

test('missing numbers stay null while zero and legitimate negative temperatures survive', () => {
  const values = ['-99', '-999', '', ' ', '-', undefined, Infinity, '0', '-5']
  const hourly = location(element('溫度', 'Temperature', values.map(value => [time(22, '12'), value])))
  assert.deepEqual(buildHourlyForecast(hourly, 9).map(x => x.temperature), [null, null, null, null, null, null, null, 0, -5])
  const weekly = location(
    element('最高溫度', 'MaxTemperature', [[time(22, '06'), '-99']]),
    element('最低溫度', 'MinTemperature', [[time(22, '06'), '-999']]),
    element('12小時降雨機率', 'ProbabilityOfPrecipitation', [[time(22, '06'), '0']]),
  )
  const row = buildDailyForecast(weekly, 7, time(22, '12'))[0]
  assert.equal(row.high, null)
  assert.equal(row.low, null)
  assert.equal(row.rainChance, 0)
})

test('current weather uses forecast fallback and keeps optional metrics null', () => {
  const current = buildCurrentWeather({ observation: null, sun: null, hourlyLocation: location(
    element('溫度', 'Temperature', [[time(22, '12'), '28']]),
    element('相對濕度', 'RelativeHumidity', [[time(22, '12'), '65']]),
  ) })
  assert.equal(current.temperature, 28)
  assert.equal(current.feelsLike, 28)
  assert.equal(current.humidity, 65)
  for (const field of ['windSpeed', 'pressure', 'uvIndex', 'sunrise', 'sunset']) assert.equal(current[field], null)
  const empty = buildCurrentWeather({})
  for (const field of ['temperature', 'feelsLike', 'humidity']) assert.equal(empty[field], null)
})

test('GET contract: default city, aliases, optional failures, empty forecasts, and safe errors', async (t) => {
  const originalKey = process.env.CWA_API_KEY
  t.after(() => {
    if (originalKey === undefined) delete process.env.CWA_API_KEY
    else process.env.CWA_API_KEY = originalKey
  })
  process.env.CWA_API_KEY = 'test-only'
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const start = `${today}T06:00:00+08:00`
  let mode = 'success'
  let calls = 0
  t.mock.method(globalThis, 'fetch', async (input) => {
    calls++
    const url = new URL(input)
    const id = url.pathname.split('/').at(-1)
    assert.equal(url.searchParams.get('Authorization'), 'test-only')
    if (id === 'O-A0003-001' || id === 'A-B0062-001') return new Response('', { status: 500 })
    if (mode === 'failure') return new Response('', { status: 500 })
    const forecast = id === 'F-D0047-089'
      ? location(element('溫度', 'Temperature', [[start, '28']]))
      : location(element('最高溫度', 'MaxTemperature', [[start, '30']]))
    return Response.json({ success: 'true', records: { Locations: [{ Location: mode === 'empty' ? [] : [forecast] }] } })
  })
  const request = (query = '') => GET(new Request(`http://localhost/api/weather${query}`))
  const response = await request()
  const data = await response.json()
  assert.equal(response.status, 200)
  assert.equal(data.city, '臺北市')
  assert.equal(data.query, 'Taipei')
  assert.equal(data.current.temperature, 28)
  assert.equal(data.current.sunrise, null)
  assert.equal(data.updatedAt, data.current.updatedAt)
  assert.equal(Object.keys(data.current).length, 11)
  assert.equal((await request('?city=' + encodeURIComponent('臺中'))).status, 200)
  const before = calls
  const invalid = await request('?city=__proto__')
  assert.equal(invalid.status, 400)
  assert.equal((await invalid.json()).error, 'city_not_found')
  assert.equal(calls, before)
  for (mode of ['failure', 'empty']) {
    const response = await request()
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: 'upstream_error', message: '氣象資料取得失敗，請稍後再試' })
  }
  delete process.env.CWA_API_KEY
  const missingKey = await request()
  assert.equal(missingKey.status, 502)
  assert.equal((await missingKey.json()).message, '氣象資料取得失敗，請稍後再試')
})
