import { Droplets } from 'lucide-react'

export function WeatherIcon({ kind, size = 34 }) {
  switch (kind) {
    case 'rain':
      return <Droplets size={size} strokeWidth={1.7} className="text-blue-500" />
    case 'cloud':
      return (
        <span className="weather-cloud" style={{ width: size, height: size * 0.72 }}>
          <span />
        </span>
      )
    case 'moon':
      return <span className="weather-moon" style={{ width: size, height: size }} />
    case 'partly':
      return (
        <span className="weather-partly" style={{ width: size, height: size }}>
          <span />
          <i />
        </span>
      )
    default:
      return (
        <span className="weather-sun" style={{ width: size, height: size }}>
          <span />
        </span>
      )
  }
}

export function HeroWeatherIcon() {
  return (
    <span className="weather-sun hero-sun size-[32px] sm:size-[72px]">
      <span />
    </span>
  )
}