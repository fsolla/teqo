import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  buildColinhaBeats,
  buildColinhaTimeline,
  COLINHA_BEAT_DURATIONS,
  COLINHA_CANDIDATES,
  COLINHA_REEL,
  COLINHA_URNA_ORDER,
  getColinhaCandidate,
} from '../../scripts/lib/colinhaReel.mjs'
import { colinhaReelHtml } from '../../scripts/lib/colinhaReelTemplate.mjs'

// The colinha chat reel — the script is the single source of the piece: the
// urna order, the ballot numbers, the beat timing and the two end screens are
// pinned here, and the template must render every beat of the script.

const ASSETS_DIR = join(process.cwd(), 'scripts/reels/assets', 'colinha-time-1313')

const REQUIRED_ASSETS = [
  'solla.webp',
  'julio.webp',
  'wagner.webp',
  'rui.webp',
  'jeronimo.webp',
  'lula.webp',
  'logo-o.webp',
  'fonts/inter-latin.woff2',
]

describe('colinhaReel', () => {
  it('keeps the ticket in urna order with the official ballot numbers', () => {
    expect(COLINHA_URNA_ORDER).toEqual(['solla', 'julio', 'wagner', 'rui', 'jeronimo', 'lula'])
    expect(COLINHA_CANDIDATES.map((candidate) => candidate.number)).toEqual([
      '1313',
      '13999',
      '130',
      '133',
      '13',
      '13',
    ])
    expect(COLINHA_CANDIDATES.map((candidate) => candidate.office)).toEqual([
      'DEPUTADO FEDERAL',
      'DEPUTADO ESTADUAL',
      'SENADOR (1ª VAGA)',
      'SENADOR (2ª VAGA)',
      'GOVERNADOR',
      'PRESIDENTE',
    ])
    expect(COLINHA_CANDIDATES.map((candidate) => candidate.ask)).toEqual([
      'Deputado Federal',
      'Deputado Estadual',
      'Senador (1ª vaga)',
      'Senador (2ª vaga)',
      'Governador',
      'Presidente',
    ])
    expect(COLINHA_REEL.slug).toBe('colinha-time-1313')
  })

  it('ships the committed photo for every candidate and the star badge', () => {
    for (const candidate of COLINHA_CANDIDATES) {
      expect(existsSync(join(ASSETS_DIR, candidate.photo))).toBe(true)
    }
    for (const asset of REQUIRED_ASSETS) {
      expect(existsSync(join(ASSETS_DIR, asset))).toBe(true)
    }
    expect(getColinhaCandidate('solla')?.name).toBe('JORGE SOLLA')
    expect(getColinhaCandidate('nobody')).toBeUndefined()
  })

  it('asks the full question once, then the short "e pra …?" for every candidate', () => {
    const beats = buildColinhaBeats()
    const asks = beats.filter((beat) => beat.id.startsWith('ask-'))
    expect(asks).toHaveLength(COLINHA_CANDIDATES.length)
    expect(asks[0].text).toBe('pra Deputado Federal, quem você escolheu?')
    expect(asks.slice(1).map((beat) => beat.text)).toEqual([
      'e pra Deputado Estadual?',
      'e pra Senador (1ª vaga)?',
      'e pra Senador (2ª vaga)?',
      'e pra Governador?',
      'e pra Presidente?',
    ])
  })

  it('walks every candidate through ask → number → card and ends on the assembling slip', () => {
    const beats = buildColinhaBeats({ finale: 'motion' })
    const kinds = beats.map((beat) => beat.kind)
    expect(kinds[0]).toBe('voter')
    expect(beats.at(-1)?.kind).toBe('brand')
    const reveals = beats.filter((beat) => beat.kind === 'reveal')
    expect(reveals.map((beat) => beat.candidateId)).toEqual(COLINHA_URNA_ORDER)
    expect(beats.filter((beat) => beat.kind === 'end')).toHaveLength(1)
    expect(beats.find((beat) => beat.kind === 'end')?.screen).toBe('colinha')

    const staticBeats = buildColinhaBeats({ finale: 'static' })
    expect(staticBeats.filter((beat) => beat.kind === 'reveal')).toHaveLength(0)
    expect(staticBeats.at(-1)?.kind).toBe('brand')
    expect(staticBeats.at(-2)?.kind).toBe('end')
    const staticEnd = staticBeats.find((beat) => beat.kind === 'end')
    expect((staticEnd?.durationMs ?? 0) > 4000).toBe(true)

    for (const candidate of COLINHA_CANDIDATES) {
      const start = beats.findIndex((beat) => beat.id === `ask-${candidate.id}`)
      expect(start).toBeGreaterThan(-1)
      expect(beats[start + 1]).toMatchObject({
        id: `number-${candidate.id}`,
        kind: 'number',
        text: candidate.number,
        candidateId: candidate.id,
      })
      expect(beats[start + 2]).toMatchObject({ id: `card-${candidate.id}`, kind: 'card' })
    }

    const voterNumbers = beats.filter((beat) => beat.kind === 'number')
    expect(voterNumbers.map((beat) => beat.text)).toEqual(
      COLINHA_CANDIDATES.map((candidate) => candidate.number),
    )
  })

  it('derives the timeline cumulatively and hides each typing beat when the reply lands', () => {
    const beats = buildColinhaBeats()
    const timeline = buildColinhaTimeline(beats, 30)
    const expectedTotal = beats.reduce((sum, beat) => sum + beat.durationMs, 0)
    expect(timeline.totalMs).toBe(expectedTotal)
    expect(timeline.frameCount).toBe(Math.round((expectedTotal / 1000) * 30))
    expect(timeline.entries[0].atMs).toBe(0)
    timeline.entries.forEach((entry, index) => {
      if (index > 0) expect(entry.atMs).toBe(timeline.entries[index - 1].endsAtMs)
      if (entry.kind === 'typing') {
        expect(entry.hideAtMs).toBe(timeline.entries[index + 1]?.atMs)
      }
    })
    for (const [id, entry] of timeline.byId) {
      expect(entry.id).toBe(id)
    }
    expect(COLINHA_BEAT_DURATIONS.flip).toBeGreaterThan(0)
    expect(timeline.totalMs).toBeGreaterThan(20_000)
  })

  it('renders every beat, card and the assembling end screen in the template', () => {
    const timeline = buildColinhaTimeline(buildColinhaBeats(), 30)
    const reveals = timeline.entries.flatMap((entry) =>
      entry.kind === 'reveal' && entry.candidateId
        ? [{ candidateId: entry.candidateId, atMs: entry.atMs, durationMs: entry.durationMs }]
        : [],
    )
    const html = colinhaReelHtml({
      beats: timeline.entries,
      candidates: COLINHA_CANDIDATES,
      reveals,
      brandAtMs: timeline.byId.get('brand')?.atMs ?? 0,
      drawnRow: COLINHA_CANDIDATES[1].id,
      totalMs: timeline.totalMs,
      flipMs: COLINHA_BEAT_DURATIONS.flip,
      fontCss: '',
      assets: { waveClip: 'polygon(0px 0px,540px 0px)' },
    })
    for (const entry of timeline.entries) {
      if (entry.kind === 'end') continue
      expect(html).toContain(`data-beat="${entry.id}"`)
    }
    for (const candidate of COLINHA_CANDIDATES) {
      expect(html).toContain(candidate.name)
      expect(html).toContain(candidate.office)
      expect(html).toContain(`>${candidate.number[0]}</span>`)
    }
    for (const candidate of COLINHA_CANDIDATES) {
      expect(html).toContain(`data-figure="${candidate.id}"`)
      expect(html).toContain(`data-logo="${candidate.id}"`)
      expect(html).toContain(`data-row="${candidate.id}"`)
    }
    expect(html).toContain('id="screen-colinha"')
    expect(html).toContain('id="title-patch"')
    expect(html).toContain('>Time 1313</span>')
    expect(html).not.toContain('⭐')
    expect(html).toContain('prontinho! colinha completa. bom voto! ✅')
    expect(html).toContain('window.__colinhaConfig=')

    const cardHtml = colinhaReelHtml({
      beats: timeline.entries,
      candidates: COLINHA_CANDIDATES,
      reveals,
      brandAtMs: timeline.byId.get('brand')?.atMs ?? 0,
      drawnRow: COLINHA_CANDIDATES[1].id,
      totalMs: timeline.totalMs,
      flipMs: COLINHA_BEAT_DURATIONS.flip,
      fontCss: '',
      assets: { siteCard: 'data:image/png;base64,AAAA' },
      cardFinale: true,
    })
    expect(cardHtml).toContain('data:image/png;base64,AAAA')
    expect(cardHtml).not.toContain('group--sharp')
  })
})
