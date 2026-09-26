/** UI e2e 用：不依賴 CWA_API_KEY／外部氣象 API。 */

export function weatherOkPayload(city = 'Taipei') {
  return {
    city,
    query: city,
    updatedAt: '2026-09-24T12:00:00+08:00',
    current: {
      temperature: 28,
      feelsLike: 30,
      description: '晴時多雲',
      kind: 'partly',
      humidity: 70,
      windSpeed: 12,
      pressure: 1013,
      uvIndex: 5,
      updatedAt: '2026-09-24T12:00:00+08:00',
      sunrise: '05:43',
      sunset: '17:55',
    },
    hourlyForecast: [{ time: '現在', temperature: 28, kind: 'partly' }],
    dailyForecast: [
      { day: '今天', date: '9月24日', high: 30, low: 25, kind: 'partly', rainChance: 20 },
    ],
  }
}

/** 攔截 /api/weather，依 query city 回成功 JSON（fork CI 沒有 Actions secret 也能換標題）。 */
export async function mockWeatherOk(page) {
  await page.route('**/api/weather**', async (route) => {
    const url = new URL(route.request().url())
    const city = url.searchParams.get('city')?.trim() || 'Taipei'
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(weatherOkPayload(city)),
    })
  })
}
