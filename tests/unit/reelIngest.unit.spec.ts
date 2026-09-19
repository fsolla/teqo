// @vitest-environment node

import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { reelArtifactAlt, reelArtifactMimetype, reelArtifactStorageFilename } from '@/lib/reel'
import {
  assertReelIngestApplyConfirm,
  assertReelIngestTarget,
  parseReelIngestArgs,
  readReelPackage,
  reelPackageIssues,
} from '../../scripts/lib/reel-ingest.mjs'

const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)
const MP4_BYTES = Buffer.from('fixture-mp4-bytes')
const SRT_BYTES = Buffer.from('1\n00:00:00,000 --> 00:00:01,000\nOlá\n')

const validMetadata = (overrides: Record<string, unknown> = {}) => ({
  title: 'Tutorial dos cards',
  feature: 'cards',
  shotListHash: 'a'.repeat(64),
  coverAlt: 'Tela dos cards de apoio da home',
  durationSeconds: 42,
  createdAt: '2026-09-18T12:00:00.000Z',
  ...overrides,
})

const tempDirs: string[] = []

const makePackage = async ({
  metadata = validMetadata(),
  files = { 'reel.mp4': MP4_BYTES, 'capa.png': PNG_BYTES, 'narracao.srt': SRT_BYTES },
  omitMetadata = false,
}: {
  metadata?: unknown
  files?: Record<string, Buffer>
  omitMetadata?: boolean
} = {}) => {
  const directory = await mkdtemp(join(tmpdir(), 'reel-package-'))
  tempDirs.push(directory)
  for (const [name, body] of Object.entries(files)) {
    await writeFile(join(directory, name), body)
  }
  if (!omitMetadata) {
    await writeFile(
      join(directory, 'metadata.json'),
      typeof metadata === 'string' ? metadata : JSON.stringify(metadata),
    )
  }
  return directory
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('parseReelIngestArgs (C195)', () => {
  it('reads the package directory and defaults to dry-run', () => {
    expect(parseReelIngestArgs(['/srv/reels/cards'])).toEqual({
      directory: '/srv/reels/cards',
      apply: false,
    })
  })

  it('accepts the bare --apply write flag', () => {
    expect(parseReelIngestArgs(['/srv/reels/cards', '--apply'])).toEqual({
      directory: '/srv/reels/cards',
      apply: true,
    })
  })

  it('refuses a missing directory, extra positionals, unknown flags and valued --apply', () => {
    expect(() => parseReelIngestArgs([])).toThrow(/diretório do pacote/)
    expect(() => parseReelIngestArgs(['a', 'b'])).toThrow(/posicional extra/)
    expect(() => parseReelIngestArgs(['/pkg', '--force'])).toThrow(/desconhecido/)
    expect(() => parseReelIngestArgs(['/pkg', '--apply=1'])).toThrow(/não aceita valor/)
    for (const argv of [[], ['a', 'b'], ['/pkg', '--force'], ['/pkg', '--apply=1']]) {
      expect(() => parseReelIngestArgs(argv)).toThrow(/pnpm reels:ingest/)
    }
  })
})

describe('assertReelIngestApplyConfirm (C195 write gate)', () => {
  it('requires the intent flag only on --apply', () => {
    expect(() => assertReelIngestApplyConfirm({ apply: false, confirm: false })).not.toThrow()
    expect(() => assertReelIngestApplyConfirm({ apply: true, confirm: true })).not.toThrow()
    expect(() => assertReelIngestApplyConfirm({ apply: true, confirm: false })).toThrow(
      /REELS_INGEST_CONFIRM=1/,
    )
    expect(() => assertReelIngestApplyConfirm()).not.toThrow()
  })
})

describe('assertReelIngestTarget (C195 fail-closed)', () => {
  it('accepts the declared environment paired with its exact database', () => {
    expect(
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_1313',
        teqoEnv: 'production',
        isTest: false,
      }),
    ).toEqual({ environment: 'production', databaseName: 'teqo_1313' })
    expect(
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@postgres:5432/teqo_staging',
        teqoEnv: 'staging',
        isTest: false,
      }),
    ).toEqual({ environment: 'staging', databaseName: 'teqo_staging' })
  })

  it('refuses a database that does not match the declared environment', () => {
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_staging',
        teqoEnv: 'production',
        isTest: false,
      }),
    ).toThrow(/≠ "teqo_1313"/)
  })

  it('refuses a missing or unknown TEQO_ENV', () => {
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_1313',
        teqoEnv: undefined,
        isTest: false,
      }),
    ).toThrow(/TEQO_ENV/)
    expect(() =>
      assertReelIngestTarget({ databaseUrl: '', teqoEnv: 'production', isTest: false }),
    ).toThrow(/DATABASE_URL ausente/)
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo',
        teqoEnv: 'dev',
        isTest: false,
      }),
    ).toThrow(/TEQO_ENV/)
  })

  it('refuses the remote override, a remote host and a non-Postgres protocol', () => {
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@127.0.0.1:5432/teqo_1313',
        teqoEnv: 'production',
        allowRemoteDb: true,
        isTest: false,
      }),
    ).toThrow(/ALLOW_REMOTE_DB/)
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@db.example.com:5432/teqo_1313',
        teqoEnv: 'production',
        isTest: false,
      }),
    ).toThrow(/allowlist local/)
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'mysql://teqo:teqo@127.0.0.1:3306/teqo_1313',
        teqoEnv: 'production',
        isTest: false,
      }),
    ).toThrow(/postgresql/)
  })

  it('accepts only teqo*_test databases inside a test run', () => {
    expect(
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_wt195_test',
        isTest: true,
      }),
    ).toEqual({ environment: 'test', databaseName: 'teqo_wt195_test' })
    expect(() =>
      assertReelIngestTarget({
        databaseUrl: 'postgresql://teqo:teqo@localhost:5432/teqo_1313',
        isTest: true,
      }),
    ).toThrow(/não é de teste/)
  })
})

