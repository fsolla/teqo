import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignHero } from '@/components/CampaignHero'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }

vi.mock('next/image', () => ({
  default: ({ alt, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

afterEach(cleanup)

describe('CampaignHero', () => {
  it('agradece os 152.049 votos e mantém um único CTA primário', () => {
    render(<CampaignHero />)

    expect(
      screen.getByRole('heading', { level: 1, name: '152.049 votos de confiança' }),
    ).toBeTruthy()
    expect(screen.getByText('Obrigado, Bahia')).toBeTruthy()
    expect(
      screen.getByText(
        /Obrigado a quem votou, a quem caminhou, a quem compartilhou e a quem acreditou\./,
      ),
    ).toBeTruthy()

    const cta = screen.getByRole('link', { name: 'Acompanhe o mandato' })
    expect(cta.getAttribute('href')).toBe('/artigos')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('não exibe número eleitoral, pedido de voto nem a candidatura', () => {
    const { container } = render(<CampaignHero />)

    expect(container.textContent).not.toContain('1313')
    expect(container.textContent).not.toMatch(/Quero apoiar|candidato|propaganda eleitoral/i)
    expect(screen.queryByRole('link', { name: /Quero apoiar/i })).toBeNull()
  })

  it('serve o retrato oficial com alt contextual e WebP', () => {
    const { container } = render(<CampaignHero />)

    const portrait = screen.getByAltText('Jorge Solla sorrindo, com blazer azul e camisa do PT')
    expect(portrait.getAttribute('src')).toBe('/JOA00162.webp')

    const sources = Array.from(container.querySelectorAll('img'))
      .map((image) => image.getAttribute('src'))
      .filter((source): source is string => source !== null)
    expect(sources.length).toBeGreaterThan(0)
    for (const source of sources) {
      expect(source.endsWith('.webp'), source).toBe(true)
    }
  })
})
