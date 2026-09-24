'use client'

import {
  Activity,
  CloudRain,
  Droplets,
  Gauge,
  Navigation,
  Shirt,
  Sunrise,
  Sunset,
  Wind,
} from 'lucide-react'

import { WeatherIcon } from './weather-icons'

function uvLevelText(uv) {
  if (uv >= 11) return '極高'
  if (uv >= 8) return '很高'
  if (uv >= 6) return '高'
  if (uv >= 3) return '中等'
  return '低'
}

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

function getSunProgress(sunrise, sunset) {
  if (!sunrise || !sunset || sunrise.includes('-') || sunset.includes('-')) {
    return null
  }
  const start = toMinutes(sunrise)
  const end = toMinutes(sunset)
  const nowDate = new Date()
  const nowMin = nowDate.getHours() * 60 + nowDate.getMinutes()

  if (nowMin <= start) return 0
  if (nowMin >= end) return 100
  return ((nowMin - start) / (end - start)) * 100
}

function buildOutfit({ feelsLike, todayForecast }) {
  if (feelsLike == null || Number.isNaN(Number(feelsLike))) return null

  const temp = Number(feelsLike)
  let text = ''

  if (temp >= 30) {
    text = '短袖搭透氣衣物，記得防曬、多補充水分。'
  } else if (temp >= 26) {
    text = '短袖就夠了，進冷氣房可以帶件薄外套。'
  } else if (temp >= 22) {
    text = '短袖或薄長袖都適合，早晚有點涼。'
  } else if (temp >= 18) {
    text = '長袖為主，外出建議加件薄外套。'
  } else if (temp >= 14) {
    text = '長袖加外套，注意保暖。'
  } else if (temp >= 10) {
    text = '厚外套或毛衣，早晚更冷要多穿。'
  } else {
    text = '厚外套、圍巾一起上，做好保暖。'
  }

  if (todayForecast && todayForecast.high != null && todayForecast.low != null) {
    const gap = Number(todayForecast.high) - Number(todayForecast.low)
    if (gap >= 8) {
      text += ' 今天溫差大，建議洋蔥式穿搭。'
    }
  }

  return text
}

function buildTip({ weather, todayForecast }) {
  const rain = todayForecast ? todayForecast.rainChance : null
  const uv = weather.uvIndex
  const temp = weather.temperature

  if (rain != null && rain >= 60) {
    return '今天很可能下雨，出門記得帶把傘。'
  }
  if (rain != null && rain >= 30) {
    return '天氣不太穩定，建議帶把傘備用。'
  }
  if (uv != null && uv >= 8) {
    return '紫外線非常強，務必做好防曬、戴帽子或撐傘，避免長時間曝曬。'
  }
  if (uv != null && uv >= 6) {
    return '紫外線偏強，外出請記得防曬。'
  }
  if (uv != null && uv >= 3) {
    return '紫外線中等，建議還是擦個防曬再出門。'
  }
  if (temp != null && temp >= 32) {
    return '天氣炎熱，注意防曬並多補充水分。'
  }
  if (temp != null && temp <= 16) {
    return '天氣偏涼，出門記得添件外套。'
  }
  return '天氣還算舒適，適合外出走走。'
}

