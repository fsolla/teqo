// @vitest-environment node

import { describe, expect, it } from 'vitest'

import {
  canRetryContentPiece,
  contentPieceFailureMessage,
  contentPieceIsPublic,
  contentPieceLinkFailureReasonLabels,
  contentPieceLinkTitle,
  contentPieceOriginFromLink,
  contentPieceSearchText,
  contentPieceSlugBase,
  contentPieceSlugCandidates,
  contentPieceTitleFromFilename,
  contentPieceTypeFromMime,
  isContentPieceCuratedField,
  isContentPieceLinkFailureReason,
  isContentPieceOrigin,
  isContentPieceProcessingStatus,
  isContentPieceStatus,
  isContentPieceStep,
  isContentPieceTopic,
  isContentPieceType,
  needsContentPieceProcessing,
  parseContentPieceLink,
  sanitizeContentPieceFilename,
  toContentPieceViewModel,
} from '@/lib/contentPiece'
import {
  buildContentPieceListWhere,
  parseContentPieceListParams,
  resolveContentPieceListUrl,
} from '@/utilities/content/contentPieceListUrl'

describe('content piece vocabulary', () => {
  it('guards every persisted enum', () => {
    expect(isContentPieceType('video')).toBe(true)
    expect(isContentPieceType('card')).toBe(true)
    expect(isContentPieceType('reels')).toBe(false)
    expect(isContentPieceStatus('publicado')).toBe(true)
    expect(isContentPieceStatus('published')).toBe(false)
    expect(isContentPieceProcessingStatus('falhou')).toBe(true)
    expect(isContentPieceProcessingStatus('failed')).toBe(false)
    expect(isContentPieceStep('catalogando')).toBe(true)
    expect(isContentPieceStep('extracting')).toBe(false)
    expect(isContentPieceCuratedField('transcript')).toBe(true)
    expect(isContentPieceCuratedField('slug')).toBe(false)
    expect(isContentPieceOrigin('arquivo')).toBe(true)
    expect(isContentPieceOrigin('link')).toBe(false)
    expect(isContentPieceLinkFailureReason('carrossel')).toBe(true)
    expect(isContentPieceLinkFailureReason('sem-credencial')).toBe(true)
    expect(isContentPieceLinkFailureReason('falhou')).toBe(false)
    expect(isContentPieceTopic('saude')).toBe(true)
    expect(isContentPieceTopic('nao-existe')).toBe(false)
  })

  it('labels the four peça-link reasons verbatim (gate copy)', () => {
    expect(contentPieceLinkFailureReasonLabels).toEqual({
      'nao-encontrado': 'Link não encontrado entre as mídias recentes do perfil',
      carrossel: 'Carrossel: sem arquivo único para baixar',
      indisponivel: 'Instagram indisponível no momento',
      'sem-credencial': 'Sem credencial do Instagram configurada',
    })
  })

  it('knows which types need the pipeline', () => {
    expect(needsContentPieceProcessing('video')).toBe(true)
    expect(needsContentPieceProcessing('audio')).toBe(true)
    expect(needsContentPieceProcessing('texto')).toBe(true)
    expect(needsContentPieceProcessing('foto')).toBe(false)
    expect(needsContentPieceProcessing('card')).toBe(false)
  })

  it('retries only a failed piece', () => {
    expect(canRetryContentPiece('falhou')).toBe(true)
    expect(canRetryContentPiece('pronto')).toBe(false)
    expect(canRetryContentPiece('processando')).toBe(false)
  })

  it('is public only when published with something to show', () => {
    expect(contentPieceIsPublic({ status: 'publicado', hasFile: true, sourceUrl: null })).toBe(true)
    expect(
      contentPieceIsPublic({ status: 'publicado', hasFile: false, sourceUrl: 'https://x/y' }),
    ).toBe(true)
    expect(contentPieceIsPublic({ status: 'publicado', hasFile: false, sourceUrl: null })).toBe(
      false,
    )
    expect(contentPieceIsPublic({ status: 'rascunho', hasFile: true, sourceUrl: null })).toBe(false)
  })

  it('maps the stored failure to honest copy by step', () => {
    expect(contentPieceFailureMessage({ error: null })).toBeNull()
    expect(contentPieceFailureMessage({ error: 'boom', step: 'transcrevendo' })).toBe(
      'Não foi possível transcrever a peça.',
    )
    expect(contentPieceFailureMessage({ error: 'boom', step: 'catalogando' })).toBe(
      'Não foi possível catalogar a peça.',
    )
    expect(
      contentPieceFailureMessage({
        error: 'O processamento foi interrompido antes de terminar.',
        step: 'salvando',
      }),
    ).toBe('O processamento foi interrompido antes de terminar.')
  })
})

