import { createServer } from 'node:http'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const port = Number(process.env.PORT) || 3000
const host = process.env.HOST || '127.0.0.1'

const app = next({
  dev,
  hostname: host,
  port,
})

const handle = app.getRequestHandler()

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, host, () => {
      console.log(`> Ready on http://${host}:${port}`)
    })
  })
  .catch((error) => {
    console.error('Failed to start Next.js server', error)
    process.exit(1)
  })
