// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  aggregateBackfillRuns,
  buildVodUrl,
  clockToSeconds,
  dateRangeChunks,
  legislatureForDate,
  matchExcerpt,
  normalizeSpeakerName,
  normalizeTranscription,
  parseDurationToSeconds,
  parseEventExcerpts,
  parseOfficialKeywords,
  parsePresidingOfficerTransitions,
  parseVodStatus,
  resolvePresidingOfficer,
  selectLinkSample,
  selectSpeechEvents,
  speechContentHash,
  speechDate,
  speechSourceKey,
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

describe('speechSourceKey', () => {
  it('joins datetime, type and phase into the stable identity', () => {
    expect(
      speechSourceKey({
        dataHoraInicio: '2023-02-07T17:28',
        tipoDiscurso: 'BREVES COMUNICAÇÕES',
        faseEvento: { titulo: 'Breves Comunicações' },
      }),
    ).toBe('2023-02-07T17:28|BREVES COMUNICAÇÕES|Breves Comunicações')
  })

  it('degrades missing parts to empty strings', () => {
    expect(speechSourceKey({})).toBe('||')
    expect(speechSourceKey(null)).toBe('||')
  })
})

describe('speechContentHash', () => {
  it('is stable for the same content and differs otherwise', () => {
    expect(speechContentHash('Sumário', 'Transcrição')).toBe(
      speechContentHash('Sumário', 'Transcrição'),
    )
    expect(speechContentHash('Sumário', 'Transcrição')).not.toBe(
      speechContentHash('Outro sumário', 'Transcrição'),
    )
    expect(speechContentHash(null, null)).toHaveLength(12)
  })
})

describe('parseOfficialKeywords', () => {
  it('splits newline-separated groups and comma-separated keywords', () => {
    expect(parseOfficialKeywords('Saúde, SUS\r\nEducação\r\n\r\nEscola')).toEqual([
      'Saúde',
      'SUS',
      'Educação',
      'Escola',
    ])
    // Live Câmara shape: one group per line, keywords joined by commas.
    expect(parseOfficialKeywords('Governo federal,reconstrução,Política pública')).toEqual([
      'Governo federal',
      'reconstrução',
      'Política pública',
    ])
    expect(parseOfficialKeywords(null)).toEqual([])
  })
})

describe('legislatureForDate', () => {
  it('maps dates to the legislature ranges at the boundaries', () => {
    expect(legislatureForDate('2023-02-01')).toBe('57')
    expect(legislatureForDate('2023-01-31')).toBe('56')
    expect(legislatureForDate('2015-02-01')).toBe('55')
    expect(legislatureForDate('2015-01-31')).toBe('54')
    expect(legislatureForDate('2011-01-01')).toBe('54')
  })

  it('returns null outside the supported range or for invalid input', () => {
    expect(legislatureForDate('2010-12-31')).toBeNull()
    expect(legislatureForDate('')).toBeNull()
    expect(legislatureForDate('2023-2-1')).toBeNull()
  })
})

describe('parseDurationToSeconds', () => {
  it('parses the excerpt card and VOD spellings', () => {
    expect(parseDurationToSeconds('0h04\'03"')).toBe(243)
    expect(parseDurationToSeconds('1h00\'00"')).toBe(3600)
    expect(parseDurationToSeconds('0:04:07')).toBe(247)
    expect(parseDurationToSeconds('4:07')).toBe(247)
  })

  it('rejects empty, malformed and out-of-range values', () => {
    expect(parseDurationToSeconds('')).toBeNull()
    expect(parseDurationToSeconds(null)).toBeNull()
    expect(parseDurationToSeconds('abc')).toBeNull()
    expect(parseDurationToSeconds('1::30')).toBeNull()
    expect(parseDurationToSeconds('1:99:99')).toBeNull()
    expect(parseDurationToSeconds('0h99\'00"')).toBeNull()
    expect(parseDurationToSeconds('1:99')).toBeNull()
  })
})

