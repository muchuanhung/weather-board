import test from 'node:test'
import assert from 'node:assert/strict'
import {
  hasComparableEvidence,
  createWeatherTool,
  runToolAgent,
  isoDate,
  questionCities,
  withEvidence,
} from '../tools.js'
import { POST } from '../route.js'

const now = new Date('2026-12-31T16:30:00Z')
const weather = {
  current: { updatedAt: '2027-01-01T00:00:00+08:00' },
  daily: [{ date: '1月1日', high: 25, low: 18, rainChance: 0 }],
}

test('工具驗證城市、日期；跨年用台北日期，缺值不補零，重複城市只載入一次', async () => {
  let loads = 0
  const tool = createWeatherTool(async () => {
    loads++
    return weather
  }, now)
  const e = await tool.execute({ city: '台北', dayOffsets: [0, 1] })
  assert.equal(e.daily[0].date, '2027-01-01')
  assert.equal(e.daily[0].rainChance, 0)
  assert.deepEqual(e.missingDates, ['2027-01-02'])
  assert.equal(e.forecastUpdatedAt, null)
  assert.match(withEvidence('回答', [e]), /預報發布時間：未提供/)
  const rendered = withEvidence('回答', [{ ...e, forecastUpdatedAt: '2027-01-01T01:00:00+08:00' }])
  assert.match(rendered, /預報發布時間：.*01:00/)
  assert.match(rendered, /1月1日/)
  assert.doesNotMatch(rendered, /T01:00/)
  await tool.execute({ city: 'Taipei', dayOffsets: [0] })
  assert.equal(loads, 1)
  await assert.rejects(tool.execute({ city: '火星', dayOffsets: [0] }))
  await assert.rejects(tool.execute({ city: '台北', dayOffsets: [7] }))
  await assert.rejects(tool.execute({ city: '台北', dayOffsets: [0] }), /上限/)
})

test('最多三個城市，不允許模型指定 URL 或其他工具參數', async () => {
  const tool = createWeatherTool(async () => weather, now)
  for (const city of ['台北', '宜蘭', '台中']) await tool.execute({ city, dayOffsets: [0] })
  await assert.rejects(tool.execute({ city: '高雄', dayOffsets: [0] }), /三個城市/)
  const other = createWeatherTool(async () => weather, now)
  await assert.rejects(
    other.execute({ city: '台北', dayOffsets: [0], url: 'https://example.com' }),
    /格式/
  )
})

test('模型自行選兩城市日期，tool_result 對應 ID 並送回第二輪', async () => {
  const tool = createWeatherTool(async () => weather, now)
  let requests = 0
  const client = {
    messages: {
      create: async (request) => {
        requests++
        if (requests === 1)
          return {
            stop_reason: 'tool_use',
            content: ['台北', '宜蘭'].map((city, i) => ({
              type: 'tool_use',
              id: `t${i}`,
              name: 'get_weather',
              input: { city, dayOffsets: [0] },
            })),
          }
        const results = request.messages.at(-1).content
        assert.deepEqual(
          results.map((r) => r.tool_use_id),
          ['t0', 't1']
        )
        assert.deepEqual(
          results.map((r) => JSON.parse(r.content).city),
          ['臺北市', '宜蘭縣']
        )
        return { stop_reason: 'end_turn', content: [{ type: 'text', text: '兩地降雨機率相同。' }] }
      },
    },
  }
  const result = await runToolAgent({
    question: '台北還是宜蘭',
    city: '臺北市',
    execute: tool.execute,
    now,
    client,
  })
  assert.equal(result.provider, 'anthropic')
  assert.equal(requests, 2)
  assert.equal(tool.evidence.length, 2)
})

test('工具錯誤會回 is_error；模型截斷與無限工具迴圈會停止', async () => {
  let requests = 0
  const client = {
    messages: {
      create: async (request) => {
        if (++requests > 1) assert.equal(request.messages.at(-1).content[0].is_error, true)
        return {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: `t${requests}`, name: 'unknown', input: {} }],
        }
      },
    },
  }
  await assert.rejects(
    runToolAgent({ question: '天氣', city: '臺北市', execute: async () => assert.fail(), client }),
    /輪數/
  )
  assert.equal(requests, 3)
  client.messages.create = async () => ({
    stop_reason: 'max_tokens',
    content: [{ type: 'text', text: '半句' }],
  })
  await assert.rejects(
    runToolAgent({ question: '天氣', city: '臺北市', execute: async () => {}, client }),
    /截斷/
  )
})

test('規則城市抽取不混淆新竹縣市、台臺簡稱', () => {
  assert.deepEqual(questionCities('台北還是宜蘭', '高雄市'), ['臺北市', '宜蘭縣'])
  assert.deepEqual(questionCities('新竹縣和新竹市', '高雄市'), ['新竹市', '新竹縣'])
})