describe('readReelPackage (C195 package contract)', () => {
  it('reads a complete package and flags the present artifacts', async () => {
    const directory = await makePackage()

    const reelPackage = await readReelPackage(directory)

    expect(reelPackage.metadata.title).toBe('Tutorial dos cards')
    expect(reelPackage.transcriptPath).toBeNull()
    const byKind = Object.fromEntries(reelPackage.artifacts.map((a) => [a.kind, a]))
    expect(byKind.video).toMatchObject({ field: 'video', required: true, present: true })
    expect(byKind.cover).toMatchObject({ field: 'cover', required: true, present: true })
    expect(byKind.captions).toMatchObject({ field: 'captions', required: true, present: true })
    expect(byKind.narration).toMatchObject({
      field: 'narrationAudio',
      required: false,
      present: false,
    })
    expect(byKind['video-audio']).toMatchObject({ field: 'videoWithAudio', present: false })
  })

  it('reads the optional transcript when the package carries it', async () => {
    const directory = await makePackage({
      files: {
        'reel.mp4': MP4_BYTES,
        'capa.png': PNG_BYTES,
        'narracao.srt': SRT_BYTES,
        'roteiro.md': Buffer.from('# Roteiro'),
      },
    })

    const reelPackage = await readReelPackage(directory)

    expect(reelPackage.transcriptPath).toBe(join(directory, 'roteiro.md'))
  })

  it('refuses an incomplete or invalid package listing every pending item', async () => {
    const directory = await makePackage({
      metadata: validMetadata({ feature: 'inventada', shotListHash: 'abc', coverAlt: '' }),
      files: { 'reel.mp4': MP4_BYTES, 'capa.png': PNG_BYTES },
    })

    await expect(readReelPackage(directory)).rejects.toThrow(
      /feature[\s\S]*shotListHash[\s\S]*coverAlt[\s\S]*narracao\.srt/,
    )
  })

  it('refuses a missing metadata.json, an unreadable one and an unknown directory', async () => {
    const noMetadata = await makePackage({ omitMetadata: true })
    await expect(readReelPackage(noMetadata)).rejects.toThrow(/metadata\.json/)

    const brokenMetadata = await makePackage({ metadata: '{ not json' })
    await expect(readReelPackage(brokenMetadata)).rejects.toThrow(/ilegível/)

    await expect(readReelPackage('/nonexistent/reel-package')).rejects.toThrow(
      /diretório do pacote inválido/,
    )
  })

  it('validates the optional duration and date when present', async () => {
    const directory = await makePackage({
      metadata: validMetadata({ durationSeconds: -1, createdAt: 'ontem' }),
    })

    await expect(readReelPackage(directory)).rejects.toThrow(/durationSeconds[\s\S]*createdAt/)
  })

  it('refuses an empty artifact before the dry-run says OK', async () => {
    const directory = await makePackage({
      files: { 'reel.mp4': Buffer.alloc(0), 'capa.png': PNG_BYTES, 'narracao.srt': SRT_BYTES },
    })

    await expect(readReelPackage(directory)).rejects.toThrow(
      /artefato vazio ou ilegível: reel\.mp4/,
    )
  })

  it('collects issues without a filesystem through reelPackageIssues', () => {
    const issues = reelPackageIssues({
      metadata: validMetadata({ title: 'x'.repeat(201) }),
      fileNames: new Set(['metadata.json', 'reel.mp4', 'capa.png', 'narracao.srt']),
    })

    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatch(/title/)
    expect(reelPackageIssues({ metadata: 42, fileNames: new Set() })).toHaveLength(1)
  })
})

describe('artifact naming, mimetype and alt (C195)', () => {
  it('names stored files deterministically by hash prefix, kind and extension', () => {
    const hash = '0123456789abcdef'.repeat(4)
    const video = { filename: 'reel.mp4', kind: 'video' } as const
    const captions = { filename: 'narracao.srt', kind: 'captions' } as const

    expect(reelArtifactStorageFilename(hash, video)).toBe(`reel-${hash}-video.mp4`)
    expect(reelArtifactStorageFilename(hash, captions)).toBe(`reel-${hash}-captions.srt`)
    expect(reelArtifactStorageFilename(hash, video)).toBe(reelArtifactStorageFilename(hash, video))
  })

  it('maps the fixed content types of the contract', () => {
    expect(reelArtifactMimetype('video')).toBe('video/mp4')
    expect(reelArtifactMimetype('video-audio')).toBe('video/mp4')
    expect(reelArtifactMimetype('narration')).toBe('audio/mpeg')
    expect(reelArtifactMimetype('captions')).toBe('application/x-subrip')
    expect(reelArtifactMimetype('cover')).toBe('image/png')
  })

  it('uses the manifest alt for the cover and derives the others from the title', () => {
    const input = { title: 'Tutorial dos cards', coverAlt: 'Tela dos cards' }

    expect(reelArtifactAlt({ ...input, kind: 'cover' })).toBe('Tela dos cards')
    expect(reelArtifactAlt({ ...input, kind: 'video' })).toBe('Vídeo do reel "Tutorial dos cards"')
    expect(reelArtifactAlt({ ...input, kind: 'narration' })).toBe(
      'Narração do reel "Tutorial dos cards"',
    )
  })
})
