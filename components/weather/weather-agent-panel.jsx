'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Sparkles } from 'lucide-react'

export function WeatherAgentPanel({ city = 'Taipei', onAsk }) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const textareaRef = useRef(null)
  const answerEndRef = useRef(null)

  const quickQuestions = [
    '今天要帶傘嗎？',
    '晚上會冷嗎？',
    '適合戶外運動嗎？',
    '未來幾小時會下雨嗎？',
  ]

  // Auto-scroll to bottom when answer updates
  useEffect(() => {
    if (answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [answer])

  // Auto-expand textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 100)}px`
    }
  }, [question])

  async function handleQuestion(q) {
    if (!q.trim()) return

    const queryText = q.trim()
    setQuestion('')
    setAnswer('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, question: queryText }),
      })

      const data = await response.json()

      if (!data.ok) {
        setError(data.error || '無法取得回答，請稍後再試')
      } else {
        setAnswer(data.answer || '暫無回答')
      }
    } catch (err) {
      setError('連線失敗，請檢查網路後再試')
    } finally {
      setLoading(false)
    }

    onAsk?.(queryText)
  }

  function handleChipClick(chip) {
    handleQuestion(chip)
  }

  function handleSendClick() {
    handleQuestion(question)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSendClick()
    }
  }

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '關閉天氣小幫手' : '打開天氣小幫手'}
        className={`fixed right-6 bottom-6 z-40 flex size-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          isOpen
            ? 'bg-[#1769aa] text-white hover:bg-[#1560a0]'
            : 'bg-white text-[#1769aa] hover:shadow-xl'
        }`}
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {/* Panel Card */}
      {isOpen && (
        <div className="animate-in fade-in slide-in-from-bottom-4 pb-safe fixed right-6 bottom-24 z-50 w-full max-w-sm duration-200">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
            {/* Header */}
            <div className="border-b border-slate-100 bg-gradient-to-r from-[#1769aa] to-[#1560a0] px-5 py-4 text-white">
              <div className="flex items-center gap-2">
                <Sparkles size={18} />
                <div>
                  <h2 className="font-semibold">天氣小幫手</h2>
                  <p className="text-xs text-blue-100">依目前天氣回答</p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="flex max-h-[70vh] flex-col overflow-hidden">
              {/* Quick Questions — 常駐，回答後仍可再點 */}
              <div className="border-b border-slate-100 px-4 py-4">
                <p className="mb-2 text-xs font-medium text-slate-600">快速提問</p>
                <div className="flex flex-wrap gap-2">
                  {quickQuestions.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleChipClick(chip)}
                      disabled={loading}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Answer Area */}
              <div className="min-h-[4.5rem] flex-1 overflow-y-auto px-4 py-4">
                {!answer && !loading && !error && (
                  <p className="text-sm text-slate-400">點上方快捷問題，或自行輸入提問。</p>
                )}
                {loading && (
                  <div className="space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-200" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
                  </div>
                )}
                {error && (
                  <div className="rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">
                    {error}
                  </div>
                )}
                {answer && !loading && (
                  <div>
                    <p className="text-sm leading-6 text-slate-700">{answer}</p>
                    <div ref={answerEndRef} />
                  </div>
                )}
              </div>

              {/* Input Area */}
              <div className="border-t border-slate-100 bg-slate-50 p-4">
                <div className="mb-2 flex gap-2">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value.slice(0, 80))}
                    onKeyDown={handleKeyDown}
                    placeholder="問我今天天氣相關問題…"
                    disabled={loading}
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 transition outline-none focus:border-[#1769aa] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                    style={{ maxHeight: '100px', minHeight: '40px' }}
                  />
                  <button
                    onClick={handleSendClick}
                    disabled={loading || !question.trim()}
                    aria-label="送出提問"
                    className="flex size-10 items-center justify-center rounded-lg bg-[#1769aa] text-white transition hover:bg-[#1560a0] disabled:bg-slate-300"
                  >
                    <Send size={18} />
                  </button>
                </div>
                <p className="text-right text-[10px] text-slate-500">{question.length}/80</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
