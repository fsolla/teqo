import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { buildReelMetadata } from '../../scripts/lib/reelPackage.mjs'
import { loadShotList, shotListHash } from '../../scripts/lib/reelShotList.mjs'

// C196 — the delivery contract of the reel builder: the package metadata the
// private library ingests, the versioned shot list of the first reel and the
// skill/command coupling (the reel is generated, never edited by hand).

const repoRoot = process.cwd()
const read = (path: string): string => readFileSync(resolve(repoRoot, path), 'utf8')

describe('reel package metadata', () => {
  it('carries the identity the library ingests', () => {
    const metadata = buildReelMetadata({
      shotList: { slug: 'cards', title: 'Crie seu card de apoio', feature: 'cards' },
      hash: 'a'.repeat(64),
      durationMs: 18_418.6,
      ffmpeg: 'ffmpeg version test',
      generatedAt: new Date('2026-09-18T12:00:00.000Z'),
    })
    expect(metadata).toEqual({
      slug: 'cards',
      title: 'Crie seu card de apoio',
      feature: 'cards',
      shotListHash: 'a'.repeat(64),
      durationMs: 18_419,
      width: 1_080,
      height: 1_920,
      fps: 30,
      codec: 'h264',
      audio: false,
      generatedAt: '2026-09-18T12:00:00.000Z',
      ffmpeg: 'ffmpeg version test',
    })
  })
})

describe('shot list of the first reel', () => {
  it('loads, validates and hashes the versioned cards shot list', async () => {
    const { shotList, hash } = await loadShotList({ slug: 'cards', root: repoRoot })
    expect(hash).toBe(shotListHash(shotList))
    expect(shotList.scenes[0]).toMatchObject({ kind: 'graphic', template: 'hook' })
    expect(shotList.scenes[shotList.scenes.length - 1]).toMatchObject({
      kind: 'graphic',
      template: 'cta',
    })
    const capture = shotList.scenes.filter((scene) => scene.kind === 'capture')
    expect(capture).toHaveLength(3)
    expect(capture.map((scene) => scene.badge?.number)).toEqual([1, 2, 3])
  })
})

describe('skill /reels-tutoriais contract', () => {
  it('ships the command coupled to the canonical skill', () => {
    const command = read('.opencode/commands/reels-tutoriais.md')
    expect(existsSync(resolve(repoRoot, '.agents/skills/reels-tutoriais/SKILL.md'))).toBe(true)
    expect(command).toContain('`reels-tutoriais`')
    expect(command).toContain('$ARGUMENTS')
    expect(command).toContain('.agents/skills/reels-tutoriais/SKILL.md')
    expect(command).toMatch(/^description: .+$/m)
    expect(command).not.toMatch(/^\s*["']?model["']?\s*:/m)
  })

  it('keeps the gate contract: shot list is the source, adjustments regenerate', () => {
    const skill = read('.agents/skills/reels-tutoriais/SKILL.md')
    expect(skill).toContain('shot list')
    expect(skill).toContain('Ajuste')
    expect(skill).toContain('pnpm reels:build')
    expect(skill).toContain('reel.mp4')
    expect(skill).toContain('capa.png')
    expect(skill).toContain('metadata.json')
    expect(skill).toContain('Nada é publicado')
  })
})
