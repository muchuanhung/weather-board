export const WEATHER_KINDS = ['sun', 'partly', 'cloud', 'rain', 'moon']

function fail(message) {
  throw new Error(`契約不符：${message}`)
}

function assertKind(kind, where) {
  if (!WEATHER_KINDS.includes(kind)) {
    fail(`${where}.kind 是 ${JSON.stringify(kind)}，只允許 ${WEATHER_KINDS.join(' / ')}`)
  }
}

function assertText(value, where) {
  if (typeof value !== 'string' || value.trim() === '') {
    fail(`${where} 要是非空字串，收到 ${JSON.stringify(value)}`)
  }
}

function assertNumber(value, where) {
  if (!Number.isFinite(value)) fail(`${where} 要是數字，收到 ${JSON.stringify(value)}`)
}

/** API-CONTRACT：部分數值欄位為 number | null */
function assertNumberOrNull(value, where) {
  if (value === null) return
  assertNumber(value, where)
}

export function assertCurrent(current) {
  if (!current || typeof current !== 'object') fail('current 要是物件')
  assertNumberOrNull(current.temperature, 'current.temperature')
  assertNumberOrNull(current.feelsLike, 'current.feelsLike')
  assertText(current.description, 'current.description')
  assertKind(current.kind, 'current')
  assertText(current.updatedAt, 'current.updatedAt')
}

export function assertHourly(hourly) {
  if (!Array.isArray(hourly) || hourly.length === 0) fail('hourly 要是非空陣列')
  hourly.forEach((item, i) => {
    const where = `hourly[${i}]`
    assertText(item.time, `${where}.time`)
    assertNumberOrNull(item.temperature, `${where}.temperature`)
    assertKind(item.kind, where)
  })
}

export function assertDaily(daily) {
  if (!Array.isArray(daily) || daily.length === 0) fail('daily 要是非空陣列')
  daily.forEach((item, i) => {
    const where = `daily[${i}]`
    assertText(item.day, `${where}.day`)
    assertText(item.date, `${where}.date`)
    assertNumberOrNull(item.high, `${where}.high`)
    assertNumberOrNull(item.low, `${where}.low`)
    if (Number.isFinite(item.high) && Number.isFinite(item.low) && item.high < item.low) {
      fail(`${where} 的 high(${item.high}) 小於 low(${item.low})`)
    }
    assertKind(item.kind, where)
    assertNumberOrNull(item.rainChance, `${where}.rainChance`)
    if (item.rainChance !== null && (item.rainChance < 0 || item.rainChance > 100)) {
      fail(`${where}.rainChance 要落在 0–100，收到 ${item.rainChance}`)
    }
  })
}