export function CurrentWeatherCard({ weather, todayForecast }) {
  const rainValue =
    todayForecast && todayForecast.rainChance != null ? `${todayForecast.rainChance}%` : '--'

  return (
    <article className="animate-fade-in-up relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#1769aa] to-[#1c76ac] p-4 text-white shadow-lg shadow-blue-100 sm:p-8">
      <div className="absolute -top-20 -right-10 size-64 rounded-full bg-white/5" />
      <div className="absolute right-20 -bottom-28 size-72 rounded-full bg-white/[0.03]" />

      <div className="animate-card-content">
        <div className="relative flex flex-col justify-between gap-2 sm:flex-row sm:items-start sm:gap-12">
          <div>
            <p className="text-sm font-medium text-blue-100">現在天氣</p>
            <div className="mt-2 flex items-center gap-3 sm:mt-4 sm:gap-4">
              <div>
                <span className="sm:hidden">
                  <WeatherIcon kind={weather.kind} size={48} />
                </span>
                <span className="hidden sm:block">
                  <WeatherIcon kind={weather.kind} size={80} />
                </span>
              </div>
              <div>
                <div className="flex items-start">
                  <span className="text-2xl font-light tracking-tighter sm:text-7xl">
                    {weather.temperature}
                  </span>
                  <span className="text-lg font-light sm:mt-2 sm:text-3xl">°</span>
                </div>
                <p className="text-base font-medium sm:text-lg">{weather.description}</p>
              </div>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-sm text-blue-100">體感</p>
            <p className="mt-1 text-lg font-semibold sm:text-2xl">{weather.feelsLike}°</p>
            <p className="mt-2 text-sm text-blue-100 sm:mt-5">
              今日最高{' '}
              <strong className="text-white">{todayForecast ? todayForecast.high : '--'}°</strong> ·
              最低{' '}
              <strong className="text-white">{todayForecast ? todayForecast.low : '--'}°</strong>
            </p>
          </div>
        </div>

        <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/20 border-t border-white/20 pt-3 sm:mt-10 sm:pt-5">
          <WeatherMetric icon={<CloudRain />} label="降雨機率" value={rainValue} />
          <WeatherMetric icon={<Wind />} label="風速" value={`${weather.windSpeed} km/h`} />
          <WeatherMetric
            icon={<Droplets />}
            label="濕度"
            value={`${weather.humidity}%`}
            align="end"
          />
        </div>
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

export function SunCard({ weather }) {
  const nowProgress = getSunProgress(weather.sunrise, weather.sunset)

  return (
    <aside className="animate-fade-in-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
      <div className="animate-card-content">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold">日出與日落</p>
            <p className="mt-0.5 text-xs text-slate-500 sm:mt-1">今日天文資訊</p>
          </div>
          <div className="rounded-lg bg-amber-50 p-1.5 text-amber-500 sm:p-2">
            <Sunrise size={16} className="sm:hidden" />
            <Sunrise size={20} className="hidden sm:block" />
          </div>
        </div>

        <div className="mt-4 flex items-end justify-between sm:mt-7">
          <div>
            <p className="flex items-center gap-1.5 text-xs text-slate-500 sm:gap-2">
              <Sunrise size={12} className="text-amber-500 sm:size-[15px]" />
              日出
            </p>
            <p className="mt-1 text-lg font-semibold sm:text-2xl">{weather.sunrise}</p>
          </div>
          <div className="relative mx-5 mb-3 h-px flex-1 border-t border-dashed border-slate-200">
            {nowProgress != null && (
              <div
                className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${nowProgress}%` }}
              >
                <div className="size-2.5 rounded-full border-2 border-white bg-amber-400 shadow" />
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1.5 text-xs text-slate-500 sm:gap-2">
              日落 <Sunset size={12} className="text-orange-400 sm:size-[15px]" />
            </p>
            <p className="mt-1 text-lg font-semibold sm:text-2xl">{weather.sunset}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-1.5 text-[11px] text-slate-600 sm:mt-7 sm:py-2.5 sm:text-xs">
          <Activity size={13} className="text-[#1769aa] sm:size-[15px]" />
          紫外線指數{' '}
          <strong className="ml-auto text-slate-900">
            {uvLevelText(weather.uvIndex)} ({weather.uvIndex})
          </strong>
        </div>
      </div>
    </aside>
  )
}

export function HourlyForecast({ hourly }) {
  return (
    <section className="animate-fade-in-up mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="animate-card-content">
        <ForecastHeading title="24 小時預報" subtitle="接下來幾小時的天氣變化" />
        <div className="flex overflow-x-auto pb-1">
          {hourly.map((entry, index) => (
            <div
              key={entry.time}
              className={`flex min-w-[56px] flex-1 flex-col items-center gap-1.5 border-r border-slate-100 px-2 last:border-0 sm:min-w-[82px] sm:gap-3 ${
                index === 0 ? 'text-[#1769aa]' : ''
              }`}
            >
              <span className="text-[10px] font-medium sm:text-xs">{entry.time}</span>
              <span className="sm:hidden">
                <WeatherIcon kind={entry.kind} size={15} />
              </span>
              <span className="hidden sm:block">
                <WeatherIcon kind={entry.kind} size={30} />
              </span>
              <span className="text-[11px] font-semibold sm:text-lg">{entry.temperature}°</span>
              {index === 0 && <span className="size-1.5 rounded-full bg-[#8fb8d4]" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function DailyForecast({ daily }) {
  return (
    <article className="animate-fade-in-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="animate-card-content">
        <div className="mb-4 sm:mb-5">
          <h2 className="font-semibold">未來 5 天</h2>
          <p className="mt-1 text-xs text-slate-500">每日天氣預測</p>
        </div>
        <div className="flex items-center gap-2 pb-2 text-[10px] text-slate-600 sm:gap-3 sm:text-xs">
          <div className="w-11 sm:w-24" />
          <div className="w-7 sm:w-16" />
          <div className="flex flex-1 items-center gap-2 sm:gap-4">
            <span className="flex-1" />
            <span className="w-8 text-right sm:w-10">最高</span>
            <span className="w-8 text-right sm:w-10">最低</span>
          </div>
        </div>
        <div className="flex flex-col">
          {daily.slice(0, 5).map((entry) => (
            <div
              key={entry.day}
              className="flex items-center gap-2 border-t border-slate-100 py-2.5 first:border-0 sm:gap-3 sm:py-3"
            >
              <div className="w-11 sm:w-24">
                <p className="text-xs font-semibold sm:text-sm">{entry.day}</p>
                <p className="text-[10px] text-slate-500 sm:text-xs">{entry.date}</p>
              </div>
              <div className="flex w-7 justify-center sm:w-16">
                <span className="sm:hidden">
                  <WeatherIcon kind={entry.kind} size={20} />
                </span>
                <span className="hidden sm:block">
                  <WeatherIcon kind={entry.kind} size={28} />
                </span>
              </div>
              <div className="flex flex-1 items-center gap-2 text-xs sm:gap-4 sm:text-sm">
                <span className="flex-1 text-left">
                  <RainChance chance={entry.rainChance} />
                </span>
                <span className="w-8 text-right font-semibold sm:w-10">{entry.high}°</span>
                <span className="w-8 text-right text-slate-500 sm:w-10">{entry.low}°</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}

function RainChance({ chance }) {
  if (chance == null) return <span className="text-slate-300">—</span>
  return <span className="text-slate-600">降雨機率 {chance}%</span>
}

export function WeatherTip({ weather, todayForecast }) {
  const tip = buildTip({ weather, todayForecast })
  const outfit = buildOutfit({ feelsLike: weather.feelsLike, todayForecast })

  return (
    <aside className="animate-fade-in-up rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="animate-card-content">
        <div className="mb-4 flex items-center gap-2 sm:mb-5">
          <div className="rounded-lg bg-blue-50 p-1.5 text-[#1769aa] sm:p-2">
            <Navigation size={16} className="sm:size-[18px]" />
          </div>
          <div>
            <h2 className="font-semibold">今日小提醒</h2>
            <p className="text-xs text-slate-500">出門前看一下</p>
          </div>
        </div>

        <p className="text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">{tip}</p>

        {outfit && (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 sm:mt-5 sm:p-4">
            <div className="flex items-center gap-2">
              <Shirt size={15} className="text-[#1769aa] sm:size-[17px]" />
              <p className="text-xs font-semibold text-slate-800 sm:text-sm">今日穿搭建議</p>
            </div>
            <p className="mt-2 text-sm leading-7 text-slate-700 sm:text-base sm:leading-8">
              {outfit}
            </p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500 sm:mt-5 sm:pt-4">
          <span>氣壓</span>
          <span className="font-medium text-slate-800">{weather.pressure} hPa</span>
        </div>
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