describe('contentPieceTypeFromMime', () => {
  it('prefers the MIME family', () => {
    expect(contentPieceTypeFromMime('video/mp4', 'x.mp4')).toBe('video')
    expect(contentPieceTypeFromMime('audio/mpeg', 'x.mp3')).toBe('audio')
    expect(contentPieceTypeFromMime('text/plain', 'x.txt')).toBe('texto')
    expect(contentPieceTypeFromMime('image/png', 'x.png')).toBe('foto')
  })

  it('falls back to the extension when the OS sends no type', () => {
    expect(contentPieceTypeFromMime('', 'fala.mkv')).toBe('video')
    expect(contentPieceTypeFromMime(undefined, 'audio-grupo.wav')).toBe('audio')
    expect(contentPieceTypeFromMime(null, 'mensagem.md')).toBe('texto')
    expect(contentPieceTypeFromMime('', 'card-feira.jpg')).toBe('foto')
  })

  it('refuses what the catalogue does not read', () => {
    expect(contentPieceTypeFromMime('application/pdf', 'plano.pdf')).toBeNull()
    expect(contentPieceTypeFromMime('', 'arquivo.exe')).toBeNull()
    expect(contentPieceTypeFromMime(null, undefined)).toBeNull()
  })
})

describe('filename helpers', () => {
  it('derives a human title from the filename', () => {
    expect(contentPieceTitleFromFilename('fim-da_escala-6x1.mp4')).toBe('fim da escala 6x1')
    expect(contentPieceTitleFromFilename('C:\\midia\\card feira.png')).toBe('card feira')
    expect(contentPieceTitleFromFilename('.mp4')).toBe('Nova peça')
  })

  it('sanitizes the stored filename', () => {
    expect(sanitizeContentPieceFilename('../../etc/passwd')).toBe('passwd')
    expect(sanitizeContentPieceFilename('fala sus (1).mp4')).toBe('fala_sus_1_.mp4')
    expect(sanitizeContentPieceFilename('')).toBe('peca')
  })

  it('builds the slug base and its candidates', () => {
    expect(contentPieceSlugBase('Fim da escala 6×1 é saúde!')).toBe('fim-da-escala-6-1-e-saude')
    expect(contentPieceSlugCandidates('Fim da escala 6×1 é saúde!').slice(0, 3)).toEqual([
      'fim-da-escala-6-1-e-saude',
      'fim-da-escala-6-1-e-saude-2',
      'fim-da-escala-6-1-e-saude-3',
    ])
    expect(contentPieceSlugCandidates('!!!', 2)).toEqual(['peca', 'peca-2'])
  })
})

