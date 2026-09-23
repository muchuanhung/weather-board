const HOURS = Array.from(
  { length: 24 },
  (_, hour) => `2026-09-22T${String(hour).padStart(2, '0')}:00`
)

const DAYS = ['2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25', '2026-09-26']

/**
 * @param {object} [options]
 * @param {number} [options.hourlyRain] 每小時降雨機率（整段套同一個值，方便測門檻）
 * @param {number} [options.todayRain] daily[0] 的降雨機率
 */
export function makeOpenMeteoFixture({ hourlyRain = 10, todayRain = 20 } = {}) {
  return {
    current: {
      time: '2026-09-22T13:00',
      temperature_2m: 28.4,
      apparent_temperature: 30.1,
      weather_code: 2,
      is_day: 1,
    },
    hourly: {
      time: HOURS,
      temperature_2m: HOURS.map((_, hour) => 22 + (hour % 10)),
      weather_code: HOURS.map((_, hour) => (hour >= 16 && hour <= 20 ? 80 : hour >= 21 ? 0 : 2)),
      is_day: HOURS.map((_, hour) => (hour >= 6 && hour <= 17 ? 1 : 0)),
      precipitation_probability: HOURS.map(() => hourlyRain),
    },
    daily: {
      time: DAYS,
      weather_code: [2, 0, 3, 61, 1],
      temperature_2m_max: [30.2, 31.4, 29.8, 27.6, 29.1],
      temperature_2m_min: [25.1, 25.3, 24.7, 24.2, 23.8],
      precipitation_probability_max: [todayRain, 10, 30, 70, 40],
    },
  }
}
