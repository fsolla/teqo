/**
 * Deterministic Instagram Graph API stub for e2e — the campaign home content
 * board (S3) fetches the feed server-side, so the Next dev/prod server points
 * `INSTAGRAM_API_BASE_URL` here (see playwright.config.ts) and this process
 * answers `/media`, `/user` and `/refresh_access_token` with a fixed fixture.
 * `POST /__stub/state` with `{ "state": "ok" | "fail" | "invalid-token" }`
 * switches the API: `fail` answers HTTP 500 (network/API-down paths), and
 * `invalid-token` answers 400 with an OAuthException body (the S11 admin
 * status panel's token-rejected copy) — so specs can exercise the
 * fail-closed/snapshot paths without any network. Thumbnails are served
 * locally from `/thumbs/<id>.jpg` — the sandbox never reaches
 * `scontent.cdninstagram.com`, and next/image would 404 (a console error the
 * e2e guard treats as a failure).
 */
import { createServer } from 'node:http'

const PORT = Number(process.env.INSTAGRAM_STUB_PORT ?? 5000)
const USER_ID = '17841400000000000'
const USERNAME = 'depjorgesolla'
const ORIGIN = `http://localhost:${PORT}`

// 1x1 transparent PNG — enough for the optimizer to proxy successfully.
const THUMBNAIL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const minutesAgo = (minutes) => new Date(Date.now() - minutes * 60_000).toISOString()

const POSTS = [
  {
    id: 'e2e-ig-muro-1',
    caption: 'E2e Post do muro',
    media_type: 'IMAGE',
    minutesAgo: 20,
  },
  {
    id: 'e2e-ig-reel-2',
    caption: 'E2e Reel da caravana',
    media_type: 'REEL',
    minutesAgo: 90,
  },
  {
    id: 'e2e-ig-sem-legenda-3',
    caption: null,
    media_type: 'IMAGE',
    minutesAgo: 26 * 60,
  },
  {
    id: 'e2e-ig-carrossel-4',
    caption: 'E2e Carrossel de fotos',
    media_type: 'CAROUSEL_ALBUM',
    minutesAgo: 30 * 60,
  },
  {
    id: 'e2e-ig-grade-excluido-5',
    caption: 'E2e Post de grade',
    media_type: 'IMAGE',
    minutesAgo: 5,
  },
]

const mediaItem = (post) => {
  const base = `${ORIGIN}/thumbs/${post.id}.jpg`
  const item = {
    id: post.id,
    caption: post.caption,
    media_type: post.media_type,
    permalink: `https://www.instagram.com/p/${post.id}/`,
    timestamp: minutesAgo(post.minutesAgo),
    media_url: base,
    thumbnail_url: base,
  }
  if (post.media_type === 'CAROUSEL_ALBUM') {
    item.children = { data: [{ media_url: base, thumbnail_url: base }] }
  }
  return item
}

const mediaResponse = () => ({ data: POSTS.map(mediaItem) })

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
        if (['ok', 'fail', 'invalid-token'].includes(parsed.state)) state = parsed.state
      } catch {
        // keep the current state
      }
      json(res, 200, { state })
    })
    return
  }

  if (state === 'invalid-token') {
    // The token-rejected shape the Graph API returns for an invalid/expired
    // token or one minted via Facebook Login (S11 status panel copy).
    json(res, 400, {
      error: {
        message: 'Error validating access token: Session has expired',
        type: 'OAuthException',
        code: 190,
      },
    })
    return
  }

  if (state === 'fail') {
    res.writeHead(500)
    res.end('stub fail')
    return
  }

  if (url.pathname.endsWith('/media')) {
    json(res, 200, mediaResponse())
    return
  }

  if (url.pathname === '/refresh_access_token') {
    json(res, 200, { access_token: 'e2e-refreshed-token' })
    return
  }

  if (url.pathname.endsWith(`/${USER_ID}`) || url.pathname === '/user') {
    json(res, 200, { id: USER_ID, username: USERNAME })
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
  console.log(`instagram e2e stub listening on :${PORT}`)
})
