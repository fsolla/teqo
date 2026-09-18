import { execFile } from 'node:child_process'
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

import { chromium, expect, test } from '@playwright/test'
import sharp from 'sharp'

import { screenshotHtmlPng } from '../../scripts/lib/buildPdf.mjs'

// C191-runtime — real-Chromium smoke of the Instagram PNG path. The unit suite
// covers the entry with fakes and never launches a browser (CI runs unit/int
// BEFORE `playwright install`), so the exact dimensions and the 8 MB guard need
// this e2e run: the entry is spawned for each canvas and the PNG is measured
// with sharp. The spec is browserless (no app `page`), but the file name MUST
// stay `campaign*` to match the `campaign` project (playwright.config.ts) — an
// unmatched spec fails the curated selection with "No tests found" (OPS39).
// The spawn runs with `cwd` = temp dir, so the intermediate chart-spec.json
// lands there instead of the repo tree.

const execFileAsync = promisify(execFile)

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const ENTRY = join(REPO_ROOT, 'scripts/build-chart-from-data.mjs')

const SIZES = [
  { size: 'feed', width: 1080, height: 1350, cap: 7 },
  { size: 'square', width: 1080, height: 1080, cap: 7 },
  { size: 'story', width: 1080, height: 1920, cap: 5 },
] as const

test.describe('C191-runtime — real Chromium PNG export', () => {
  test.describe.configure({ timeout: 90_000 })

  let workDir: string
  let inputPath: string

  test.beforeAll(async () => {
    workDir = await mkdtemp(join(tmpdir(), 'c191-png-'))
    inputPath = join(workDir, 'dados.txt')
    await writeFile(inputPath, 'Ilhéus 84\nItabuna 68\nSalvador 42\n')
  })

  test.afterAll(async () => {
    await rm(workDir, { recursive: true, force: true })
  })

  const buildChart = (size: (typeof SIZES)[number]['size'], outPath: string) =>
    execFileAsync(
      process.execPath,
      [
        ENTRY,
        `--in=${inputPath}`,
        '--headline=Teste de dimensão',
        '--source=TSE 2022',
        '--type=bar',
        `--size=${size}`,
        `--out=${outPath}`,
      ],
      {
        cwd: workDir,
        encoding: 'utf8',
        timeout: 45_000,
        // The Playwright runner carries `--import=tsx/esm`; the child runs from
        // the temp dir (no node_modules), where that loader cannot resolve.
        // The entry is plain .mjs, so it needs no loader at all.
        env: { ...process.env, NODE_OPTIONS: '' },
      },
    )

  for (const { size, width, height, cap } of SIZES) {
    test(`exports ${size} at ${width}×${height} with the real browser`, async () => {
      const outPath = join(workDir, `${size}.png`)
      const { stdout } = await buildChart(size, outPath)

      expect(stdout).toContain(`(${width}×${height}`)
      expect(stdout).toContain(`· 3 ponto(s) ≤ ${cap}`)

      const metadata = await sharp(outPath).metadata()
      expect({ format: metadata.format, width: metadata.width, height: metadata.height }).toEqual({
        format: 'png',
        width,
        height,
      })
      expect((await stat(outPath)).size).toBeLessThan(8 * 1024 * 1024)
    })
  }

  test('fails closed on the size guard with the real browser', async () => {
    const browser = await chromium.launch()
    try {
      const outPath = join(workDir, 'guard.png')
      const html =
        '<!doctype html><body style="margin:0"><div style="width:1080px;height:1350px;background:#c51414"></div></body>'

      await expect(
        screenshotHtmlPng(browser, { html, width: 1080, height: 1350, outPath, maxBytes: 1024 }),
      ).rejects.toThrow(/1024/)
    } finally {
      await browser.close()
    }
  })
})
