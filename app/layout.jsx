import { Analytics } from '@vercel/analytics/next'
import './globals.css'

export const metadata = {
  title: 'Weather Board',
  description: 'Real-time weather information for your city',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/weather-board-avatar.svg', type: 'image/svg+xml' },
      { url: '/weather-board-avatar.png', type: 'image/png' },
    ],
    apple: '/weather-board-avatar.png',
  },
}

export const viewport = {
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
}

export default function RootLayout({ children }) {
  return (
    <html lang="zh-TW">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
