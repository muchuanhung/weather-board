import assert from 'node:assert/strict'
import test from 'node:test'

import { answerByRules, findDayByPattern } from '../route.js'

const WEEKDAYS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六']

// 對齊 lib/weather-transform.js 的 formatDayLabel：標籤由「離今天幾天」決定，
// 不是由陣列索引決定，所以陣列從明天開始時第一筆會是「明天」。
function buildDaily({ today, start = today, count }) {
  const todayUtc = Date.parse(today)
  const startUtc = Date.parse(start)

  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startUtc + i * 86400000)
    const offset = Math.round((d.getTime() - todayUtc) / 86400000)
    return {
      day: offset === 0 ? '今天' : offset === 1 ? '明天' : WEEKDAYS[d.getUTCDay()],
      date: `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`,
      high: 30,
      low: 24,
      kind: 'partly',
      rainChance: 10,
    }
  })
}

const dates = (rows) => rows.map((r) => r.date)

// 2026-09-23 為週三、09-26 為週六、09-27 為週日
const WED = '2026-09-23T00:00:00Z'
const SAT = '2026-09-26T00:00:00Z'

test('兩個日期之間的「到公司」不是區間連接詞', () => {
  const daily = buildDaily({ today: WED, count: 7 })
  assert.deepEqual(
    dates(findDayByPattern(daily, '週四到公司，週日去公園，要帶傘嗎', new Date(WED))),
    ['9月24日', '9月27日']
  )
})

test('明確連接詞允許空白，但不跨越標點展開區間', () => {
  const daily = buildDaily({ today: WED, count: 7 })
  for (const connective of ['到', '至', '~', '～']) {
    assert.deepEqual(dates(findDayByPattern(daily, `週四 ${connective} 週日`, new Date(WED))), [
      '9月24日',
      '9月25日',
      '9月26日',
      '9月27日',
    ])
  }
  assert.deepEqual(dates(findDayByPattern(daily, '週四到，週日', new Date(WED))), [
    '9月24日',
    '9月27日',
  ])
})

test('反向區間回 null，規則答案明確請使用者拆開問', () => {
  const daily = buildDaily({ today: WED, count: 7 })
  const weather = { current: {}, hourly: [], daily, today: daily[0] }
  for (const question of ['週日到週四', '明天到今天', '週末到週六', '今天和週日到週四']) {
    assert.equal(findDayByPattern(daily, question, new Date(WED)), null)
    const answer = answerByRules(question, '臺北市', weather, new Date(WED))
    assert.match(answer, /無法判讀.*拆開問/)
    assert.doesNotMatch(answer, /最高|沒有該日期/)
  }
})

test('合法與無法判讀的區間並存時，整句提示拆開問並保留城市名', () => {
  const daily = buildDaily({ today: WED, count: 7 })
  const weather = { current: {}, hourly: [], daily, today: daily[0] }
  const now = new Date(WED)
  assert.deepEqual(dates(findDayByPattern(daily, '週四到週五', now)), ['9月24日', '9月25日'])
  for (const question of ['週四到週五，週日到週三', '週日到週三，週四到週五']) {
    assert.equal(findDayByPattern(daily, question, now), null)
    const answer = answerByRules(question, '臺中市', weather, now)
    assert.match(answer, /^臺中市.*無法判讀.*拆開問/)
    assert.doesNotMatch(answer, /最高|9月24日|沒有該日期/)
  }
})

test('週日問「明天到週末」不會連今天一起回傳，也不當成資料缺失', () => {
  const now = new Date('2026-09-27T04:00:00Z')
  const daily = buildDaily({ today: '2026-09-27T00:00:00Z', count: 7 })
  for (const rows of [daily, []]) {
    assert.equal(findDayByPattern(rows, '明天到週末', now), null)
    const answer = answerByRules(
      '明天到週末',
      '臺北市',
      { current: {}, hourly: [], daily: rows, today: rows[0] },
      now
    )
    assert.match(answer, /無法判讀.*拆開問/)
    assert.doesNotMatch(answer, /9月27日|沒有該日期/)
  }
})

test('同一天作為起訖仍可以查詢，不會被當成反向區間', () => {
  const daily = buildDaily({ today: WED, count: 7 })
  assert.deepEqual(dates(findDayByPattern(daily, '週四到週四', new Date(WED))), ['9月24日'])
})

test('今天是週六時，「週六」對應到標籤為「今天」的那筆', () => {
  const now = new Date('2026-09-26T04:00:00Z')
  const daily = buildDaily({ today: SAT, count: 7 })

  assert.equal(daily[0].day, '今天', 'fixture 前提：今天那筆標籤不是星期名')
  assert.deepEqual(dates(findDayByPattern(daily, '週六天氣如何', now)), ['9月26日'])
})

test('今天是週六時，「週末」涵蓋今天與明天', () => {
  const now = new Date('2026-09-26T04:00:00Z')
  const daily = buildDaily({ today: SAT, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '這週末適合出門嗎', now)), ['9月26日', '9月27日'])
})

