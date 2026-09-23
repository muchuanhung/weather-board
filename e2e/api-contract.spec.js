import { existsSync } from 'node:fs'

import { expect, test } from '@playwright/test'

import { assertCurrent, assertDaily, assertHourly } from '../test/weather-contract.mjs'

const routeExists = existsSync(new URL('../app/api/weather/route.js', import.meta.url))
const hasCwaKey = Boolean(process.env.CWA_API_KEY?.trim())

test.describe('GET /api/weather 契約', () => {
  test.skip(!routeExists, 'app/api/weather/route.js 還沒建')

  test('回傳形狀符合契約', async ({ request }) => {
    // Fork PR 拿不到 repo secrets；沒 key 打真 CWA 只會 502
    test.skip(!hasCwaKey, '需要 CWA_API_KEY（fork PR 或 Actions secret 未設定時略過）')

    const res = await request.get('/api/weather?city=Taipei')
    expect(res.status()).toBe(200)

    const body = await res.json()
    assertCurrent(body.current)
    assertHourly(body.hourlyForecast)
    assertDaily(body.dailyForecast)
  })

  test('查不到的城市要回明確錯誤，不能回 200 空資料', async ({ request }) => {
    const res = await request.get('/api/weather?city=__not_a_city__')
    expect(res.status()).toBeGreaterThanOrEqual(400)
    expect(await res.json()).toHaveProperty('error')
  })
})