describe('parsePresidingOfficerTransitions', () => {
  const transitionHtml = (heading: string, times: number[]) => `
<h4 class="g-l-assista__categoria-outros-videos">${heading}</h4>
<ul class="g-l-assista__lista-outros-videos">
${times
  .map(
    (tMs) =>
      `<li><a id="link-trecho-video" href="https://www.camara.leg.br/evento-legislativo/67091?a&#x3D;558641&amp;t&#x3D;${tMs}&trechosOrador=&crawl=no" class="chamada__link-trecho" titulo="X">y</a></li>`,
  )
  .join('\n')}
</ul>`

  it('reads the transition groups, using the newest clip of each as the change moment', () => {
    const html = [
      transitionHtml(
        'Troca da mesa Presidente Bohn Gass por Participante Pompeo de Mattos',
        [1675815220717, 1675814951403],
      ),
      transitionHtml(
        'Troca da mesa Presidente Pompeo de Mattos por Participante Bohn Gass',
        [1675814710153],
      ),
    ].join('\n')

    expect(parsePresidingOfficerTransitions(html)).toEqual([
      { from: 'Pompeo de Mattos', to: 'Bohn Gass', tMs: 1675814710153 },
      { from: 'Bohn Gass', to: 'Pompeo de Mattos', tMs: 1675815220717 },
    ])
  })

  it('returns [] when the page has no transitions or the markup changes', () => {
    const html = excerptHtml(67091, {
      audioId: 5,
      tMs: 1000,
      speaker: 'JORGE SOLLA',
      party: 'DEPUTADO (PT-BA)',
      startTime: '17:30',
      duration: '0h01\'00"',
    })
    expect(parsePresidingOfficerTransitions(html)).toEqual([])
    expect(parsePresidingOfficerTransitions('')).toEqual([])
  })
})

