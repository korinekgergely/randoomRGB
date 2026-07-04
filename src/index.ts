import {
  addLike,
  ensureDailyColor,
  fetchWall,
  normalizeClientKey,
  normalizeName,
} from './db'
import { buildRssFeed } from './rss'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function handleApi(request: Request, env: Env, pathname: string) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (pathname === '/api/wall' && request.method === 'GET') {
    const wall = await fetchWall(env.DB)
    return json({ colors: wall })
  }

  if (pathname === '/api/like' && request.method === 'POST') {
    let body: Record<string, unknown>
    try {
      body = await request.json()
    } catch {
      return json({ ok: false, error: 'invalid_json' }, 400)
    }

    const colorId = Number(body.colorId)
    const clientKey = normalizeClientKey(body.clientKey)
    const name = normalizeName(body.name)

    if (!Number.isInteger(colorId) || colorId < 1) {
      return json({ ok: false, error: 'invalid_color' }, 400)
    }
    if (!clientKey) {
      return json({ ok: false, error: 'invalid_client_key' }, 400)
    }

    const result = await addLike(env.DB, colorId, clientKey, name)
    if (!result.ok) {
      return json(result, 409)
    }
    return json({ ok: true })
  }

  return json({ error: 'not_found' }, 404)
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url)

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env, url.pathname)
    }

    if (
      request.method === 'GET' &&
      (url.pathname === '/feed.xml' || url.pathname === '/rss' || url.pathname === '/rss.xml')
    ) {
      const wall = await fetchWall(env.DB)
      const siteUrl = `${url.protocol}//${url.host}`
      const xml = buildRssFeed(siteUrl, wall)
      return new Response(xml, {
        headers: {
          'Content-Type': 'application/rss+xml; charset=utf-8',
          'Cache-Control': 'public, max-age=300',
        },
      })
    }

    return env.ASSETS.fetch(request)
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      ensureDailyColor(env.DB).catch((err) => {
        console.error('daily color cron failed', err)
      }),
    )
  },
}
