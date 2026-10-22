import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CampaignFooter } from '@/components/CampaignFooter'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & { priority?: boolean }

vi.mock('next/image', () => ({
  default: ({ alt, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

afterEach(cleanup)

describe('CampaignFooter', () => {
  it('é institucional: navegação, redes e assinatura, sem bloco eleitoral', () => {
    const { container } = render(<CampaignFooter current="artigos" />)

    expect(screen.getByRole('link', { name: 'Artigos' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Fotos' }).getAttribute('href')).toBe('/fotos')
    expect(screen.getByRole('link', { name: 'Privacidade' }).getAttribute('href')).toBe(
      '/privacidade',
    )
    expect(screen.getByRole('link', { name: 'Instagram' }).getAttribute('href')).toBe(
      'https://instagram.com/depjorgesolla',
    )
    expect(screen.getByRole('link', { name: 'YouTube' }).getAttribute('href')).toBe(
      'https://youtube.com/@JorgeSollaDep',
    )
    expect(screen.getByRole('link', { name: 'Facebook' }).getAttribute('href')).toBe(
      'https://facebook.com/depjorgesolla',
    )
    expect(screen.getByText(/Deputado Federal · PT · Bahia/)).toBeTruthy()
    expect(screen.getByText('Mais Saúde, Mais Futuro.')).toBeTruthy()

    expect(container.textContent).not.toContain('1313')
    expect(container.textContent).not.toMatch(/CNPJ|1º turno|Quero apoiar|propaganda eleitoral/i)
  })

  it('marca Fotos como seção atual quando pedido', () => {
    render(<CampaignFooter current="fotos" />)

    expect(screen.getByRole('link', { name: 'Fotos' }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('link', { name: 'Artigos' }).getAttribute('aria-current')).toBeNull()
  })
})
