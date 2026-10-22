import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignPageHeader } from '@/components/CampaignPageHeader'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }

vi.mock('next/image', () => ({
  default: ({ alt, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

afterEach(cleanup)

describe('CampaignPageHeader', () => {
  it('home: lockup negativo, nav Mandato/Bandeiras/Fotos e nenhum 1313', () => {
    render(<CampaignPageHeader variant="home" />)

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Mandato' }).getAttribute('href')).toBe('/artigos')
    expect(within(nav).getByRole('link', { name: 'Bandeiras' }).getAttribute('href')).toBe(
      '#bandeiras',
    )
    expect(within(nav).getByRole('link', { name: 'Fotos' }).getAttribute('href')).toBe('/fotos')
    expect(screen.getByAltText('Jorge Solla — Deputado Federal').getAttribute('src')).toContain(
      'jorge-solla-negativo.png',
    )
    expect(screen.queryByText(/1313/)).toBeNull()
  })

  it('interna: lockup positivo, nav com Início e marca a seção atual', () => {
    render(<CampaignPageHeader current="fotos" />)

    const nav = screen.getByRole('navigation', { name: 'Navegação principal' })
    expect(within(nav).getByRole('link', { name: 'Artigos' }).getAttribute('href')).toBe('/artigos')
    expect(within(nav).getByRole('link', { name: 'Fotos' }).getAttribute('aria-current')).toBe(
      'page',
    )
    expect(within(nav).getByRole('link', { name: 'Início' }).getAttribute('href')).toBe('/')
    expect(screen.getByAltText('Jorge Solla — Deputado Federal').getAttribute('src')).toContain(
      'jorge-solla-positivo.png',
    )
  })

  it('mostra o badge de estado quando recebido', () => {
    render(<CampaignPageHeader badge="Ao vivo" />)

    expect(screen.getByText('Ao vivo')).toBeTruthy()
  })
})