describe('content piece links', () => {
  it('canonicalizes Instagram forms and drops tracking', () => {
    expect(parseContentPieceLink('https://www.instagram.com/p/ABC123/?igsh=xyz')).toEqual({
      origin: 'instagram',
      shortcode: 'ABC123',
      canonicalUrl: 'https://www.instagram.com/p/ABC123/',
    })
    expect(parseContentPieceLink('https://instagram.com/reels/ABC123')).toEqual({
      origin: 'instagram',
      shortcode: 'ABC123',
      canonicalUrl: 'https://www.instagram.com/reel/ABC123/',
    })
    expect(parseContentPieceLink('https://m.instagram.com/tv/ABC123/')?.origin).toBe('instagram')
  })

  it('accepts the profile-prefixed spelling the browser copies', () => {
    expect(parseContentPieceLink('https://www.instagram.com/depjorgesolla/reel/ABC123/')).toEqual({
      origin: 'instagram',
      shortcode: 'ABC123',
      canonicalUrl: 'https://www.instagram.com/reel/ABC123/',
    })
    expect(
      parseContentPieceLink('https://m.instagram.com/depjorgesolla/p/ABC123/?igsh=xyz'),
    ).toEqual({
      origin: 'instagram',
      shortcode: 'ABC123',
      canonicalUrl: 'https://www.instagram.com/p/ABC123/',
    })
  })

  it('refuses stories and malformed prefixed paths', () => {
    expect(parseContentPieceLink('https://www.instagram.com/stories/depjorgesolla/123/')).toBeNull()
    expect(parseContentPieceLink('https://www.instagram.com/stories/reel/ABC123/')).toBeNull()
    expect(parseContentPieceLink('https://www.instagram.com/depjorgesolla/ABC123/')).toBeNull()
    expect(
      parseContentPieceLink('https://www.instagram.com/depjorgesolla/reel/ABC123/extra/'),
    ).toBeNull()
    expect(parseContentPieceLink('https://instagr.am/reel/ABC123/')).toBeNull()
  })

  it('canonicalizes YouTube forms to the watch URL', () => {
    expect(parseContentPieceLink('https://youtu.be/VIDEO1?t=10')).toEqual({
      origin: 'youtube',
      videoId: 'VIDEO1',
      canonicalUrl: 'https://www.youtube.com/watch?v=VIDEO1',
    })
    expect(parseContentPieceLink('https://www.youtube.com/shorts/VIDEO2')).toEqual({
      origin: 'youtube',
      videoId: 'VIDEO2',
      canonicalUrl: 'https://www.youtube.com/watch?v=VIDEO2',
    })
    const watch = parseContentPieceLink('https://www.youtube.com/watch?v=VIDEO3&utm_source=x')
    expect(watch?.origin === 'youtube' ? watch.videoId : null).toBe('VIDEO3')
  })

  it('refuses other hosts and malformed input', () => {
    expect(parseContentPieceLink('https://twitter.com/user/status/1')).toBeNull()
    expect(parseContentPieceLink('https://www.instagram.com/')).toBeNull()
    expect(parseContentPieceLink('https://www.instagram.com/p/')).toBeNull()
    expect(parseContentPieceLink('nao e link')).toBeNull()
    expect(parseContentPieceLink('')).toBeNull()
    expect(contentPieceOriginFromLink('https://youtu.be/VIDEO1')).toBe('youtube')
    expect(contentPieceOriginFromLink('https://example.com/x')).toBeNull()
  })

  it('gives a link a provisional title', () => {
    const instagram = parseContentPieceLink('https://www.instagram.com/reel/ABC/')!
    expect(contentPieceLinkTitle(instagram)).toBe('Instagram · ABC')
    const youtube = parseContentPieceLink('https://youtu.be/VID')!
    expect(contentPieceLinkTitle(youtube)).toBe('YouTube · VID')
  })
})

describe('contentPieceSearchText', () => {
  it('normalizes title, description, transcript, topics, city and institution', () => {
    expect(
      contentPieceSearchText({
        title: 'Fim da escala 6×1 é Saúde',
        description: 'Solla explica a jornada',
        transcript: 'A redução da jornada protege a saúde',
        institution: 'Câmara dos Deputados',
        topics: ['saude', 'economia-trabalho'],
        cityLabel: 'Feira de Santana',
      }),
    ).toBe(
      'fim da escala 6×1 e saude solla explica a jornada a reducao da jornada protege a saude camara dos deputados saude economia e trabalho feira de santana',
    )
  })

  it('is empty when nothing is filled', () => {
    expect(contentPieceSearchText({})).toBe('')
  })
})

