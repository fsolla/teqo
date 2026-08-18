/**
 * Deterministic YouTube Data API v3 stub for e2e — the campaign home content
 * board (S2) fetches the feed server-side, so the Next dev/prod server points
 * `YOUTUBE_API_BASE_URL` here (see playwright.config.ts) and this process
 * answers `search`/`videos` with a fixed fixture. `POST /__stub/state` with
 * `{ "state": "ok" | "fail" }` makes the API fail (HTTP 500) so specs can
 * exercise the fail-closed/snapshot paths without any network. Thumbnails are
 * served locally from `/thumbs/<id>.jpg` — the sandbox never reaches
 * `i.ytimg.com`, and next/image would 404 (a console error the e2e guard
 * treats as a failure).
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.YOUTUBE_STUB_PORT ?? 4000)
const CHANNEL_ID = 'UCe2eTestChannel'
const ORIGIN = `http://localhost:${PORT}`

// 1x1 transparent PNG — enough for the optimizer to proxy successfully.
const THUMBNAIL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

const VIDEOS = [
  {
    id: 'e2e-video-destaque-1',
    title: 'E2e Vídeo em destaque',
    minutesAgo: 30,
    views: 12400,
    maxres: true,
  },
  {
    id: 'e2e-video-caravana-2',
    title: 'E2e Vídeo de caravana',
    minutesAgo: 120,
    views: 8100,
    maxres: true,
  },
  {
    id: 'e2e-video-entrevista-3',
    title: 'E2e Vídeo de entrevista',
    minutesAgo: 26 * 60,
    views: 987,
    maxres: false,
  },
  {
    id: 'e2e-video-excluido-4',
    title: 'E2e Vídeo excluído',
    minutesAgo: 10,
    views: 5_000_000,
    maxres: true,
  },
]

const thumbnails = (video) => {
  const base = `${ORIGIN}/thumbs/${video.id}.jpg`
  const common = {
    default: { url: base },
    medium: { url: base },
    high: { url: base },
  }
  return video.maxres ? { ...common, maxres: { url: base } } : common
}

const searchResponse = () => ({
  items: VIDEOS.map((video) => ({
    id: { videoId: video.id },
    snippet: {
      publishedAt: minutesAgo(video.minutesAgo),
      channelId: CHANNEL_ID,
      title: video.title,
      thumbnails: thumbnails(video),
    },
  })),
})

const statisticsResponse = (ids) => ({
  items: ids
    .split(',')
    .filter(Boolean)
    .map((id) => {
      const video = VIDEOS.find((item) => item.id === id)
      return { id, statistics: { viewCount: video ? String(video.views) : '0' } }
    }),
})

let state = 'ok'

const json = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)

  if (url.pathname === '/__stub/health') {
    json(res, 200, { ok: true })
    return
  }

  if (url.pathname === '/__stub/state' && req.method === 'POST') {
    let body = ''
    req.on('data', (chunk) => {
      body += chunk
    })
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body)
        if (parsed.state === 'ok' || parsed.state === 'fail') state = parsed.state
      } catch {
        // keep the current state
      }
      json(res, 200, { state })
    })
    return
  }

  if (state === 'fail') {
    res.writeHead(500)
    res.end('stub fail')
    return
  }

  if (url.pathname === '/search') {
    json(res, 200, searchResponse())
    return
  }

  if (url.pathname === '/videos') {
    json(res, 200, statisticsResponse(url.searchParams.get('id') ?? ''))
    return
  }

  if (url.pathname.startsWith('/thumbs/')) {
    res.writeHead(200, { 'content-type': 'image/png' })
    res.end(THUMBNAIL_PNG)
    return
  }

  res.writeHead(404)
  res.end('not found')
})

server.listen(PORT, () => {
  console.log(`youtube e2e stub listening on :${PORT}`)
})
