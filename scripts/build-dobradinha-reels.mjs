/**
 * Lote de reels "reel-card" por dobradinha (C-reel): um reel de conversa por
 * dobradinha ativa da campanha, terminando na colinha EXATA do card
 * personalizado do site para aquele estadual.
 *
 * A lista vive em `scripts/reels/dobradinhas.json` (curada a partir da
 * plataforma: `state_deputy` cujo nome não contém "(apagar)" — ver o `source`
 * do arquivo). Cada reel roda o mesmo builder (`--finale=card`), trocando o
 * segundo candidato do ticket (nome, número e foto) e o estadual escolhido no
 * estúdio de cards em produção.
 *
 * Uso:
 *   node scripts/build-dobradinha-reels.mjs [--only=slug,slug] [--jobs=3]
 *     [--photos-dir=…] [--skip-existing] [--dry-run] [--audio-only]
 *
 * As fotos são as dos cards da Plenária da Vitória
 * (`DOBRADINHAS-ORGANIZADAS/<pasta>/foto.png`).
 */

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { dieWithLabel, parseEqualsFlags } from './lib/cli.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LABEL = 'build-dobradinha-reels'
const die = dieWithLabel(LABEL)
const CONFIG = join(ROOT, 'scripts/reels/dobradinhas.json')
const BUILDER = join(ROOT, 'scripts/build-colinha-reel.mjs')
const DEFAULT_JOBS = 3

const USAGE = `Uso: node scripts/build-dobradinha-reels.mjs [--only=slug,slug] [--jobs=3]
  [--photos-dir=…] [--skip-existing] [--dry-run] [--audio-only]`

const runBuilder = (args) =>
  new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [BUILDER, ...args], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let output = ''
    const forward = (chunk) => {
      output += chunk.toString()
    }
    child.stdout.on('data', forward)
    child.stderr.on('data', forward)
    child.on('close', (code) => {
      resolvePromise({ code, output })
    })
  })

const main = async () => {
  const { flags } = parseEqualsFlags(process.argv.slice(2))
  if (flags.help === true) {
    console.log(USAGE)
    return
  }
  const config = JSON.parse(await readFile(CONFIG, 'utf8'))
  const photosDir =
    typeof flags['photos-dir'] === 'string' ? resolve(flags['photos-dir']) : config.photosDir
  const jobs = flags.jobs === undefined ? DEFAULT_JOBS : Number(flags.jobs)
  if (!Number.isFinite(jobs) || jobs < 1) die('--jobs exige um inteiro ≥ 1.')
  const only =
    typeof flags.only === 'string' ? new Set(flags.only.split(',').map((s) => s.trim())) : null
  const dryRun = flags['dry-run'] === true
  const skipExisting = flags['skip-existing'] === true
  const audioOnly = flags['audio-only'] === true

  const entries = config.dobradinhas.filter((entry) => !only || only.has(entry.slug))
  if (entries.length === 0) die('Nenhuma dobradinha selecionada (--only sem correspondência?).')

  const failures = []
  const skipped = []
  const queue = [...entries]
  const results = []

  const runOne = async (entry) => {
    const photo = join(photosDir, entry.folder, 'foto.png')
    if (!existsSync(photo)) {
      failures.push({ slug: entry.slug, reason: `foto ausente: ${photo}` })
      console.log(`[${LABEL}] ${entry.slug}: FALHA (foto ausente)`)
      return
    }
    const outSlug = `colinha-${entry.slug}`
    const reelPath = join(ROOT, 'data/reels', outSlug, 'reel-card.mp4')
    if (skipExisting && existsSync(reelPath)) {
      skipped.push(entry.slug)
      console.log(`[${LABEL}] ${entry.slug}: já existe, pulando`)
      return
    }
    const args = [
      '--finale=card',
      '--beeps',
      `--estadual-name=${entry.catalog}`,
      `--estadual-number=${entry.number}`,
      `--estadual-photo=${photo}`,
      `--site-deputy=${entry.catalog}`,
      `--out-slug=${outSlug}`,
    ]
    if (audioOnly) args.push('--audio-only')
    const started = Date.now()
    const { code, output } = await runBuilder(args)
    const seconds = ((Date.now() - started) / 1000).toFixed(0)
    if (code !== 0) {
      failures.push({ slug: entry.slug, reason: output.trim().split('\n').slice(-3).join(' / ') })
      console.log(`[${LABEL}] ${entry.slug}: FALHA em ${seconds}s`)
      return
    }
    results.push({ slug: entry.slug, seconds })
    console.log(`[${LABEL}] ${entry.slug}: ok em ${seconds}s`)
  }

  if (dryRun) {
    for (const entry of entries) {
      const photo = join(photosDir, entry.folder, 'foto.png')
      console.log(
        `${entry.slug.padEnd(14)} ${entry.catalog.padEnd(26)} nº ${entry.number}  foto: ${existsSync(photo) ? 'ok' : 'AUSENTE'}`,
      )
    }
    console.log(`\n${entries.length} dobradinhas · ${jobs} em paralelo`)
    return
  }

  const workers = Array.from({ length: Math.min(jobs, queue.length) }, async () => {
    while (queue.length > 0) {
      const entry = queue.shift()
      await runOne(entry)
    }
  })
  await Promise.all(workers)

  console.log(`\n[${LABEL}] ${results.length}/${entries.length} reels gerados`)
  if (skipped.length > 0) console.log(`  pulados (já existiam): ${skipped.join(', ')}`)
  if (failures.length > 0) {
    for (const failure of failures) console.log(`  FALHA ${failure.slug}: ${failure.reason}`)
    process.exitCode = 1
  }
}

main().catch((error) => die(error?.stack ?? String(error)))
