import Anthropic from '@anthropic-ai/sdk'

// 統一 LLM 入口（目前只接 Anthropic / Claude）。

export const SYSTEM_PROMPT = `你是 weather-board 網站的「天氣小幫手」。
使用者會問某個臺灣縣市的天氣生活問題（帶傘、穿衣、戶外活動、週末計畫等）。
只根據 <weather> 內的資料回答，用繁體中文、1 到 2 句話，口吻親切直接，並帶出關鍵數字（降雨機率、氣溫）。
<weather> 包含現在天氣、未來逐時預報、以及未來幾天（約一週）的每日預報，可回答關於明天、後天、週末、特定星期幾的問題。
資料看不出答案時就直說，不要臆測；與天氣無關的問題，簡短說明你只回答天氣相關問題。`

const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'

function buildUserMessage(context, question) {
  return `<weather>\n${context}\n</weather>\n\n問題：${question}`
}

// 傳統問答與 Tool Calling 共用 SDK 設定及停止原因檢查。
export function createLlmClient() {
  return new Anthropic({ timeout: 20_000, maxRetries: 0 })
}

export async function requestLlmMessage(params, client = createLlmClient()) {
  const response = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'low' },
    ...params,
  })
  if (response.stop_reason === 'refusal') throw new Error('Claude 拒答')
  if (response.stop_reason === 'max_tokens') throw new Error('Claude 回答被截斷')
  return response
}

async function askAnthropic(context, question) {
  const response = await requestLlmMessage({
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(context, question) }],
  })
  const answer = response.content
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('')
    .trim()
  if (!answer) throw new Error('Claude 回傳空白')
  return answer
}

/**
 * @param {{ context: string, question: string }} params
 * @returns {Promise<{ answer: string, provider: 'anthropic' } | null>}
 */
export async function askLlm({ context, question }) {
  if (!process.env.ANTHROPIC_API_KEY) return null
  const answer = await askAnthropic(context, question)
  return { answer, provider: 'anthropic' }
}

export function formatLlmError(error) {
  if (error instanceof Anthropic.APIError) return ` (HTTP ${error.status})`
  return error?.message ? ` (${error.message})` : ''
}
