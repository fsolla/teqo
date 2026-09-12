// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  buildVodUrl,
  clockToSeconds,
  matchExcerpt,
  normalizeSpeakerName,
  normalizeTranscription,
  parseEventExcerpts,
  parseVodStatus,
  selectSpeechEvents,
  speechDate,
  speechTimeOfDaySeconds,
} from '../../scripts/lib/camaraSpeeches.mjs'

const excerptHtml = (
  eventId: number,
  {
    audioId,
    tMs,
    speaker,
    party,
    startTime,
    duration,
  }: {
    audioId: number
    tMs: number
    speaker: string
    party: string
    startTime: string
    duration: string
  },
) => `
<article class="g-chamada">
  <a id="link-trecho-video" href="https://www.camara.leg.br/evento-legislativo/${eventId}?a&#x3D;${audioId}&amp;t&#x3D;${tMs}&trechosOrador=&crawl=no" class="chamada__link-trecho" titulo="${speaker}">
    <div class="l-chamada-conteudo">
      <h4 class="g-chamada__titulo"><b>${speaker}</b></h4>
      <span class="chamada__cargo">${party}</span>
      <div class="chamada__info-video">
        <span class="chamada__info-video-hora">Horário - ${startTime}</span>
        <br><span class="chamada__info-video-duracao">Duração - ${duration}</span>
      </div>
    </div>
  </a>
</article>`

describe('normalizeSpeakerName', () => {
  it('strips accents, case and punctuation', () => {
    expect(normalizeSpeakerName('  Jorge  Solla ')).toBe('JORGE SOLLA')
    expect(normalizeSpeakerName('José Ação')).toBe('JOSE ACAO')
    expect(normalizeSpeakerName('')).toBe('')
  })
})

describe('clock helpers', () => {
  it('parses HH:MM and HH:MM:SS', () => {
    expect(clockToSeconds('17:30')).toBe(63000)
    expect(clockToSeconds('09:28:15')).toBe(34095)
    expect(clockToSeconds('24:00')).toBeNull()
    expect(clockToSeconds('abc')).toBeNull()
  })

  it('extracts time-of-day and date from a naive datetime', () => {
    expect(speechTimeOfDaySeconds('2023-02-07T17:28')).toBe(62880)
    expect(speechTimeOfDaySeconds('2023-02-07')).toBeNull()
    expect(speechDate('2023-02-07T17:28')).toBe('2023-02-07')
  })
})

describe('parseEventExcerpts', () => {
  it('reads the speaker anchors with card metadata', () => {
    const html = [
      excerptHtml(67091, {
        audioId: 558641,
        tMs: 1675801808560,
        speaker: 'JORGE SOLLA',
        party: 'DEPUTADO (PT-BA)',
        startTime: '17:30',
        duration: '0h04\'07"',
      }),
      excerptHtml(67091, {
        audioId: 558641,
        tMs: 1675792829010,
        speaker: 'POMPEO DE MATTOS',
        party: 'DEPUTADO (PDT-RS)',
        startTime: '21:22',
        duration: '0h04\'03"',
      }),
    ].join('\n')

    expect(parseEventExcerpts(html, 67091)).toEqual([
      {
        audioId: 558641,
        tMs: 1675801808560,
        speaker: 'JORGE SOLLA',
        party: 'DEPUTADO (PT-BA)',
        startTime: '17:30',
        duration: '0h04\'07"',
      },
      {
        audioId: 558641,
        tMs: 1675792829010,
        speaker: 'POMPEO DE MATTOS',
        party: 'DEPUTADO (PDT-RS)',
        startTime: '21:22',
        duration: '0h04\'03"',
      },
    ])
  })

  it('returns [] when the page has no excerpt anchors or the event id differs', () => {
    const html = excerptHtml(111, {
      audioId: 5,
      tMs: 1000,
      speaker: 'X',
      party: 'Y',
      startTime: '10:00',
      duration: '0h01\'00"',
    })
    expect(parseEventExcerpts(html, 67091)).toEqual([])
    expect(parseEventExcerpts('', 67091)).toEqual([])
  })

  it('degrades card metadata to null when the spans are missing', () => {
    const html =
      '<a id="link-trecho-video" href="https://www.camara.leg.br/evento-legislativo/67091?a&#x3D;5&amp;t&#x3D;1000&trechosOrador=&crawl=no" class="chamada__link-trecho" titulo="JORGE SOLLA">x</a>'
    expect(parseEventExcerpts(html, 67091)).toEqual([
      {
        audioId: 5,
        tMs: 1000,
        speaker: 'JORGE SOLLA',
        party: null,
        startTime: null,
        duration: null,
      },
    ])
  })
})

describe('buildVodUrl', () => {
  it('targets the async VOD endpoint with audio id and excerpt epoch', () => {
    expect(buildVodUrl(67091, 558641, 1675801808560)).toBe(
      'https://www.camara.leg.br/evento-legislativo/67091/video-sob-demanda?idAudio=558641&trecho=1675801808560',
    )
  })
})

