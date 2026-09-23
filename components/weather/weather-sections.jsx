'use client'

import {
  Activity,
  CalendarDays,
  Droplets,
  Gauge,
  Navigation,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react'

import { dailyForecast, hourlyForecast } from '@/lib/weather-data'
import { HeroWeatherIcon, WeatherIcon } from './weather-icons'

export function CurrentWeatherCard({ weather }) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1769aa] to-[#1c76ac] p-4 text-white shadow-lg shadow-blue-100 sm:p-8">
      <div className="absolute -top-20 -right-10 size-64 rounded-full bg-white/5" />
      <div className="absolute right-20 -bottom-28 size-72 rounded-full bg-white/[0.03]" />

      <div className="relative flex flex-col justify-between gap-2 sm:flex-row sm:items-start sm:gap-12">
        <div>
          <p className="text-sm font-medium text-blue-100">現在天氣 · 12:35 PM</p>
          <div className="mt-2 flex items-center gap-3 sm:mt-4 sm:gap-4">
            <HeroWeatherIcon />
            <div>
              <div className="flex items-start">
                <span className="text-2xl font-light tracking-tighter sm:text-7xl">
                  {weather.temperature}
                </span>
                <span className="text-lg font-light sm:mt-2 sm:text-3xl">°</span>
              </div>
              <p className="text-base font-medium sm:text-lg">晴時多雲</p>
            </div>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-blue-100">體感</p>
          <p className="mt-1 text-lg font-semibold sm:text-2xl">{weather.feelsLike}°</p>
          <p className="mt-2 text-sm text-blue-100 sm:mt-5">
            今日最高 <strong className="text-white">--°</strong> · 最低{' '}
            <strong className="text-white">--°</strong>
          </p>
        </div>
      </div>

      <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/20 border-t border-white/20 pt-3 sm:mt-10 sm:pt-5">
        <WeatherMetric icon={<Droplets />} label="濕度" value={`${weather.humidity}%`} />
        <WeatherMetric icon={<Wind />} label="風速" value={`${weather.windSpeed} km/h`} />
        <WeatherMetric
          icon={<Gauge />}
          label="氣壓"
          value={`${weather.pressure} hPa`}
          align="end"
        />
      </div>
    </article>
  )
}

function WeatherMetric({ icon, label, value, align = 'center' }) {
  return (
    <div
      className={`flex items-center gap-1.5 sm:gap-2 ${align === 'end' ? 'justify-end' : 'justify-center first:justify-start'}`}
    >
      <span className="text-blue-100 [&>svg]:size-[15px] sm:[&>svg]:size-[19px]">{icon}</span>
      <div>
        <p className="text-[10px] text-blue-100 sm:text-xs">{label}</p>
        <p className="text-xs font-semibold sm:text-base">{value}</p>
      </div>
    </div>
  )
}

export function SunCard() {
  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold">日出與日落</p>
          <p className="mt-1 text-xs text-slate-500">今日天文資訊</p>
        </div>
        <div className="rounded-lg bg-amber-50 p-2 text-amber-500">
          <Sunrise size={20} />
        </div>
      </div>

      <div className="mt-7 flex items-end justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs text-slate-500">
            <Sunrise size={15} className="text-amber-500" />
            日出
          </p>
          <p className="mt-1 text-2xl font-semibold">05:43</p>
        </div>
        <div className="mx-5 mb-3 h-px flex-1 border-t border-dashed border-slate-200" />
        <div className="text-right">
          <p className="flex items-center justify-end gap-2 text-xs text-slate-500">
            日落 <Sunset size={15} className="text-orange-400" />
          </p>
          <p className="mt-1 text-2xl font-semibold">17:55</p>
        </div>
      </div>

      <div className="mt-7 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
        <Activity size={15} className="text-[#1769aa]" />
        紫外線指數 <strong className="ml-auto text-slate-900">中等 (5)</strong>
      </div>
    </aside>
  )
}

export function HourlyForecast() {
  return (
    <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <ForecastHeading
        title="24 小時預報"
        subtitle="接下來幾小時的天氣變化"
        action="查看詳細預報 →"
      />
      <div className="flex overflow-x-auto pb-1">
        {hourlyForecast.map((entry, index) => (
          <div
            key={entry.time}
            className={`flex min-w-[82px] flex-1 flex-col items-center gap-3 border-r border-slate-100 px-2 last:border-0 ${
              index === 0 ? 'text-[#1769aa]' : ''
            }`}
          >
            <span className="text-xs font-medium">{entry.time}</span>
            <WeatherIcon kind={entry.kind} size={30} />
            <span className="text-lg font-semibold">{entry.temperature}°</span>
            {index === 0 && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium">
                現在
              </span>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export function DailyForecast() {
  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-semibold">未來 5 天</h2>
          <p className="mt-1 text-xs text-slate-500">每日天氣預測</p>
        </div>
        <CalendarDays size={20} className="text-slate-400" />
      </div>
      <div className="flex flex-col">
        {dailyForecast.map((entry) => (
          <div
            key={entry.day}
            className="flex items-center border-t border-slate-100 py-3 first:border-0"
          >
            <div className="w-24">
              <p className="text-sm font-semibold">{entry.day}</p>
              <p className="text-xs text-slate-500">{entry.date}</p>
            </div>
            <div className="flex w-16 justify-center">
              <WeatherIcon kind={entry.kind} size={28} />
            </div>
            <div className="flex flex-1 items-center justify-end gap-4 text-sm">
              <RainChance chance={entry.rainChance} />
              <span className="w-10 text-right font-semibold">{entry.high}°</span>
              <span className="w-10 text-right text-slate-500">{entry.low}°</span>
            </div>
          </div>
        ))}
      </div>
    </article>
  )
}

function RainChance({ chance }) {
  return <span className="text-slate-600">降雨 {chance}%</span>
}

export function WeatherTip() {
  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center gap-2">
        <div className="rounded-lg bg-blue-50 p-2 text-[#1769aa]">
          <Navigation size={18} />
        </div>
        <div>
          <h2 className="font-semibold">今日小提醒</h2>
          <p className="text-xs text-slate-500">出門前看一下</p>
        </div>
      </div>
      <p className="text-sm leading-6 text-slate-600">
        午後體感溫度較高，建議穿著輕便透氣的衣物。紫外線指數中等，外出時記得做好防曬。
      </p>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500">
        <span>風向</span>
        <span className="font-medium text-slate-800">東南風 · 3 級</span>
      </div>
    </aside>
  )
}

function ForecastHeading({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex items-center justify-between">
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      </div>
      {action && (
        <button className="text-sm font-medium text-[#1769aa] hover:underline">{action}</button>
      )}
    </div>
  )
}
