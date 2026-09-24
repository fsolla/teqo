/**
 * Generic external-binary plumbing of the CLI tools: a process runner that
 * never throws, a fail-closed capability probe and the ffmpeg resolution
 * (`FFMPEG_PATH` → `ffmpeg` on PATH → the registry-packaged
 * `@ffmpeg-installer/ffmpeg` binary). Extracted from the reel composer (C196)
 * so the web-speech ingestion (C215) reuses the same owner instead of a second
 * resolver.
 *
 * Resolution order (see `docs/plans/reels-tutoriais-impl.md`, Decisão 2): the
 * packed fallback keeps the non-technical operator flow working on a
 * workstation without a system ffmpeg; the homeserver Docker build installs it
 * from npm (never from GitHub releases, which the homeserver cannot reach — see
 * the sharp override note in `pnpm-workspace.yaml`).
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const DEFAULT_MAX_BUFFER_BYTES = 16 * 1024 * 1024

/**
 * @typedef {{ ok: boolean, stdout: string, stderr: string, error?: { code?: string } }} RunResult
 * @typedef {(bin: string, args: string[]) => Promise<RunResult>} RunFn
 */

/**
 * Runs a process and returns the exit outcome instead of throwing.
 *
 * @type {(bin: string, args: string[]) => Promise<RunResult>}
 */
export const runProcess = async (bin, args) => {
  try {
    const { stdout, stderr } = await execFileAsync(bin, args, {
      maxBuffer: DEFAULT_MAX_BUFFER_BYTES,
    })
    return { ok: true, stdout, stderr }
  } catch (error) {
    return { ok: false, stdout: error.stdout ?? '', stderr: error.stderr ?? '', error }
  }
}

const defaultRun = runProcess

const versionLine = (stdout) =>
  stdout.split('\n').find((line) => line.startsWith('ffmpeg version')) ?? ''

/**
 * Capability probe: the binary must run and ship every required encoder and
 * filter. Missing capabilities are reported, never assumed.
 *
 * @param {string} bin
 * @param {{ run?: RunFn, audio?: boolean, encoders?: string[], filters?: string[] }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string } | { ok: false, bin: string, reason: string }>}
 */
export const probeFfmpeg = async (
  bin,
  { run = defaultRun, audio = false, encoders = [], filters = [] } = {},
) => {
  const version = await run(bin, ['-hide_banner', '-version'])
  if (!version.ok) {
    return { ok: false, bin, reason: `não executou (${version.error?.code ?? 'erro'})` }
  }

  const requiredEncoders = [...encoders, ...(audio ? ['libmp3lame'] : [])]
  if (requiredEncoders.length > 0) {
    const listed = await run(bin, ['-hide_banner', '-encoders'])
    const missing = requiredEncoders.filter(
      (encoder) => !listed.ok || !new RegExp(`\\b${encoder}\\b`).test(listed.stdout),
    )
    if (missing.length > 0) return { ok: false, bin, reason: `sem encoder ${missing.join(', ')}` }
  }

  if (filters.length > 0) {
    const listed = await run(bin, ['-hide_banner', '-filters'])
    if (!listed.ok) return { ok: false, bin, reason: 'não listou filtros' }
    const missing = filters.filter((filter) => !new RegExp(`\\b${filter}\\b`).test(listed.stdout))
    if (missing.length > 0)
      return { ok: false, bin, reason: `sem filtro(s): ${missing.join(', ')}` }
  }

  return { ok: true, bin, version: versionLine(version.stdout) }
}

const FFMPEG_INSTALL_HINT =
  'Defina FFMPEG_PATH, instale o ffmpeg (ex.: `sudo apt install ffmpeg`) ou rode `pnpm install` para o binário empacotado.'

/**
 * Resolves the first candidate that passes the probe. Explicit `FFMPEG_PATH` is strict.
 *
 * @param {{ env?: Record<string, string | undefined>, run?: RunFn, installer?: { path?: string } | null, audio?: boolean, encoders?: string[], filters?: string[], requirementsLabel?: string, installHint?: string }} [options]
 * @returns {Promise<{ ok: true, bin: string, version: string, source: string }>}
 */
export const resolveFfmpeg = async ({
  env = process.env,
  run = defaultRun,
  installer,
  audio = false,
  encoders = [],
  filters = [],
  requirementsLabel = '',
  installHint = FFMPEG_INSTALL_HINT,
} = {}) => {
  let packaged = installer
  if (packaged === undefined) {
    try {
      packaged = (await import('@ffmpeg-installer/ffmpeg')).default
    } catch {
      // The packaged binary throws on import when its platform package is
      // missing; the probe below decides, never the import.
      packaged = null
    }
  }
  const candidates = []
  const explicit = env.FFMPEG_PATH?.trim()
  if (explicit) candidates.push({ bin: explicit, source: 'FFMPEG_PATH', strict: true })
  candidates.push({ bin: 'ffmpeg', source: 'PATH', strict: false })
  if (packaged?.path) candidates.push({ bin: packaged.path, source: 'empacotado', strict: false })

  const failures = []
  for (const candidate of candidates) {
    const probe = await probeFfmpeg(candidate.bin, { run, audio, encoders, filters })
    if (probe.ok) {
      return { ok: true, bin: probe.bin, version: probe.version, source: candidate.source }
    }
    failures.push(`${candidate.source}: ${probe.reason}`)
    if (candidate.strict) break
  }

  const suffix = requirementsLabel ? ` (${requirementsLabel})` : ''
  throw new Error(`Nenhum ffmpeg utilizável${suffix}. ${failures.join('; ')}. ${installHint}`)
}

/**
 * Runs a process and fails with the stderr tail — never swallows the exit
 * code. Shared by the CLI tools (ffmpeg and edge-tts).
 *
 * @param {string} bin
 * @param {string[]} args
 * @param {{ run?: RunFn, label?: string }} [options]
 */
export const runTool = async (bin, args, { run = defaultRun, label = 'processo' } = {}) => {
  const result = await run(bin, args)
  if (!result.ok) {
    const tail = (result.stderr || result.error?.message || '').trim().slice(-400)
    throw new Error(`${label} falhou${tail ? `: ${tail}` : ''}`)
  }
  return result
}
