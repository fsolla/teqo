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
  vi.fn(async (_browser: unknown, _options: { html: string; width: number; height: number }) => ({
    size: 2048,
  }))

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

  it('embeds the official kit mark even with a temp repoRoot (C203)', async () => {
    const input = await writeInput(dir, fiveRows)
    const { launchBrowser } = launchTracker()
    const screenshot = screenshotStub()

    await main({
      argv: [
        `--in=${input}`,
        '--headline=Ranking de teste',
        '--source=TSE 2022',
        '--type=bar',
        `--out=${join(dir, 'brand.png')}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    // The asset resolves from the module, never from the cwd: `repoRoot` is a
    // temp dir here and the official mark still reaches the HTML.
    const html = screenshot.mock.calls[0][1].html
    expect(html).toContain('data:image/png;base64,')
    expect(html).not.toContain('MANDATO DEPUTADO FEDERAL')
  })

  it('assembles the delta spec from a table with the two periods', async () => {
    const input = await writeInput(
      dir,
      'Tipo\t2020\t2026\nESF · Saúde da Família\t58\t63\nENASF-AB · Ampliado\t5\t5\n',
    )
    const { launchBrowser, close } = launchTracker()
    const screenshot = screenshotStub()
    const outPath = join(dir, 'delta.png')

    await main({
      argv: [
        `--in=${input}`,
        '--type=delta',
        '--headline=Quatro dos sete seguem sem ampliação',
        '--source=Ministério da Saúde — CNES',
        `--out=${outPath}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(screenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1350, outPath }),
    )
    expect(close).toHaveBeenCalledOnce()

    const spec = JSON.parse(
      await readFile(
        join(dir, 'data/graficos-instagram/quatro-dos-sete-seguem-sem-ampliacao.chart-spec.json'),
        'utf8',
      ),
    )
    expect(spec).toMatchObject({ chartType: 'delta', startLabel: '2020', endLabel: '2026' })
    expect(spec.rows).toHaveLength(2)
    expect(stdout.join('')).toContain('tipo=delta')
  })

  it('assembles a vertical category comparison with the relation kicker and the unit', async () => {
    const input = await writeInput(
      dir,
      'Hospital;Moradores da cidade (%)\nMunicipal (Esaú Matos);60.57\nEstadual (CHVC);54.67\n',
    )
    const { launchBrowser, close } = launchTracker()
    const screenshot = screenshotStub()

    await main({
      argv: [
        `--in=${input}`,
        '--type=column',
        '--unit=%',
        '--headline=Maioria e da cidade',
        '--source=Ministério da Saúde — SIH/SUS',
        `--out=${join(dir, 'coluna.png')}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(close).toHaveBeenCalledOnce()
    const spec = JSON.parse(
      await readFile(
        join(dir, 'data/graficos-instagram/maioria-e-da-cidade.chart-spec.json'),
        'utf8',
      ),
    )
    expect(spec).toMatchObject({ chartType: 'column', kicker: 'Comparação', unit: '%' })
    expect(stdout.join('')).toContain('tipo=column')
  })

  it('assembles the neutral piece with --no-highlight and refuses mixing both flags', async () => {
    const input = await writeInput(
      dir,
      'Hospital;Moradores da cidade\nHospital municipal;60.57\nHospital estadual;54.67\n',
    )
    const { launchBrowser } = launchTracker()
    const screenshot = screenshotStub()

    await main({
      argv: [
        `--in=${input}`,
        '--type=column',
        '--unit=%',
        '--no-highlight',
        '--headline=Neutro',
        '--source=Ministério da Saúde — SIH/SUS',
        `--out=${join(dir, 'neutro.png')}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    const spec = JSON.parse(
      await readFile(join(dir, 'data/graficos-instagram/neutro.chart-spec.json'), 'utf8'),
    )
    expect(spec.noHighlight).toBe(true)
    expect(spec.highlight).toBeUndefined()

    await expect(
      main({
        argv: [
          `--in=${input}`,
          '--type=column',
          '--no-highlight',
          '--highlight=Hospital municipal',
          '--headline=Conflito',
          '--source=TSE',
        ],
        repoRoot: dir,
        launchBrowser,
        screenshot,
      }),
    ).rejects.toThrow(/exclusivos/)
  })

  it('assembles the two-positive pair with --dual-positive', async () => {
    const input = await writeInput(
      dir,
      'Hospital;Moradores da cidade\nMunicipal;60.57\nEstadual;54.67\n',
    )
    const { launchBrowser } = launchTracker()
    const screenshot = screenshotStub()

    await main({
      argv: [
        `--in=${input}`,
        '--type=column',
        '--unit=%',
        '--dual-positive',
        '--headline=Duas boas noticias',
        '--source=Ministério da Saúde — SIH/SUS',
        `--out=${join(dir, 'positivo.png')}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    const spec = JSON.parse(
      await readFile(
        join(dir, 'data/graficos-instagram/duas-boas-noticias.chart-spec.json'),
        'utf8',
      ),
    )
    expect(spec).toMatchObject({
      chartType: 'column',
      unit: '%',
      dualPositive: true,
      kicker: 'Comparação',
    })
  })

  it('assembles the three-series spec with the informed triad (C205)', async () => {
    const input = await writeInput(
      dir,
      'Ano,Estadual,Municipal,Privada\n2015,235,93,832\n2016,235,93,724\n2017,256,105,707\n',
    )
    const { launchBrowser, close } = launchTracker()
    const screenshot = screenshotStub()
    const outPath = join(dir, 'triple.png')

    await main({
      argv: [
        `--in=${input}`,
        '--type=line',
        '--headline=Redes públicas ampliam leitos; a privada recua',
        '--source=Ministério da Saúde — CNES',
        '--good=Estadual',
        '--neutral=Municipal',
        '--neutral-dark=Privada',
        `--out=${outPath}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(screenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1350, outPath }),
    )
    expect(close).toHaveBeenCalledOnce()

    const spec = JSON.parse(
      await readFile(
        join(
          dir,
          'data/graficos-instagram/redes-publicas-ampliam-leitos-a-privada-recua.chart-spec.json',
        ),
        'utf8',
      ),
    )
    expect(
      spec.series.map((serie: { name: string; tone: string }) => [serie.name, serie.tone]),
    ).toEqual([
      ['Estadual', 'good'],
      ['Municipal', 'neutral'],
      ['Privada', 'neutral-dark'],
    ])
    expect(stdout.join('')).toContain('tipo=line')
    expect(stdout.join('')).toContain('3 séries × 3')
  })

  it('assembles the projected three-series spec (C207)', async () => {
    const input = await writeInput(
      dir,
      'Ano,Estadual,Privada,Municipal\n2024,300,100,200\n2025,400,120,150\n2026,500,121,100\n',
    )
    const { launchBrowser } = launchTracker()
    const screenshot = screenshotStub()
    const outPath = join(dir, 'triple-projected.png')

    await main({
      argv: [
        `--in=${input}`,
        '--type=line',
        '--headline=Produção estadual cresce e municipal cai',
        '--source=Ministério da Saúde — SIA/SUS',
        '--good=Estadual',
        '--neutral=Privada',
        '--neutral-dark=Municipal',
        '--projected=2026',
        `--out=${outPath}`,
      ],
      repoRoot: dir,
      launchBrowser,
      screenshot,
    })

    expect(screenshot).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ width: 1080, height: 1350, outPath }),
    )
    const spec = JSON.parse(
      await readFile(
        join(
          dir,
          'data/graficos-instagram/producao-estadual-cresce-e-municipal-cai.chart-spec.json',
        ),
        'utf8',
      ),
    )
    expect(spec).toMatchObject({ chartType: 'line', size: 'feed', projectedLabel: '2026' })
    expect(stdout.join('')).toContain('3 séries × 3')
  })

  it('refuses an incomplete triad and a 2-series tone on the three-series line', async () => {
    const input = await writeInput(dir, 'Ano,Estadual,Municipal,Privada\n2015,1,2,3\n2016,2,2,2\n')
    const { launchBrowser } = launchTracker()

    await expect(
      main({
        argv: [`--in=${input}`, '--headline=X', '--source=Y', '--good=Estadual'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/juntos/)

    await expect(
      main({
        argv: [`--in=${input}`, '--headline=X', '--source=Y', '--good=Estadual', '--bad=Municipal'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/par de duas séries/)

    expect(launchBrowser).not.toHaveBeenCalled()
  })

  it('retires --medium and keeps the vocabularies apart', async () => {
    const tripleInput = await writeInput(
      dir,
      'Ano,Estadual,Municipal,Privada\n2015,1,2,3\n2016,2,2,2\n',
    )
    const pairInput = await writeInput(dir, 'Ano,Estadual,Municipal\n2017,1,2\n2018,2,1\n')
    const { launchBrowser } = launchTracker()

    await expect(
      main({
        argv: [`--in=${tripleInput}`, '--headline=X', '--source=Y', '--medium=Estadual'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/saiu na revisão C205/)

    await expect(
      main({
        argv: [`--in=${pairInput}`, '--headline=X', '--source=Y', '--neutral=Estadual'],
        repoRoot: dir,
        launchBrowser,
        die: throwingDie,
      }),
    ).rejects.toThrow(/trio de três séries/)
    expect(launchBrowser).not.toHaveBeenCalled()
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
