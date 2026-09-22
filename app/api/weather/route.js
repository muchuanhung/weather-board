import { NextResponse } from 'next/server.js'

import { resolveCity } from '../../../lib/city-map.js'
import { CwaError, fetchCurrentObservation, fetchHourlyForecast, fetchSunTimes, fetchWeeklyForecast } from '../../../lib/cwa.js'
import { buildCurrentWeather, buildDailyForecast, buildHourlyForecast } from '../../../lib/weather-transform.js'

// GET /api/weather?city=Taipei
//
// 成功時回傳：
// {
//   city: "臺北市",          // CWA 官方縣市名
//   query: "Taipei",         // 原始查詢字串
//   updatedAt: "2026-09-22T12:00:00+08:00",
//   current: { temperature, feelsLike, description, kind, humidity, windSpeed, pressure, uvIndex, updatedAt, sunrise, sunset },
//   hourlyForecast: [{ time, temperature, kind }],
//   dailyForecast: [{ day, date, high, low, kind, rainChance }],
// }
//
// 查無城市時回傳 400 + { error, message }；上游 CWA 打不通時回傳 502 + { error, message }。
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const cityQuery = searchParams.get('city')?.trim() || 'Taipei'

  const resolved = resolveCity(cityQuery)
  if (!resolved) {
    return NextResponse.json(
      {
        error: 'city_not_found',
        message: `找不到城市「${cityQuery}」，請用臺灣縣市名稱或常見英文拼音，例如 Taipei、Kaohsiung、台中。`,
      },
      { status: 400 },
    )
  }

  const { countyName, stationName } = resolved
  // 台灣日期，不用 toISOString()（UTC 日期）：主機若不是 Asia/Taipei 時區，
  // 凌晨 0~8 點左右會查到「昨天」的日出日落資料
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })

  try {
    const [observation, hourlyLocation, weeklyLocation, sun] = await Promise.all([
      fetchCurrentObservation(stationName),
      fetchHourlyForecast(countyName),
      fetchWeeklyForecast(countyName),
      fetchSunTimes(countyName, todayStr),
    ])

    const current = buildCurrentWeather({ observation, hourlyLocation, sun })
    const hourlyForecast = buildHourlyForecast(hourlyLocation)
    const dailyForecast = buildDailyForecast(weeklyLocation)
    if (!hourlyForecast.length || !dailyForecast.length) {
      throw new CwaError('缺少必要的預報時段')
    }

    return NextResponse.json({
      city: countyName,
      query: cityQuery,
      updatedAt: current.updatedAt,
      current,
      hourlyForecast,
      dailyForecast,
    })
  } catch {
    const message = '氣象資料取得失敗，請稍後再試'
    return NextResponse.json({ error: 'upstream_error', message }, { status: 502 })
  }
}