describe('resolvePresidingOfficer', () => {
  // Real transition groups of event 67091 (2023-02-07), newest-clip times.
  const transitions = [
    { from: 'Bohn Gass', to: 'Pompeo de Mattos', tMs: 1675815220717 },
    { from: 'Gilberto Nascimento', to: 'Pompeo de Mattos', tMs: 1675800828283 },
    { from: 'Pompeo de Mattos', to: 'Adriana Ventura', tMs: 1675804114707 },
    { from: 'Adriana Ventura', to: 'Pompeo de Mattos', tMs: 1675804616513 },
    { from: 'Pompeo de Mattos', to: 'Bohn Gass', tMs: 1675814710153 },
  ]

  it('returns the incoming officer of the latest transition before the moment', () => {
    // Solla spoke at 17:28 BRT (20:28 UTC) — Gilberto→Pompeo at 17:13 BRT.
    expect(resolvePresidingOfficer(transitions, Date.parse('2023-02-07T20:28:00Z'))).toBe(
      'Pompeo de Mattos',
    )
    // After Bohn→Pompeo (21:13 BRT), Pompeo presided again.
    expect(resolvePresidingOfficer(transitions, Date.parse('2023-02-08T00:16:00Z'))).toBe(
      'Pompeo de Mattos',
    )
  })

  it('returns the outgoing officer before the first transition', () => {
    expect(resolvePresidingOfficer(transitions, Date.parse('2023-02-07T19:00:00Z'))).toBe(
      'Gilberto Nascimento',
    )
  })

  it('returns null without transitions or a usable moment', () => {
    expect(resolvePresidingOfficer([], 1675801680000)).toBeNull()
    expect(resolvePresidingOfficer(transitions, Number.NaN)).toBeNull()
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

describe('aggregateBackfillRuns', () => {
  it('sums the numeric blocks of every legislature and keeps the first LLM sample error', () => {
    const combined = aggregateBackfillRuns([
      {
        totals: {
          listed: 10,
          processed: 10,
          created: 8,
          updated: 2,
          withExcerpt: 9,
          withoutExcerpt: 1,
          withSegments: 8,
          failed: 1,
        },
        asr: { calls: 8, audioSeconds: 480, elapsedMs: 9000, failures: 0 },
        llm: {
          calls: 10,
          used: 10,
          failed: 0,
          totalTokens: 1000,
          estimatedCostUsd: 0.01,
          sampleError: null,
        },
        elapsedMs: 12_000,
      },
      {
        totals: {
          listed: 5,
          processed: 5,
          created: 0,
          updated: 5,
          withExcerpt: 5,
          withoutExcerpt: 0,
          withSegments: 5,
          failed: 0,
        },
        asr: { calls: 0, audioSeconds: 0, elapsedMs: 0, failures: 0 },
        llm: {
          calls: 5,
          used: 4,
          failed: 1,
          totalTokens: 400,
          estimatedCostUsd: 0.004,
          sampleError: 'timeout',
        },
        elapsedMs: 3_000,
      },
    ])

    expect(combined.totals).toEqual({
      listed: 15,
      processed: 15,
      created: 8,
      updated: 7,
      withExcerpt: 14,
      withoutExcerpt: 1,
      withSegments: 13,
      failed: 1,
    })
    expect(combined.asr).toEqual({ calls: 8, audioSeconds: 480, elapsedMs: 9000, failures: 0 })
    expect(combined.llm.calls).toBe(15)
    expect(combined.llm.used).toBe(14)
    expect(combined.llm.failed).toBe(1)
    expect(combined.llm.totalTokens).toBe(1400)
    expect(combined.llm.estimatedCostUsd).toBeCloseTo(0.014, 6)
    expect(combined.llm.sampleError).toBe('timeout')
    expect(combined.elapsedMs).toBe(15_000)
  })

  it('returns zeroed blocks for an empty/absent run list', () => {
    expect(aggregateBackfillRuns([]).totals.processed).toBe(0)
    expect(aggregateBackfillRuns(undefined).asr.audioSeconds).toBe(0)
    expect(aggregateBackfillRuns(undefined).llm.sampleError).toBeNull()
    expect(aggregateBackfillRuns(undefined).elapsedMs).toBe(0)
  })
})

describe('selectLinkSample', () => {
  const rows = [
    {
      id: 1,
      legislature: '57',
      speechAt: '2023-03-01T10:00',
      vodPlaybackUrl: 'https://vod/1',
      vodDownloadUrl: 'https://vod/1.mp4',
    },
    {
      id: 2,
      legislature: '57',
      speechAt: '2023-02-01T10:00',
      vodPlaybackUrl: null,
      vodDownloadUrl: null,
    },
    {
      id: 3,
      legislature: '57',
      speechAt: '2023-04-01T10:00',
      vodPlaybackUrl: 'https://vod/3',
      vodDownloadUrl: null,
    },
    {
      id: 4,
      legislature: '56',
      speechAt: '2021-02-01T10:00',
      vodPlaybackUrl: 'https://vod/4',
      vodDownloadUrl: 'https://vod/4.mp4',
    },
  ]

  it('picks up to n linked speeches per legislature, skipping link-less rows', () => {
    expect(
      selectLinkSample(rows, 1)
        .map((row) => row.id)
        .sort(),
    ).toEqual([1, 4])
    expect(
      selectLinkSample(rows, 5)
        .map((row) => row.id)
        .sort(),
    ).toEqual([1, 3, 4])
  })

  it('spreads the picks over a legislature larger than n', () => {
    const many = Array.from({ length: 6 }, (_, index) => ({
      id: index + 1,
      legislature: '55',
      speechAt: `2016-0${index + 1}-01T10:00`,
      vodPlaybackUrl: `https://vod/${index + 1}`,
      vodDownloadUrl: null,
    }))
    expect(
      selectLinkSample(many, 2)
        .map((row) => row.id)
        .sort(),
    ).toEqual([1, 4])
    expect(
      selectLinkSample(many, 3)
        .map((row) => row.id)
        .sort(),
    ).toEqual([1, 3, 5])
  })

  it('is deterministic for the same rows', () => {
    expect(selectLinkSample(rows, 2)).toEqual(selectLinkSample(rows, 2))
  })

  it('returns an empty sample when nothing carries a link', () => {
    expect(
      selectLinkSample(
        [{ id: 9, legislature: '55', speechAt: null, vodPlaybackUrl: null, vodDownloadUrl: null }],
        3,
      ),
    ).toEqual([])
  })
})

describe('dateRangeChunks', () => {
  it('splits a multi-year range into non-overlapping calendar years', () => {
    expect(dateRangeChunks('2015-02-01', '2019-01-31')).toEqual([
      ['2015-02-01', '2015-12-31'],
      ['2016-01-01', '2016-12-31'],
      ['2017-01-01', '2017-12-31'],
      ['2018-01-01', '2018-12-31'],
      ['2019-01-01', '2019-01-31'],
    ])
  })

  it('handles a single day and an exact year without spilling over', () => {
    expect(dateRangeChunks('2023-02-07', '2023-02-07')).toEqual([['2023-02-07', '2023-02-07']])
    expect(dateRangeChunks('2023-01-01', '2023-12-31')).toEqual([['2023-01-01', '2023-12-31']])
  })

  it('returns no chunks for malformed dates', () => {
    expect(dateRangeChunks('2023-1-1', '2023-12-31')).toEqual([])
    expect(dateRangeChunks('', '2023-12-31')).toEqual([])
  })
})