test('「到」是區間，「明天到週末」要補上中間的週五', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '明天到週末如何', now)), [
    '9月24日', // 明天（週四）
    '9月25日', // 週五 —— 區間中間，問題沒提到但要補
    '9月26日', // 週六
    '9月27日', // 週日
  ])
})

test('「週四到週日」包含中間的週五、週六', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '週四到週日出門好嗎', now)), [
    '9月24日',
    '9月25日',
    '9月26日',
    '9月27日',
  ])
})

test('「和」不是區間，「週四和週日」不補中間的日期', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '週四和週日哪天好', now)), ['9月24日', '9月27日'])
})

test('只命中一天時，句中的「到」不會誤補區間', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '明天要帶傘到公司嗎', now)), ['9月24日'])
})

test('「到」在最後一個日期之後，不構成區間', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  // 「到公司」的「到」不在週四與週日之間，不能展開成四五六日
  assert.deepEqual(dates(findDayByPattern(daily, '週四和週日要帶傘到公司嗎', now)), [
    '9月24日',
    '9月27日',
  ])
})

test('一句話裡區間與並列並存，只展開區間那一段', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  // 週四到週五是區間；週日是另外並列的，中間的週六不能被補進來
  assert.deepEqual(dates(findDayByPattern(daily, '週四到週五，還有週日', now)), [
    '9月24日',
    '9月25日',
    '9月27日',
  ])
})

test('區間起點缺資料時，仍回傳範圍內其他有資料的日期', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  // 缺週四（9月24日），只有週五之後有資料
  const daily = buildDaily({ today: WED, start: '2026-09-25T00:00:00Z', count: 5 })

  assert.equal(dates(daily).includes('9月24日'), false, 'fixture 前提：週四沒有資料')
  assert.deepEqual(dates(findDayByPattern(daily, '週四到週日如何', now)), [
    '9月25日',
    '9月26日',
    '9月27日',
  ])
})

test('區間中間缺一天就略過那天，不影響兩端', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 }).filter((d) => d.date !== '9月26日')

  assert.deepEqual(dates(findDayByPattern(daily, '週四到週日如何', now)), [
    '9月24日',
    '9月25日',
    '9月27日',
  ])
})

test('「後天」依日期推算，不依賴陣列索引', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  // 今天沒有資料，陣列從明天開始；第一筆標籤應為「明天」，索引 2 是大後天
  const daily = buildDaily({ today: WED, start: '2026-09-24T00:00:00Z', count: 5 })

  assert.equal(daily[0].day, '明天', 'fixture 前提：陣列第一筆不是今天')
  assert.deepEqual(dates(findDayByPattern(daily, '後天會下雨嗎', now)), ['9月25日'])
})

test('查詢的日期不在預報範圍時回空陣列', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 2 })

  assert.deepEqual(findDayByPattern(daily, '後天會下雨嗎', now), [])
})

test('回傳維持 daily 原本的日期順序', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = buildDaily({ today: WED, count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '週日跟週六哪天好', now)), ['9月26日', '9月27日'])
})

test('以台灣日期為準，主機在 UTC 也不會算成前一天', () => {
  // UTC 2026-09-26 16:30 → 台北已是 09-27（週日）
  const now = new Date('2026-09-26T16:30:00Z')
  const daily = buildDaily({ today: '2026-09-27T00:00:00Z', count: 5 })

  assert.deepEqual(dates(findDayByPattern(daily, '今天天氣如何', now)), ['9月27日'])
})

test('跨年時能找到隔年的日期', () => {
  // 台北時間 2026-12-28（週一），預報跨到 2027-01-03
  const now = new Date('2026-12-28T04:00:00Z')
  const daily = buildDaily({ today: '2026-12-28T00:00:00Z', count: 7 })

  assert.deepEqual(dates(findDayByPattern(daily, '這週末如何', now)), ['1月2日', '1月3日'])
})

test('date 欄位缺失時，仍能以標籤回答今天與明天', () => {
  const now = new Date('2026-09-23T04:00:00Z')
  const daily = [
    { day: '今天', date: null, high: 30, low: 24, kind: 'partly', rainChance: 10 },
    { day: '明天', date: null, high: 31, low: 24, kind: 'sun', rainChance: 0 },
  ]

  assert.deepEqual(findDayByPattern(daily, '明天要帶傘嗎', now), [daily[1]])
})

test('answerByRules 在今天是週六時能回答週末，不再回查無資料', () => {
  const now = new Date('2026-09-26T04:00:00Z')
  const daily = buildDaily({ today: SAT, count: 7 })
  const weather = {
    current: { description: '晴', temperature: 30, feelsLike: 32, uvIndex: 5 },
    hourly: [],
    daily,
    today: daily[0],
  }

  const answer = answerByRules('這週末天氣如何', '臺北市', weather, now)
  assert.match(answer, /9月26日/)
  assert.match(answer, /9月27日/)
  assert.doesNotMatch(answer, /沒有該日期/)
})
