import { NextResponse } from 'next/server'

import { fetchWeather, WeatherError } from '@/lib/weather-source'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// GET /api/weather?city=Taipei
// 回傳形狀對齊 test/weather-contract.mjs：current / hourly / daily。
export async function GET(request) {
  const cityParam = new URL(request.url).searchParams.get('city')

  try {
    const { city, current, hourly, daily } = await fetchWeather(cityParam)

    return NextResponse.json(
      {
        city: { slug: city.slug, name: city.name },
        current,
        hourly,
        daily,
      },
      {
        headers: { 'cache-control': 'public, s-maxage=600, stale-while-revalidate=300' },
      }
    )
  } catch (error) {
    if (error instanceof WeatherError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      )
    }

    console.error('[api/weather] 未預期錯誤', error)
    return NextResponse.json(
      { error: 'internal_error', message: '氣象資料處理失敗，請稍後再試' },
      { status: 500 }
    )
  }
}
