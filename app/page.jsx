'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, MapPin, Search, Sunrise } from 'lucide-react'

import {
  CurrentWeatherCard,
  DailyForecast,
  HourlyForecast,
  SunCard,
  WeatherTip,
} from '@/components/weather/weather-sections'
import { WeatherAgentPanel } from '@/components/weather/weather-agent-panel'

export default function Home() {
  const [city, setCity] = useState('Taipei')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const [currentWeather, setCurrentWeather] = useState({
    temperature: 28,
    feelsLike: 30,
    description: '晴時多雲',
    kind: 'sun',
    humidity: '72',
    windSpeed: '12',
    pressure: '1013',
    uvIndex: 5,
    sunrise: '--:--',
    sunset: '--:--',
    updatedAt: '',
  })

  const [daily, setDaily] = useState([])
  const [hourly, setHourly] = useState([])
  const [today, setToday] = useState('')
  const [now, setNow] = useState('')

  useEffect(() => {
    function tick() {
      const d = new Date()
      setToday(
        d.toLocaleDateString('zh-TW', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
          timeZone: 'Asia/Taipei',
        })
      )
      setNow(
        d.toLocaleTimeString('zh-TW', {
          hour: 'numeric',
          minute: '2-digit',
          timeZone: 'Asia/Taipei',
        })
      )
    }
    tick()
    const timer = setInterval(tick, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    fetch('/api/weather?city=Taipei')
      .then((res) => res.json())
      .then((data) => {
        // 502／缺 key 時保留初始 state，避免 current 變 undefined 把畫面炸掉
        if (data.error || !data.current) return
        setCurrentWeather(data.current)
        setDaily(data.dailyForecast ?? [])
        setHourly(data.hourlyForecast ?? [])
      })
      .catch(() => {})
  }, [])

  function submitSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setCity(trimmed)
    setLoading(true)
    setErrorMsg('')
    fetch(`/api/weather?city=${encodeURIComponent(trimmed)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error || !data.current) {
          setErrorMsg(data.message || '氣象資料取得失敗，請稍後再試')
        } else {
          setCurrentWeather(data.current)
          setDaily(data.dailyForecast ?? [])
          setHourly(data.hourlyForecast ?? [])
        }
        setLoading(false)
      })
      .catch(() => {
        setErrorMsg('氣象資料取得失敗，請稍後再試')
        setLoading(false)
      })
    setQuery('')
  }

  const todayForecast = daily.find((entry) => entry.day === '今天')

  let updatedLabel = '資料更新中'
  if (currentWeather.updatedAt) {
    const updatedTime = new Date(currentWeather.updatedAt).toLocaleTimeString('zh-TW', {
      hour: 'numeric',
      minute: '2-digit',
    })
    updatedLabel = `資料更新於 ${updatedTime}`
  }

  return (
    <main className="min-h-screen bg-[#f3f7fb] text-slate-900">
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#1769aa] text-white shadow-sm">
              <Sunrise size={22} />
            </div>
            <div>
              <p className="text-lg font-bold tracking-tight">weather-board</p>
              <p className="text-xs text-slate-500">Taiwan weather, at a glance</p>
            </div>
          </div>
          <form onSubmit={submitSearch} className="relative w-full sm:w-72" role="search">
            <Search className="absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" size={17} />
            <input
              aria-label="搜尋城市"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋城市..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pr-3 pl-10 text-sm transition outline-none focus:border-[#1769aa] focus:ring-2 focus:ring-blue-100"
            />
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        {loading && (
          <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            載入中，正在取得最新天氣資料...
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-600">
              <MapPin size={15} className="text-[#1769aa]" />
              目前位置
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{city}</h1>
              <button
                aria-label="切換城市"
                className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-600" suppressHydrationWarning>
              {today && now ? `${today} · ${now}` : '\u00A0'}
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span className="size-2 rounded-full bg-emerald-500" />
            {updatedLabel}
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] [&>*]:min-w-0">
          <CurrentWeatherCard weather={currentWeather} todayForecast={todayForecast} />
          <SunCard weather={currentWeather} />
        </section>

        <HourlyForecast hourly={hourly} />

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] [&>*]:min-w-0">
          <DailyForecast daily={daily} />
          <WeatherTip weather={currentWeather} todayForecast={todayForecast} />
        </section>

        <footer className="mt-10 pb-2 text-center text-xs text-slate-600">
          weather-board · 為Wehelp團隊打造的天氣資訊工具
        </footer>
      </div>

      <WeatherAgentPanel city={city} />
    </main>
  )
}
