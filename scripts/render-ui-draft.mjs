/**
 * Renders a plan-issue UI draft (HTML + Tailwind) to PNG(s) for the gate.
 *
 * Usage: pnpm ui-draft:render <docs/plans/<slug>-ui-draft.html>
 *
 * - Screenshots each `[data-shot]` scene as `<slug>-ui-draft-<label>.png`
 *   (label = the data-shot value, e.g. `mobile`, `desktop-vazio`).
 * - With no `data-shot` scenes, captures the full page as `<slug>-ui-draft.png`.
 * - Uses the Chromium already installed for Playwright tests. The draft's
 *   Tailwind build comes from a CDN (jsdelivr), so rendering needs network
 *   access. Never touches the database or the app code.
 */

import { chromium } from '@playwright/test'
import { existsSync } from 'node:fs'
import path from 'node:path'

const htmlPath = path.resolve(process.argv[2] ?? '')

if (!htmlPath.endsWith('.html') || !existsSync(htmlPath)) {
  console.error('Usage: pnpm ui-draft:render <docs/plans/<slug>-ui-draft.html>')
  process.exit(1)
}

const base = htmlPath.replace(/\.html$/, '')
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } })
  await page
    .goto(`file://${htmlPath}`, { waitUntil: 'networkidle', timeout: 30000 })
    .catch(() => page.goto(`file://${htmlPath}`, { waitUntil: 'load' }))
  await page.waitForTimeout(250)

  const scenes = await page.locator('[data-shot]').all()
  const files = []
  if (scenes.length > 0) {
    for (let i = 0; i < scenes.length; i += 1) {
      const label = (await scenes[i].getAttribute('data-shot'))?.trim() || String(i + 1)
      const safeLabel = label.replace(/[^a-z0-9-]+/gi, '-').replace(/^-+|-+$/g, '') || String(i + 1)
      const out = `${base}-${safeLabel}.png`
      await scenes[i].screenshot({ path: out })
      files.push(out)
    }
  } else {
    const out = `${base}.png`
    await page.screenshot({ path: out, fullPage: true })
    files.push(out)
  }
  for (const file of files) console.log(file)
} finally {
  await browser.close()
}