test('POST 無 LLM 時比較兩城市、附證據；缺雨量不推薦、上游故障回 502', async (t) => {
  const old = {
    fetch: globalThis.fetch,
    key: process.env.CWA_API_KEY,
    llm: process.env.ANTHROPIC_API_KEY,
  }
  t.after(() => {
    globalThis.fetch = old.fetch
    for (const [key, value] of [
      ['CWA_API_KEY', old.key],
      ['ANTHROPIC_API_KEY', old.llm],
    ]) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })
  process.env.CWA_API_KEY = 'mock'
  delete process.env.ANTHROPIC_API_KEY
  let missing = false
  globalThis.fetch = async (url) => {
    const u = new URL(url)
    const city = u.searchParams.get('LocationName')
    if (u.pathname.endsWith('O-A0003-001'))
      return Response.json({ success: true, records: { Station: [] } })
    const date = isoDate(new Date())
    const element = (ElementName, key, value) => ({
      ElementName,
      Time: [
        {
          StartTime: `${date}T06:00:00+08:00`,
          DataTime: `${date}T06:00:00+08:00`,
          ElementValue: [{ [key]: value }],
        },
      ],
    })
    const WeatherElement = u.pathname.endsWith('091')
      ? [
          element('最高溫度', 'MaxTemperature', '28'),
          element('最低溫度', 'MinTemperature', '22'),
          ...(missing
            ? []
            : [
                element(
                  '12小時降雨機率',
                  'ProbabilityOfPrecipitation',
                  city === '臺北市' ? '10' : '80'
                ),
              ]),
        ]
      : [element('溫度', 'Temperature', '25')]
    return Response.json({
      success: true,
      records: { Locations: [{ Location: [{ WeatherElement }] }] },
    })
  }
  const request = (question = '今天台北還是宜蘭適合出門') =>
    POST(
      new Request('http://localhost/api/agent', {
        method: 'POST',
        body: JSON.stringify({ city: 'Taipei', question }),
      })
    )
  const advice = await (await request('今天會不會很熱')).json()
  assert.match(advice.answer, /外套|短袖/)
  assert.doesNotMatch(advice.answer, /T\d{2}:\d{2}/)
  let response = await request()
  assert.equal(response.status, 200)
  let data = await response.json()
  assert.equal(data.mode, 'rules')
  assert.equal(data.evidence.length, 2)
  assert.match(data.answer, /臺北市較適合/)
  assert.match(data.answer, /資料取得時間/)
  const cwaFetch = globalThis.fetch
  let llmCalls = 0
  let toolCities = ['台北', '宜蘭']
  process.env.ANTHROPIC_API_KEY = 'mock-only'
  globalThis.fetch = async (input, options) => {
    const url = input instanceof Request ? input.url : String(input)
    if (!url.startsWith('https://api.anthropic.com/')) return cwaFetch(url, options)
    llmCalls++
    return Response.json({
      id: 'msg_mock',
      type: 'message',
      role: 'assistant',
      model: 'mock',
      stop_reason: llmCalls === 1 ? 'tool_use' : 'end_turn',
      content:
        llmCalls === 1
          ? toolCities.map((city, i) => ({
              type: 'tool_use',
              id: `t${i}`,
              name: 'get_weather',
              input: { city, dayOffsets: [0] },
            }))
          : [{ type: 'text', text: '臺北降雨機率較低。' }],
      usage: { input_tokens: 1, output_tokens: 1 },
    })
  }
  data = await (await request()).json()
  assert.equal(data.mode, 'llm')
  assert.equal(llmCalls, 2)
  assert.deepEqual(
    data.evidence.map((e) => e.city),
    ['臺北市', '宜蘭縣']
  )
  llmCalls = 0
  toolCities = ['宜蘭']
  data = await (await request('我從台北出發去宜蘭玩，那邊天氣如何')).json()
  assert.equal(data.mode, 'llm')
  assert.deepEqual(
    data.evidence.map((e) => e.city),
    ['宜蘭縣']
  )
  llmCalls = 0
  toolCities = ['台北', '宜蘭']
  missing = true
  data = await (await request()).json()
  assert.equal(data.mode, 'rules', '即使 LLM 推薦台北，缺雨量仍須退回明確說明')
  assert.match(data.answer, /無法可靠推薦/)
  delete process.env.ANTHROPIC_API_KEY
  globalThis.fetch = cwaFetch
  missing = true
  data = await (await request()).json()
  assert.match(data.answer, /無法可靠推薦/)
  globalThis.fetch = async () => new Response('', { status: 500 })
  response = await request()
  assert.equal(response.status, 502)
})

test('比較證據必須日期一致，且兩城市各日期的雨量與溫度都完整', () => {
  const entry = (city, date, rainChance = 10) => ({
    city,
    requestedDates: [date],
    daily: [{ date, rainChance, high: 30, low: 24 }],
  })
  const a = entry('臺北市', '2026-09-26')
  const b = entry('宜蘭縣', '2026-09-26')
  const cities = ['臺北市', '宜蘭縣']
  assert.equal(hasComparableEvidence([a, b], cities), true)
  assert.equal(hasComparableEvidence([a], cities), false)
  assert.equal(hasComparableEvidence([a, entry('宜蘭縣', '2026-09-27')], cities), false)
  assert.equal(hasComparableEvidence([a, entry('宜蘭縣', '2026-09-26', null)], cities), false)
  assert.equal(hasComparableEvidence([a, { ...b, daily: [] }], cities), false)
  assert.equal(
    hasComparableEvidence([a, { ...b, daily: [{ ...b.daily[0], high: null }] }], cities),
    false
  )
})
