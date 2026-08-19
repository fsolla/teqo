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
  it('apresenta a candidatura e mantém um único CTA primário', () => {
    render(<CampaignHero />)

    expect(screen.getByRole('heading', { level: 1, name: 'MAIS SAÚDE MAIS FUTURO' })).toBeTruthy()

    const supportLink = screen.getByRole('link', { name: /Quero apoiar/i })
    expect(supportLink.getAttribute('href')).toBe('https://apoiar.me/jorgesolla')
    expect(supportLink.getAttribute('data-cta')).toBe('primary')

    // S9 — the secondary CTA is the shortcut to the novidades capture; the
    // bandeiras stay reachable through the footer link and the success card.
    const novidadesLink = screen.getByRole('link', { name: /Receba novidades da campanha/i })
    expect(novidadesLink.getAttribute('href')).toBe('#novidades')
    expect(novidadesLink.getAttribute('data-cta')).toBe('secondary')
  })

  it('expõe as provas e as fotos com nomes acessíveis', () => {
    render(<CampaignHero />)

    expect(screen.getByLabelText('DIAP entre os 40 melhores da Câmara')).toBeTruthy()
    expect(screen.getByLabelText('Mais votado do PT-BA em 2022')).toBeTruthy()
    expect(screen.getByRole('img', { name: /Jorge Solla 1313/i })).toBeTruthy()
    expect(screen.getByAltText('Jorge Solla, candidato a deputado federal pela Bahia')).toBeTruthy()
  })
})
