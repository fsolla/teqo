import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { AppRouterContext } from 'next/dist/shared/lib/app-router-context.shared-runtime'

import { SpeechResultCard } from '@/components/campaign/speech/SpeechResultCard'
import { WebSpeechResultCard } from '@/components/campaign/speech/WebSpeechResultCard'
import type { SpeechHighlightedExcerpt } from '@/lib/speechHighlight'
import type {
  SpeechListItemViewModel,
  WebSpeechListItemViewModel,
} from '@/utilities/speech/speechViewModels'

import { stub } from '../helpers/stub'

const mockAppRouter = stub<Parameters<typeof AppRouterContext.Provider>[0]['value']>({
  push: () => {},
  replace: () => {},
  refresh: () => {},
  forward: () => {},
  back: () => {},
  prefetch: () => Promise.resolve(),
})

const renderWithAppRouter = (element: Parameters<typeof renderToStaticMarkup>[0]) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: mockAppRouter }, element))

const excerpt = (overrides: Partial<SpeechHighlightedExcerpt> = {}): SpeechHighlightedExcerpt => ({
  parts: [
    { text: 'um trecho sobre ', highlighted: false },
    { text: 'saúde', highlighted: true },
  ],
  truncatedStart: true,
  truncatedEnd: true,
  ...overrides,
})

const speech = (overrides: Partial<SpeechListItemViewModel> = {}): SpeechListItemViewModel => ({
  id: 1,
  speechAtLabel: '11/08/2026',
  type: 'Discurso',
  durationLabel: '2min',
  presidingOfficer: null,
  excerpt: excerpt(),
  matchKind: 'segment',
  topics: [
    { value: 'saude', label: 'Saúde' },
    { value: 'educacao', label: 'Educação' },
    { value: 'cultura', label: 'Cultura' },
    { value: 'esporte', label: 'Esporte' },
  ],
  scopes: [
    { value: 'bahia', label: 'Bahia' },
    { value: 'brasil', label: 'Brasil' },
    { value: 'internacional', label: 'Internacional' },
  ],
  keywords: ['sus', 'vacina', 'atenção básica', 'orçamento'],
  municipalities: [],
  thumbnailUrl: null,
  watchHref: '/campanha/comunicacao/acervo/1',
  officialTextUrl: null,
  cuts: [],
  matchedTextSearch: true,
  themeMatchTerm: null,
  ...overrides,
})

const webSpeech = (
  overrides: Partial<WebSpeechListItemViewModel> = {},
): WebSpeechListItemViewModel => ({
  id: 9,
  title: 'Fala na internet',
  platform: { value: 'youtube', label: 'YouTube' },
  dateLabel: '12/09/2026',
  durationLabel: '5min',
  excerpt: excerpt(),
  topics: [
    { value: 'saude', label: 'Saúde' },
    { value: 'educacao', label: 'Educação' },
    { value: 'cultura', label: 'Cultura' },
    { value: 'esporte', label: 'Esporte' },
  ],
  scopes: [
    { value: 'bahia', label: 'Bahia' },
    { value: 'brasil', label: 'Brasil' },
    { value: 'internacional', label: 'Internacional' },
  ],
  thumbnailUrl: null,
  watchHref: '/campanha/comunicacao/acervo/internet/9',
  ...overrides,
})

describe('speech result cards excerpt', () => {
  it('renders the truncated excerpt with the highlighted part', () => {
    const html = renderWithAppRouter(createElement(SpeechResultCard, { speech: speech() }))

    expect(html).toContain('text-sm leading-relaxed text-foreground/90')
    expect(html).toContain('… ')
    expect(html).toContain(' …')
    expect(html).toContain('<mark')
    expect(html).toContain('saúde')
  })

  it('omits the excerpt when there is nothing to show', () => {
    const html = renderWithAppRouter(
      createElement(SpeechResultCard, {
        speech: speech({
          excerpt: { parts: [], truncatedStart: false, truncatedEnd: false },
        }),
      }),
    )

    expect(html).not.toContain('um trecho sobre')
    expect(html).not.toContain('text-sm leading-relaxed')
  })

  it('wraps the theme provenance excerpt in quotes', () => {
    const html = renderWithAppRouter(
      createElement(SpeechResultCard, { speech: speech({ themeMatchTerm: 'saúde' }) }),
    )

    expect(html).toContain('Por que apareceu')
    expect(html).toContain('“')
    expect(html).toContain('”')
    // The provenance replaces the common excerpt — they never coexist (C192).
    expect(html).not.toContain('text-sm leading-relaxed')
  })

  it('keeps the web card own excerpt classes', () => {
    const html = renderWithAppRouter(createElement(WebSpeechResultCard, { speech: webSpeech() }))

    expect(html).toContain('mt-2 text-sm leading-6 text-foreground/90')
  })
})

describe('speech result cards chips', () => {
  it('caps each group and sums every hidden chip on the Câmara card', () => {
    const html = renderWithAppRouter(createElement(SpeechResultCard, { speech: speech() }))

    expect(html).toContain('Saúde')
    expect(html).toContain('Bahia')
    expect(html).toContain('sus')
    expect(html).not.toContain('Esporte')
    expect(html).not.toContain('Internacional')
    expect(html).not.toContain('orçamento')
    expect(html).toContain('+3')
  })

  it('sums only the groups the web card has', () => {
    const html = renderWithAppRouter(createElement(WebSpeechResultCard, { speech: webSpeech() }))

    expect(html).toContain('Saúde')
    expect(html).toContain('Bahia')
    expect(html).not.toContain('Esporte')
    expect(html).not.toContain('Internacional')
    expect(html).toContain('+2')
    expect(html).not.toContain('sus')
  })

  it('omits the +N badge when every chip fits', () => {
    const html = renderWithAppRouter(
      createElement(SpeechResultCard, {
        speech: speech({
          topics: [{ value: 'saude', label: 'Saúde' }],
          scopes: [{ value: 'bahia', label: 'Bahia' }],
          keywords: [],
        }),
      }),
    )

    expect(html).not.toMatch(/\+\d/)
  })
})
