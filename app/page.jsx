'use client'

import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Search, Sunrise } from 'lucide-react'

import { resolveCity } from '@/lib/city-map'
import {
  CurrentWeatherCard,
  DailyForecast,
  HourlyForecast,
  SunCard,
  WeatherTip,
} from '@/components/weather/weather-sections'
import { WeatherAgentPanel } from '@/components/weather/weather-agent-panel'

const CITY_OPTIONS = [
  '臺北市',
  '新北市',
  '基隆市',
  '桃園市',
  '新竹市',
  '新竹縣',
  '苗栗縣',
  '臺中市',
  '彰化縣',
  '南投縣',
  '雲林縣',
  '嘉義市',
  '嘉義縣',
  '臺南市',
  '高雄市',
  '屏東縣',
  '宜蘭縣',
  '花蓮縣',
  '臺東縣',
  '澎湖縣',
  '金門縣',
  '連江縣',
]

const DEFAULT_CITY = '臺北市'
const FETCH_ERROR = '氣象資料取得失敗，請稍後再試'

export default function Home() {
  const [city, setCity] = useState(DEFAULT_CITY)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [ready, setReady] = useState(false)
  const [cityMenuOpen, setCityMenuOpen] = useState(false)
  const cityMenuRef = useRef(null)
  // 以 CWA 縣市全名為 key 快取回應：taipei／台北／臺北 都會落在「臺北市」同一格，只打一次 API
  const weatherCacheRef = useRef(new Map())
  // 最後一次要求的縣市；較早送出的請求晚回來時直接丟掉，避免蓋掉新結果
  const latestCityRef = useRef(DEFAULT_CITY)

  const [currentWeather, setCurrentWeather] = useState({
    temperature: '--',
    feelsLike: '--',
    description: '',
    kind: 'sun',
    humidity: '--',
    windSpeed: '--',
    pressure: '--',
    uvIndex: 0,
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

  // 先載入預設城市，同時請求定位授權；授權後用 Nominatim 反查縣市再切換
  useEffect(() => {
    loadCity(DEFAULT_CITY)
    if (!('geolocation' in navigator)) return
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=10&accept-language=zh-TW&lat=${coords.latitude}&lon=${coords.longitude}`
        fetch(url)
          .then((res) => res.json())
          .then((data) => {
            // 使用者已經自己換過城市就不覆蓋
            if (latestCityRef.current !== DEFAULT_CITY) return
            const { county, city: cityName, state } = data.address ?? {}
            const resolved = [county, cityName, state].map(resolveCity).find(Boolean)
            if (resolved) loadCity(resolved.countyName)
          })
          .catch(() => {})
      },
      () => {}, // 拒絕授權或逾時：維持預設城市
      { timeout: 10_000, maximumAge: 10 * 60 * 1000 }
    )
  }, [])

  // 點選單外面就收起來
  useEffect(() => {
    if (!cityMenuOpen) return
    function handleClickOutside(event) {
      if (cityMenuRef.current && !cityMenuRef.current.contains(event.target)) {
        setCityMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [cityMenuOpen])

  function applyWeather(countyName, data) {
    // 成功才換標題：失敗時維持原城市名稱（見 3a3c881）
    setCity(countyName)
    setCurrentWeather(data.current)
    setDaily(data.dailyForecast ?? [])
    setHourly(data.hourlyForecast ?? [])
  }

  // countyName 必須是 resolveCity 正規化後的 CWA 縣市全名
  function loadCity(countyName) {
    latestCityRef.current = countyName
    setErrorMsg('')

    const cached = weatherCacheRef.current.get(countyName)
    if (cached) {
      applyWeather(countyName, cached)
      setLoading(false)
      setReady(true)
      return
    }

    setLoading(true)
    fetch(`/api/weather?city=${encodeURIComponent(countyName)}`)
      .then((res) => res.json())
      .then((data) => {
        if (latestCityRef.current !== countyName) return
        // 502／缺 key 時保留原本 state，避免 current 變 undefined 把畫面炸掉
        if (data.error || !data.current) {
          setErrorMsg(data.message || FETCH_ERROR)
          return
        }
        weatherCacheRef.current.set(countyName, data)
        applyWeather(countyName, data)
      })
      .catch(() => {
        if (latestCityRef.current === countyName) setErrorMsg(FETCH_ERROR)
      })
      .finally(() => {
        if (latestCityRef.current !== countyName) return
        setLoading(false)
        setReady(true)
      })
  }

  function submitSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setQuery('')
    const resolved = resolveCity(trimmed)
    if (!resolved) {
      setErrorMsg(
        `找不到城市「${trimmed}」，請用臺灣縣市名稱或常見英文拼音，例如 Taipei、Kaohsiung、台中。`
      )
      return
    }
    // 跟目前顯示的是同一個縣市就不重打
    if (resolved.countyName === city) return
    loadCity(resolved.countyName)
  }

  function selectCity(name) {
    setCityMenuOpen(false)
    if (name === city) return
    loadCity(name)
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
              <p className="text-xs text-slate-600">Taiwan weather, at a glance</p>
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
        {ready && loading && (
          <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            載入中，正在取得最新天氣資料...
          </div>
        )}
        {errorMsg && (
          <div className="mb-5 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMsg}
          </div>
        )}

        <section className="relative z-20 mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="animate-fade-in-left relative z-10">
            <div className="relative flex items-center gap-2" ref={cityMenuRef}>
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{city}</h1>
              <button
                type="button"
                onClick={() => setCityMenuOpen(!cityMenuOpen)}
                aria-label="切換城市"
                aria-expanded={cityMenuOpen}
                className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50"
              >
                <ChevronDown
                  size={16}
                  className={`transition-transform duration-200 ${cityMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {cityMenuOpen && (
                <div className="absolute top-full left-0 z-50 mt-2 max-h-64 w-40 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
                  {CITY_OPTIONS.map((name) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => selectCity(name)}
                      className={`block w-full px-4 py-2 text-left text-sm transition hover:bg-slate-50 ${
                        city === name ? 'font-semibold text-[#1769aa]' : 'text-slate-700'
                      }`}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-1 text-sm text-slate-700" suppressHydrationWarning>
              {today && now ? `${today} · ${now}` : '\u00A0'}
            </p>
          </div>
          <div className="animate-fade-in-right flex items-center gap-2 text-sm text-slate-700">
            <span className="size-2 rounded-full bg-emerald-500" />
            {updatedLabel}
          </div>
        </section>

        {!ready && (
          <div className="py-24 text-center text-sm text-slate-600">
            載入中，正在取得天氣資料...
          </div>
        )}

        {ready && (
          <div key={city}>
            <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr] [&>*]:min-w-0">
              <CurrentWeatherCard weather={currentWeather} todayForecast={todayForecast} />
              <SunCard weather={currentWeather} />
            </section>

            <HourlyForecast hourly={hourly} />

            <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr] [&>*]:min-w-0">
              <DailyForecast daily={daily} />
              <WeatherTip weather={currentWeather} todayForecast={todayForecast} />
            </section>
          </div>
        )}

        <footer className="mt-10 pb-2 text-center text-xs text-slate-600">
          weather-board · 為Wehelp團隊打造的天氣資訊工具
        </footer>
      </div>

      <WeatherAgentPanel city={city} />
    </main>
  )
}
