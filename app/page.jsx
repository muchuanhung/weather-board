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

export default function Home() {
  const [city, setCity] = useState('Taipei')
  const [query, setQuery] = useState('')
  const [searched, setSearched] = useState(false)

  const [currentWeather, setCurrentWeather] = useState({
    temperature: 28,
    feelsLike: 30,
    tempHigh: 30,
    tempLow: 25,
    humidity: '72%',
    wind: '12 km/h',
    pressure: '1013 hPa',
  })

  const today = new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  const [now, setNow] = useState(
    new Date().toLocaleTimeString('zh-TW', {
      hour: 'numeric',
      minute: '2-digit',
    })
  )

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(
        new Date().toLocaleTimeString('zh-TW', {
          hour: 'numeric',
          minute: '2-digit',
        })
      )
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  function submitSearch(event) {
    event.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    setCity(trimmed)
    setCurrentWeather({
      temperature: 18,
      feelsLike: 16,
      tempHigh: 20,
      tempLow: 14,
      humidity: '90%',
      wind: '25 km/h',
      pressure: '1005 hPa',
    })
    setSearched(true)
    setQuery('')
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={17} />
            <input
              aria-label="搜尋城市"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜尋城市..."
              className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-10 pr-3 text-sm outline-none transition focus:border-[#1769aa] focus:ring-2 focus:ring-blue-100"
            />
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-7 lg:px-8 lg:py-10">
        {searched && (
          <div className="mb-5 flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <span>
              目前顯示 <strong>{city}</strong> 的天氣。目前為展示資料，實際天氣待串接後端。
            </span>
            <button onClick={() => setSearched(false)} className="font-semibold underline">
              關閉
            </button>
          </div>
        )}

        <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-slate-500">
              <MapPin size={15} className="text-[#1769aa]" />
              目前位置
            </p>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{city}</h1>
              <button
                aria-label="切換城市"
                className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
              >
                <ChevronDown size={16} />
              </button>
            </div>
            <p className="mt-1 text-sm text-slate-500">{today} · {now}</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="size-2 rounded-full bg-emerald-500" />
            資料更新於 5 分鐘前
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <CurrentWeatherCard weather={currentWeather} />
          <SunCard />
        </section>

        <HourlyForecast />

        <section className="mt-5 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
          <DailyForecast />
          <WeatherTip />
        </section>

        <footer className="mt-10 pb-2 text-center text-xs text-slate-400">
          weather-board · 為Wehelp團隊打造的天氣資訊工具
        </footer>
      </div>
    </main>
  )
}