describe('toContentPieceViewModel', () => {
  it('maps a ready piece and its links', () => {
    const viewModel = toContentPieceViewModel({
      id: 7,
      title: 'Fim da escala',
      type: 'video',
      status: 'publicado',
      processingStatus: 'pronto',
      step: null,
      origin: 'instagram',
      topics: ['saude'],
      cityLabel: 'Salvador — ZE 3',
      region: 'Metropolitana',
      durationSeconds: 134,
      pieceDate: '2026-09-01',
      publishedAt: '2026-09-02',
      error: null,
      media: { id: 11 },
    })

    expect(viewModel.title).toBe('Fim da escala')
    expect(viewModel.typeLabel).toBe('Vídeo')
    expect(viewModel.statusLabel).toBe('Publicado')
    expect(viewModel.processingLabel).toBe('Pronto')
    expect(viewModel.durationLabel).toBe('02:14')
    expect(viewModel.pieceDateLabel).toBe('01/09/2026')
    expect(viewModel.hasFile).toBe(true)
    expect(viewModel.fileHref).toBe('/campanha/comunicacao/conteudos/7/arquivo')
    expect(viewModel.retryHref).toBe('/campanha/comunicacao/conteudos/7/retry')
    expect(viewModel.detailHref).toBe('/campanha/comunicacao/conteudos/7')
    expect(viewModel.canRetry).toBe(false)
    expect(viewModel.failureMessage).toBeNull()
    expect(viewModel.topics).toEqual(['saude'])
  })

  it('normalizes unknown enum values fail-closed and maps a failure', () => {
    const viewModel = toContentPieceViewModel({
      id: 8,
      title: null,
      type: 'inexistente',
      status: null,
      processingStatus: null,
      step: 'inexistente',
      origin: null,
      error: 'boom',
      media: null,
    })

    expect(viewModel.title).toBe('Peça 8')
    expect(viewModel.type).toBe('foto')
    expect(viewModel.status).toBe('rascunho')
    expect(viewModel.processingStatus).toBe('falhou')
    expect(viewModel.step).toBeNull()
    expect(viewModel.hasFile).toBe(false)
    expect(viewModel.fileHref).toBeNull()
    expect(viewModel.canRetry).toBe(true)
    expect(viewModel.failureMessage).toBe('Não foi possível processar a peça.')
  })

  it('maps the peça-link reason and ignores an unknown one', () => {
    const withReason = toContentPieceViewModel({
      id: 9,
      processingStatus: 'pronto',
      origin: 'instagram',
      linkFailureReason: 'carrossel',
      media: null,
    })

    expect(withReason.linkFailureReason).toBe('carrossel')
    expect(withReason.linkFailureReasonLabel).toBe('Carrossel: sem arquivo único para baixar')
    expect(withReason.failureMessage).toBeNull()

    const unknown = toContentPieceViewModel({ id: 10, linkFailureReason: 'explodiu' })
    expect(unknown.linkFailureReason).toBeNull()
    expect(unknown.linkFailureReasonLabel).toBeNull()
  })
})

describe('content piece list URL', () => {
  it('parses, canonicalizes and drops exhaustive facets', () => {
    const state = parseContentPieceListParams({
      q: '  escala  ',
      type: ['video', 'foto', 'texto', 'audio', 'card'],
      status: ['rascunho'],
      processing: ['falhou'],
      page: '2',
    })
    expect(state).toEqual({
      page: 2,
      q: 'escala',
      statuses: ['rascunho'],
      processing: ['falhou'],
    })

    const resolved = resolveContentPieceListUrl({ type: ['video'], page: '1' })
    expect(resolved.state).toEqual({ page: 1, types: ['video'] })
    expect(resolved.href).toBe('/campanha/comunicacao/conteudos?type=video')
    expect(resolved.redirectHref).toBe('/campanha/comunicacao/conteudos?type=video')
  })

  it('ignores unknown tokens and keeps an empty URL canonical', () => {
    expect(parseContentPieceListParams({ type: ['nope'], page: '0' })).toEqual({ page: 1 })
    expect(resolveContentPieceListUrl({}).href).toBe('/campanha/comunicacao/conteudos')
  })

  it('builds the where from the term and the facets', () => {
    expect(buildContentPieceListWhere({ page: 1 })).toEqual({})
    expect(
      buildContentPieceListWhere({
        page: 1,
        q: 'Saúde',
        types: ['video'],
        statuses: ['publicado'],
        processing: ['falhou'],
      }),
    ).toEqual({
      and: [
        { searchText: { contains: 'saude' } },
        { type: { in: ['video'] } },
        { status: { in: ['publicado'] } },
        { processingStatus: { in: ['falhou'] } },
      ],
    })
    expect(buildContentPieceListWhere({ page: 1, q: 'x' })).toEqual({
      searchText: { contains: 'x' },
    })
  })
})
