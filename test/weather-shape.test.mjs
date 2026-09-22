import test from 'node:test'

import { dailyForecast, hourlyForecast } from '../lib/weather-data.js'
import { assertDaily, assertHourly } from './weather-contract.mjs'

test('lib/weather-data.js 的 hourlyForecast 符合契約', () => {
  assertHourly(hourlyForecast)
})

test('lib/weather-data.js 的 dailyForecast 符合契約', () => {
  assertDaily(dailyForecast)
})
