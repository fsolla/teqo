// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { main } from '../../scripts/build-chart-from-data.mjs'

// C191-runtime: the entry used to run `main()` at import and call
// `process.exit` on failure, so the unit suite could not touch it. The seam is
// injectable effects + an `isMain` guard: every path below runs without
// Chromium and without killing the worker.

const tempDir = () => mkdtemp(join(tmpdir(), 'c191-entry-'))

const throwingDie = (message: string): never => {
  throw new Error(message)
}

const launchTracker = () => {
  const close = vi.fn()
  const launchBrowser = vi.fn(async () => ({ close }))
  return { launchBrowser, close }
}

const screenshotStub = () =>
  vi.fn(async (_browser: unknown, _options: { width: number; height: number }) => ({ size: 2048 }))

const writeInput = async (dir: string, body: string) => {
  const path = join(dir, 'dados.txt')
  await writeFile(path, body)
  return path
}

let dir: string
let stdout: string[]

beforeEach(async () => {
  dir = await tempDir()
  stdout = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    stdout.push(String(chunk))
    return true
  })
  // Vitest owns the console, so the log line is captured here (not through the
  // stream spy above).
  vi.spyOn(console, 'log').mockImplementation((...args: unknown[]) => {
    stdout.push(args.map(String).join(' '))
  })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await rm(dir, { recursive: true, force: true })
})

describe('main — inspect and question paths', () => {
  it('prints the parsed dataset for --inspect without launching a browser', async () => {
    const input = await writeInput(dir, 'Ilhéus 84\nItabuna 68\n')
    const { launchBrowser } = launchTracker()

    await main({ argv: [`--in=${input}`, '--inspect'], repoRoot: dir, launchBrowser })

    expect(launchBrowser).not.toHaveBeenCalled()
    expect(JSON.parse(stdout.join(''))).toEqual({
      rows: [
        { label: 'Ilhéus', value: 84 },
        { label: 'Itabuna', value: 68 },
      ],
      format: 'txt',
      issues: [],
    })
  })

  it('emits needsQuestion and dies instead of drawing when a value is missing', async () => {
    const input = await writeInput(dir, 'Ilhéus 84\nItabuna ???\n')
    const { launchBrowser } = launchTracker()

    await expect(
      main({
        argv: [`--in=${input}`, '--headline=X', '--source=TSE'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/pergunte/)

    expect(launchBrowser).not.toHaveBeenCalled()
    const payload = JSON.parse(stdout.join(''))
    expect(payload.needsQuestion).toBe(true)
    expect(payload.issues.join(' ')).toContain('Itabuna')
  })

  it('requires --in when there is no --spec', async () => {
    await expect(main({ argv: ['--headline=X'], repoRoot: dir, die: throwingDie })).rejects.toThrow(
      /--in=/,
    )
  })

  it('fails closed when --in cannot be read', async () => {
    await expect(
      main({
        argv: [`--in=${join(dir, 'nao-existe.csv')}`],
        repoRoot: dir,
        die: throwingDie,
      }),
    ).rejects.toThrow(/falha ao ler/)
  })

  it('fails closed when --spec is invalid JSON', async () => {
    const specPath = join(dir, 'quebrado.json')
    await writeFile(specPath, '{')
    await expect(
      main({ argv: [`--spec=${specPath}`], repoRoot: dir, die: throwingDie }),
    ).rejects.toThrow(/falha ao ler --spec/)
  })

  it('refuses to render without --source', async () => {
    const input = await writeInput(dir, 'Ilhéus 84\nItabuna 68\n')
    const { launchBrowser } = launchTracker()

    await expect(
      main({
        argv: [`--in=${input}`, '--headline=X'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/source/)

    expect(launchBrowser).not.toHaveBeenCalled()
  })
})

describe('main — spec assembly, replay and the per-size log', () => {
  const fiveRows = 'A 5\nB 4\nC 3\nD 2\nE 1\n'

  it.each([
    ['feed', 1080, 1350, 7],
    ['square', 1080, 1080, 7],
    ['story', 1080, 1920, 5],
  ])('assembles the spec and logs the %s canvas (cap %i)', async (size, width, height, cap) => {
    const input = await writeInput(dir, fiveRows)
    const { launchBrowser, close } = launchTracker()
    const screenshot = screenshotStub()
    const outPath = join(dir, `${size}.png`)

    await main({
      argv: [
        `--in=${input}`,
        '--headline=Ranking de teste',
        '--source=TSE 2022',
        '--type=bar',
        `--size=${size}`,
        '--highlight=B',
        `--out=${outPath}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(screenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width, height, outPath }),
    )
    expect(close).toHaveBeenCalledOnce()

    const spec = JSON.parse(
      await readFile(join(dir, 'data/graficos-instagram/ranking-de-teste.chart-spec.json'), 'utf8'),
    )
    expect(spec).toMatchObject({
      chartType: 'bar',
      size,
      headline: 'Ranking de teste',
      source: 'TSE 2022',
      highlight: 'B',
    })
    expect(spec.rows).toHaveLength(5)

    const log = stdout.join('')
    expect(log).toContain(`(${width}×${height}`)
    expect(log).toContain(`≤ ${cap}`)
    expect(log).toContain('tipo=bar')
  })

  it('replays a --spec without reparsing the input and closes the browser', async () => {
    const specPath = join(dir, 'replay.chart-spec.json')
    await writeFile(
      specPath,
      JSON.stringify({
        chartType: 'anchor',
        size: 'square',
        headline: 'Um número',
        source: 'TSE 2022',
        rows: [{ label: 'Votos', value: 84 }],
      }),
    )
    const { launchBrowser, close } = launchTracker()
    const screenshot = screenshotStub()

    await main({
      argv: [`--spec=${specPath}`, `--out=${join(dir, 'replay.png')}`],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(screenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1080 }),
    )
    expect(close).toHaveBeenCalledOnce()
    expect(stdout.join('')).toContain('1080×1080')
  })
})
