export const hourlyForecast = [
  { time: '現在', temperature: 28, kind: 'sun' },
  { time: '13:00', temperature: 29, kind: 'sun' },
  { time: '14:00', temperature: 29, kind: 'partly' },
  { time: '15:00', temperature: 28, kind: 'partly' },
  { time: '16:00', temperature: 27, kind: 'cloud' },
  { time: '17:00', temperature: 26, kind: 'cloud' },
  { time: '18:00', temperature: 25, kind: 'moon' },
  { time: '19:00', temperature: 25, kind: 'moon' },
]

// kind 可用值：'sun' | 'partly' | 'cloud' | 'rain' | 'moon'
// rainChance 為降雨機率，0 - 100 的數字
export const dailyForecast = [
  { day: '今天', date: '9月21日', high: 30, low: 25, kind: 'partly', rainChance: 20 },
  { day: '週二', date: '9月22日', high: 31, low: 25, kind: 'sun', rainChance: 10 },
  { day: '週三', date: '9月23日', high: 30, low: 24, kind: 'partly', rainChance: 30 },
  { day: '週四', date: '9月24日', high: 28, low: 24, kind: 'rain', rainChance: 60 },
  { day: '週五', date: '9月25日', high: 29, low: 23, kind: 'partly', rainChance: 40 },
]
