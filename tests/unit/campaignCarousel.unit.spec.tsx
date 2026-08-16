import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampaignCarousel, type CampaignCarouselItem } from '@/components/CampaignCarousel'

const flagItems: CampaignCarouselItem[] = [
  {
    id: 'saude',
    label: 'Saúde',
    title: 'Defender o SUS e valorizar quem cuida',
    body: 'Saúde é direito, não mercadoria.',
  },
  {
    id: 'educacao',
    label: 'Educação',
    title: 'Educação em tempo integral',
    body: 'O interior não pode ficar para trás.',
  },
]

const problemItems: CampaignCarouselItem[] = [
  {
    id: 'trabalho',
    title: 'Pelo fim da escala 6x1!',
    body: 'Descanso é saúde pública.',
    image: '/fundo.avif',
    imageAlt: 'Jorge Solla durante atividade parlamentar',
  },
  {
    id: 'sus',
    title: 'Pra valorizar o SUS',
    body: 'O SUS é o sistema de saúde de todo brasileiro.',
    image: '/53569851134_02afc18fb4_o.avif',
    imageAlt: 'Jorge Solla em agenda de defesa do SUS',
  },
]

const matchMediaMock = vi.fn()
const scrollToMock = vi.fn()

beforeEach(() => {
  matchMediaMock.mockImplementation((query: string) => ({
    matches: false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  vi.stubGlobal('matchMedia', matchMediaMock)
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: scrollToMock,
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('CampaignCarousel', () => {
  it('sincroniza o chip ativo quando a pessoa escolhe uma bandeira', () => {
    render(<CampaignCarousel ariaLabel="Bandeiras da campanha" items={flagItems} variant="flags" />)

    const healthChip = screen.getByRole('button', { name: 'Saúde' })
    const educationChip = screen.getByRole('button', { name: 'Educação' })
    expect(healthChip.getAttribute('aria-current')).toBe('true')

    fireEvent.click(educationChip)
    fireEvent.scroll(screen.getByRole('list'))

    expect(healthChip.getAttribute('aria-current')).toBeNull()
    expect(educationChip.getAttribute('aria-current')).toBe('true')
    expect(scrollToMock).toHaveBeenCalledTimes(1)
  })

  it('avança automaticamente para o próximo card depois de quatro segundos', () => {
    vi.useFakeTimers()
    render(
      <CampaignCarousel
        ariaLabel="Por que essa eleição importa"
        items={problemItems}
        variant="problem"
      />,
    )

    const secondCard = screen.getByRole('listitem', { name: '2 de 2' })
    expect(secondCard.getAttribute('aria-current')).toBeNull()

    act(() => {
      vi.advanceTimersByTime(4_000)
    })

    expect(secondCard.getAttribute('aria-current')).toBe('true')
    expect(scrollToMock).toHaveBeenCalledTimes(1)
  })

  it('pausa o avanço enquanto o ponteiro está sobre o carrossel', () => {
    vi.useFakeTimers()
    render(
      <CampaignCarousel
        ariaLabel="Por que essa eleição importa"
        items={problemItems}
        variant="problem"
      />,
    )

    const carousel = screen.getByRole('region', { name: 'Por que essa eleição importa' })
    fireEvent.mouseEnter(carousel)
    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(screen.getByRole('listitem', { name: '1 de 2' }).getAttribute('aria-current')).toBe(
      'true',
    )
    expect(scrollToMock).not.toHaveBeenCalled()
  })

  it('pausa o avanço quando o próprio carrossel recebe foco', () => {
    vi.useFakeTimers()
    render(
      <CampaignCarousel
        ariaLabel="Por que essa eleição importa"
        items={problemItems}
        variant="problem"
      />,
    )

    const carousel = screen.getByRole('region', { name: 'Por que essa eleição importa' })
    fireEvent.focus(carousel)
    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(scrollToMock).not.toHaveBeenCalled()
  })

  it('não inicia o avanço automático quando a pessoa prefere movimento reduzido', () => {
    vi.useFakeTimers()
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))

    render(
      <CampaignCarousel
        ariaLabel="Por que essa eleição importa"
        items={problemItems}
        variant="problem"
      />,
    )
    act(() => {
      vi.advanceTimersByTime(8_000)
    })

    expect(scrollToMock).not.toHaveBeenCalled()
  })
})
