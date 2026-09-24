'use client'

import { useState, useRef, useEffect } from 'react'
import { MessageCircle, Send, X, Sparkles, ChevronDown } from 'lucide-react'

function splitAnswer(text) {
  if (!text) return { main: '', source: '' }
  const index = text.indexOf('資料依據')
  if (index === -1) return { main: text.trim(), source: '' }
  return {
    main: text.slice(0, index).trim(),
    source: text.slice(index).trim(),
  }
}

export function WeatherAgentPanel({ city = 'Taipei', onAsk }) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showSource, setShowSource] = useState(false)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(null)
  const textareaRef = useRef(null)
  const answerEndRef = useRef(null)

  const { main: answerMain, source: answerSource } = splitAnswer(answer)

  const quickQuestions = [
    '今天要帶傘嗎？',
    '晚上會冷嗎？',
    '適合戶外運動嗎？',
    '未來幾小時會下雨嗎？',
  ]

  useEffect(() => {
    if (!isOpen) return
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return

    function handleResize() {
      const offsetFromBottom = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      setKeyboardOffset(offsetFromBottom)
      setViewportHeight(vv.height)
    }

    handleResize()
    vv.addEventListener('resize', handleResize)
    vv.addEventListener('scroll', handleResize)
    return () => {
      vv.removeEventListener('resize', handleResize)
      vv.removeEventListener('scroll', handleResize)
    }
  }, [isOpen])

  // 開面板時鎖 body scroll（避免背後頁面跟著滾），並補回捲軸寬度避免版面位移
  useEffect(() => {
    if (!isOpen) return
    const scrollY = window.scrollY
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.left = '0'
    document.body.style.right = '0'
    document.body.style.overflow = 'hidden'
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`
    }
    return () => {
      document.body.style.position = ''
      document.body.style.top = ''
      document.body.style.left = ''
      document.body.style.right = ''
      document.body.style.overflow = ''
      document.body.style.paddingRight = ''
      window.scrollTo(0, scrollY)
    }
  }, [isOpen])

  useEffect(() => {
    if (answerEndRef.current) {
      answerEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [answer])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 88)}px`
    }
  }, [question])

  async function handleQuestion(q) {
    if (!q.trim()) return

    const queryText = q.trim()
    setQuestion('')
    setAnswer('')
    setError('')
    setShowSource(false)
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
    } catch {
      setError('連線失敗，請檢查網路後再試')
    } finally {
      setLoading(false)
    }

    onAsk?.(queryText)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleQuestion(question)
    }
  }

  // 關閉時不套用舊 keyboard offset，避免 FAB 飄位
  const fabLift = isOpen && keyboardOffset > 0 ? keyboardOffset + 16 : 0
  const panelLift = isOpen && keyboardOffset > 0 ? keyboardOffset + 72 : 0
  const panelMaxHeight =
    isOpen && viewportHeight != null ? Math.max(240, viewportHeight - 88) : undefined

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[2px]"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={isOpen ? '關閉天氣小幫手' : '打開天氣小幫手'}
        style={{
          bottom: `calc(${fabLift}px + max(1rem, env(safe-area-inset-bottom)))`,
        }}
        className={`fixed right-4 z-40 flex size-12 items-center justify-center rounded-full shadow-lg transition-all duration-200 sm:right-6 sm:size-14 ${
          isOpen
            ? 'bg-[#1769aa] text-white hover:bg-[#1560a0]'
            : 'bg-white text-[#1769aa] hover:shadow-xl'
        }`}
      >
        {isOpen ? <X size={22} /> : <MessageCircle size={22} />}
      </button>

      {isOpen && (
        <div
          style={{
            bottom: `calc(${panelLift}px + max(4.5rem, calc(3.5rem + env(safe-area-inset-bottom))))`,
            maxHeight: panelMaxHeight != null ? `${panelMaxHeight}px` : undefined,
          }}
          className="fixed inset-x-3 z-50 mx-auto flex w-auto max-w-sm flex-col sm:inset-x-auto sm:right-6 sm:left-auto sm:w-full"
        >
          <div className="flex max-h-[min(32rem,calc(100dvh-7.5rem))] min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xl">
            <div className="shrink-0 border-b border-slate-100 bg-gradient-to-r from-[#1769aa] to-[#1560a0] px-4 py-3 text-white sm:px-5 sm:py-4">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="shrink-0" />
                <div className="min-w-0">
                  <h2 className="font-semibold">天氣小幫手</h2>
                  <p className="truncate text-xs text-blue-100">依目前天氣回答 · {city}</p>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {/* 手機：橫向滑動 chips，少佔高 */}
              <div className="shrink-0 border-b border-slate-100 px-3 py-3 sm:px-4 sm:py-4">
                <p className="mb-2 text-xs font-medium text-slate-600">快速提問</p>
                <div className="-mx-1 flex [scrollbar-width:none] gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
                  {quickQuestions.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => handleQuestion(chip)}
                      disabled={loading}
                      className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium whitespace-nowrap text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:py-4">
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
                    <p className="text-sm leading-6 break-words text-slate-700">{answerMain}</p>

                    {answerSource && (
                      <div className="mt-3 border-t border-slate-100 pt-2">
                        <button
                          type="button"
                          onClick={() => setShowSource(!showSource)}
                          aria-expanded={showSource}
                          className="flex items-center gap-1 text-xs font-medium text-slate-500 transition hover:text-[#1769aa]"
                        >
                          查看資料來源
                          <ChevronDown
                            size={14}
                            className={`transition-transform duration-200 ${showSource ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {showSource && (
                          <p className="mt-2 text-[11px] leading-5 break-words text-slate-500">
                            {answerSource}
                          </p>
                        )}
                      </div>
                    )}

                    <div ref={answerEndRef} />
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-3 sm:p-4">
                <div className="mb-1 flex items-end gap-2">
                  <textarea
                    ref={textareaRef}
                    value={question}
                    onChange={(e) => setQuestion(e.target.value.slice(0, 80))}
                    onKeyDown={handleKeyDown}
                    placeholder="問我今天天氣相關問題…"
                    disabled={loading}
                    rows={1}
                    enterKeyHint="send"
                    className="min-w-0 flex-1 resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder-slate-400 transition outline-none focus:border-[#1769aa] focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
                    style={{ maxHeight: '88px', minHeight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleQuestion(question)}
                    disabled={loading || !question.trim()}
                    aria-label="送出提問"
                    className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-[#1769aa] text-white transition hover:bg-[#1560a0] disabled:bg-slate-300"
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
