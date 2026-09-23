import { NextResponse } from 'next/server.js'

// POST /api/agent
// 接收 { city: string, question: string }
// 回傳 { ok: true, answer: string } 或 { ok: false, error: string }
//
// 此為示範實作。實際應用應整合 LLM（如 OpenAI、Claude）與天氣 API。
// 本實作使用簡單規則匹配展示快速原型。

const weatherResponses = {
  '今天要帶傘嗎？': {
    keywords: ['傘', '下雨', '雨'],
    responses: [
      '根據目前預報，降雨機率中等。建議隨身帶把傘，以防不時之需。',
      '今天有降雨的可能性。出門前檢查一下天氣，帶把傘比較安心。',
      '預報顯示可能有陣雨。為了安全起見，建議帶上傘具。',
    ],
  },
  '晚上會冷嗎？': {
    keywords: ['冷', '溫度', '晚上'],
    responses: [
      '根據預報，晚上溫度會逐漸下降。建議準備一件薄外套以備不時之需。',
      '晚上會比白天涼爽。如果你怕冷，可以帶件外套出門。',
      '預報顯示晚間溫度會降低。建議穿著分層衣物以便調整。',
    ],
  },
  '適合戶外運動嗎？': {
    keywords: ['運動', '戶外', '適合'],
    responses: [
      '今天的天氣條件尚可，適合進行一些戶外活動。記得補充水分，做好防曬。',
      '目前天氣狀況良好，可以進行戶外運動。建議在早晨或傍晚進行，避免中午炎熱。',
      '天氣預報看起來不錯，很適合戶外活動。別忘了帶水和防曬用品。',
    ],
  },
  '未來幾小時會下雨嗎？': {
    keywords: ['下雨', '雨', '時間'],
    responses: [
      '根據逐時預報，未來幾小時降雨機率較低。天氣應該會保持相對穩定。',
      '預報顯示近幾小時內下雨的可能性不大。可以放心進行戶外活動。',
      '看起來未來幾小時不太可能下雨。如有計畫，現在是出門的好時機。',
    ],
  },
}

function getRandomResponse(responses) {
  return responses[Math.floor(Math.random() * responses.length)]
}

function generateAnswer(question, city) {
  // 簡單的規則匹配邏輯
  const normalized = question.toLowerCase()

  // 檢查是否匹配預定義的問題
  for (const [predefinedQ, data] of Object.entries(weatherResponses)) {
    if (question === predefinedQ || normalized.includes(predefinedQ.toLowerCase())) {
      return getRandomResponse(data.responses)
    }
  }

  // 通用回覆
  const genericResponses = [
    `根據${city}目前的天氣狀況，建議您查看詳細的預報資訊。如有具體問題，可以使用快速提問功能。`,
    `${city}目前的天氣資料已更新。關於您的問題，建議參考頁面上的詳細氣象資訊。`,
    `感謝您的提問。${city}的天氣狀況我已掌握，可使用快速提問獲得更具體的建議。`,
  ]

  return getRandomResponse(genericResponses)
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { city, question } = body

    // 基本驗證
    if (!city || typeof city !== 'string') {
      return NextResponse.json(
        { ok: false, error: '缺少必要參數：city' },
        { status: 400 }
      )
    }

    if (!question || typeof question !== 'string') {
      return NextResponse.json(
        { ok: false, error: '缺少必要參數：question' },
        { status: 400 }
      )
    }

    // 長度限制
    if (question.length > 200) {
      return NextResponse.json(
        { ok: false, error: '提問過長，請保持在 200 字以內' },
        { status: 400 }
      )
    }

    // 生成回答
    const answer = generateAnswer(question, city)

    return NextResponse.json(
      {
        ok: true,
        answer,
        mode: 'rules', // 可用於前端判斷回答模式
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Agent API Error]', error)
    return NextResponse.json(
      { ok: false, error: '發生錯誤，請稍後再試' },
      { status: 500 }
    )
  }
}
