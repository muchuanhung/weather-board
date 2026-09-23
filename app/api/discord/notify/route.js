import { timingSafeEqual } from 'node:crypto'

import { NextResponse } from 'next/server'

import { DEFAULT_SITE_URL, readThreshold } from '@/lib/discord-message'
import { notifyWeather } from '@/lib/discord-notify'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const DEFAULT_CITY = 'Taipei'

function safeEqual(a, b) {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

function readSecret(request) {
  const authorization = request.headers.get('authorization') ?? ''
  if (authorization.toLowerCase().startsWith('bearer ')) return authorization.slice(7).trim()
  return request.headers.get('x-cron-secret') ?? ''
}

function authorize(request) {
  const expected = process.env.CRON_SECRET

  if (!expected) {
    if (process.env.NODE_ENV === 'production') {
      return {
        ok: false,
        status: 503,
        body: {
          ok: false,
          error: 'cron_secret_not_configured',
          message: '伺服器尚未設定 CRON_SECRET，為避免被任意觸發，此端點暫停服務',
        },
      }
    }
    return { ok: true }
  }

  if (!safeEqual(readSecret(request), expected)) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: 'unauthorized', message: '缺少或錯誤的 CRON_SECRET' },
    }
  }

  return { ok: true }
}

function isTruthy(value) {
  return value === true || ['1', 'true', 'yes', 'on'].includes(String(value ?? '').toLowerCase())
}

async function readBody(request) {
  if (request.method !== 'POST') return {}
  try {
    const parsed = await request.json()
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function handle(request) {
  const auth = authorize(request)
  if (!auth.ok) return NextResponse.json(auth.body, { status: auth.status })

  try {
    const params = new URL(request.url).searchParams
    const body = await readBody(request)

    const city = body.city ?? params.get('city') ?? DEFAULT_CITY
    const force = isTruthy(body.force ?? params.get('force'))

    const { status, body: result } = await notifyWeather({
      city,
      force,
      webhookUrl: process.env.DISCORD_WEBHOOK_URL,
      threshold: readThreshold(process.env.RAIN_CHANCE_THRESHOLD),
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL,
    })

    return NextResponse.json(result, { status })
  } catch (error) {
    console.error('[api/discord/notify] 未預期錯誤', error)
    return NextResponse.json(
      { ok: false, error: 'internal_error', message: '推播處理失敗，請稍後再試' },
      { status: 500 }
    )
  }
}

export const GET = handle
export const POST = handle