describe('parseVodStatus', () => {
  it('normalizes the PRONTO payload', () => {
    expect(
      parseVodStatus({
        estado: 'PRONTO',
        video: {
          titulo: 'Jorge Solla',
          subtitulo: 'DEPUTADO (PT-BA)',
          duracao: '0:04:07',
          horario: "17h30'08''",
          linkParaDownload: 'https://vod.camara.leg.br/vod/download?p=abc.mp4',
          linkParaReproducao: 'https://vod.camara.leg.br/videos/abc.mp4',
        },
      }),
    ).toEqual({
      state: 'PRONTO',
      video: {
        title: 'Jorge Solla',
        subtitle: 'DEPUTADO (PT-BA)',
        duration: '0:04:07',
        clock: "17h30'08''",
        downloadUrl: 'https://vod.camara.leg.br/vod/download?p=abc.mp4',
        playbackUrl: 'https://vod.camara.leg.br/videos/abc.mp4',
      },
    })
  })

  it('handles GERANDO/INDISPONIVEL and malformed input', () => {
    expect(parseVodStatus({ estado: 'GERANDO', video: null })).toEqual({
      state: 'GERANDO',
      video: null,
    })
    expect(parseVodStatus({ estado: 'INDISPONIVEL', video: null })).toEqual({
      state: 'INDISPONIVEL',
      video: null,
    })
    expect(parseVodStatus(null)).toEqual({ state: 'DESCONHECIDO', video: null })
  })
})

describe('selectSpeechEvents', () => {
  const events: Array<{ id: number; dataHoraInicio: string }> = [
    { id: 1, dataHoraInicio: '2023-02-07T15:00' },
    { id: 2, dataHoraInicio: '2023-02-07T20:00' },
    { id: 3, dataHoraInicio: '2023-02-08T15:00' },
  ]

  it('keeps only the speech date and sorts nearest-first', () => {
    const selected = selectSpeechEvents(events, '2023-02-07T17:28')
    expect(selected.map((e) => e.id)).toEqual([1, 2])
  })

  it('is empty when nothing matches the date', () => {
    expect(selectSpeechEvents(events, '2020-01-01T10:00')).toEqual([])
  })
})

describe('matchExcerpt', () => {
  const excerpts = [
    {
      audioId: 1,
      tMs: 100,
      speaker: 'JORGE SOLLA',
      party: 'DEPUTADO (PT-BA)',
      startTime: '09:28',
      duration: null,
    },
    {
      audioId: 2,
      tMs: 200,
      speaker: 'JORGE SOLLA',
      party: 'DEPUTADO (PT-BA)',
      startTime: '17:30',
      duration: null,
    },
    {
      audioId: 3,
      tMs: 300,
      speaker: 'OUTRO',
      party: null,
      startTime: '09:00',
      duration: null,
    },
  ]

  it('picks the speaker excerpt nearest the speech time (accent-insensitive)', () => {
    expect(matchExcerpt(excerpts, '2016-03-10T09:28', 'Jorge Solla')?.audioId).toBe(1)
    expect(matchExcerpt(excerpts, '2023-02-07T17:28', 'Jorge Solla')?.audioId).toBe(2)
  })

  it('returns null when the speaker is absent or empty', () => {
    expect(matchExcerpt(excerpts, '2016-03-10T09:28', 'Fulano de Tal')).toBeNull()
    expect(matchExcerpt(excerpts, '2016-03-10T09:28', '')).toBeNull()
  })

  it('prefers an excerpt with a clock over one without', () => {
    const withMissing = [
      { audioId: 9, tMs: 1, speaker: 'JORGE SOLLA', party: null, startTime: null, duration: null },
      ...excerpts,
    ]
    expect(matchExcerpt(withMissing, '2016-03-10T09:28', 'Jorge Solla')?.audioId).toBe(1)
  })
})

describe('normalizeTranscription', () => {
  it('accepts the OpenAI-compat segments shape', () => {
    expect(
      normalizeTranscription({
        text: 'olá mundo',
        language: 'pt',
        duration: 12.5,
        segments: [
          { start: 0, end: 2.7, text: ' olá' },
          { start: 2.91, end: 4.1, text: ' mundo' },
        ],
      }),
    ).toEqual({
      text: 'olá mundo',
      language: 'pt',
      duration: 12.5,
      segments: [
        { start: 0, end: 2.7, text: 'olá' },
        { start: 2.91, end: 4.1, text: 'mundo' },
      ],
    })
  })

  it('accepts the native chunks shape and drops invalid entries', () => {
    const result = normalizeTranscription({
      chunks: [
        { timestamp: [0, 1.5], text: 'a' },
        { timestamp: [null, null], text: 'lixo' },
        { timestamp: [2, 3], text: '' },
      ],
      language: 'pt',
    })
    expect(result.segments).toEqual([{ start: 0, end: 1.5, text: 'a' }])
    expect(result.text).toBe('a')
  })

  it('degrades on malformed input', () => {
    expect(normalizeTranscription(null)).toEqual({
      text: '',
      language: null,
      duration: null,
      segments: [],
    })
  })

  it('keeps a missing duration as null instead of 0', () => {
    expect(normalizeTranscription({ duration: null, segments: [] }).duration).toBeNull()
    expect(normalizeTranscription({ duration: '', segments: [] }).duration).toBeNull()
    expect(normalizeTranscription({ duration: 12, segments: [] }).duration).toBe(12)
  })

  it('prefers segments over chunks when both are present', () => {
    const result = normalizeTranscription({
      segments: [{ start: 0, end: 1, text: 'seg' }],
      chunks: [{ timestamp: [2, 3], text: 'chunk' }],
    })
    expect(result.segments).toEqual([{ start: 0, end: 1, text: 'seg' }])
  })
})
