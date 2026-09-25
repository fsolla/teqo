import http from 'node:http'
import net from 'node:net'

const HOST = process.env.PROXY_HOST ?? '100.94.122.26'
const PORT = Number(process.env.PROXY_PORT ?? 3128)
const ALLOWED_CLIENTS = new Set(
  (process.env.PROXY_ALLOWED_CLIENTS ?? '100.119.220.31,127.0.0.1,::1')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
)
const ALLOWED_PORTS = new Set(
  (process.env.PROXY_ALLOWED_PORTS ?? '443')
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0),
)

const log = (...args) => console.log(new Date().toISOString(), ...args)

const clientAllowed = (socket) => {
  const ip = (socket.remoteAddress ?? '').replace(/^::ffff:/, '')
  return ALLOWED_CLIENTS.has(ip)
}

const server = http.createServer((req, res) => {
  let target
  try {
    target = new URL(req.url ?? '')
  } catch {
    res.writeHead(400)
    res.end('bad request')
    return
  }
  const port = Number(target.port || 80)
  if (target.protocol !== 'http:' || !ALLOWED_PORTS.has(port)) {
    res.writeHead(403)
    res.end('forbidden')
    return
  }
  const upstream = http.request(
    {
      host: target.hostname,
      port,
      path: `${target.pathname}${target.search}`,
      method: req.method,
      headers: req.headers,
    },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers)
      upstreamRes.pipe(res)
    },
  )
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502)
    res.end('bad gateway')
  })
  req.pipe(upstream)
})

server.on('connect', (req, clientSocket, head) => {
  const [rawHost, rawPort] = (req.url ?? '').split(':')
  const host = rawHost?.trim()
  const port = Number(rawPort ?? 443)
  if (!host || !ALLOWED_PORTS.has(port)) {
    log('denied connect', req.url)
    clientSocket.end('HTTP/1.1 403 Forbidden\r\n\r\n')
    return
  }
  const upstream = net.connect(port, host, () => {
    clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n')
    if (head.length > 0) upstream.write(head)
    upstream.pipe(clientSocket)
    clientSocket.pipe(upstream)
  })
  upstream.setTimeout(30000, () => upstream.destroy())
  upstream.on('error', (error) => {
    log('upstream error', host, error.code)
    clientSocket.destroy()
  })
  clientSocket.on('error', () => upstream.destroy())
})

server.on('connection', (socket) => {
  if (!clientAllowed(socket)) {
    log('denied client', socket.remoteAddress)
    socket.destroy()
  }
})

server.listen(PORT, HOST, () => {
  log(
    `egress proxy on ${HOST}:${PORT} — clients: ${[...ALLOWED_CLIENTS].join(',')} — ports: ${[...ALLOWED_PORTS].join(',')}`,
  )
})
