import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ContentPieceHomeFilterRow } from '@/components/conteudos/ContentPieceHomeFilterRow'

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const facets = {
  tipo: [
    { value: 'video', label: 'Vídeo' },
    { value: 'foto', label: 'Foto' },
  ],
  cidade: [{ value: 'salvador', label: 'Salvador' }],
  regiao: [],
}

describe('ContentPieceHomeFilterRow', () => {
  it('renders only the facets with options and links each option to the canonical filtered URL', () => {
    render(<ContentPieceHomeFilterRow facets={facets} />)

    expect(screen.getByText('Tipo')).toBeDefined()
    expect(screen.getByText('Cidade')).toBeDefined()
    // A facet no published piece carries never renders — no empty menu.
    expect(screen.queryByText('Região')).toBeNull()

    const tipo = screen.getByText('Tipo').closest('details') as HTMLElement
    fireEvent.click(within(tipo).getByText('Tipo'))
    expect(within(tipo).getByRole('link', { name: 'Vídeo' }).getAttribute('href')).toBe(
      '/conteudos?tipo=video',
    )

    const cidade = screen.getByText('Cidade').closest('details') as HTMLElement
    fireEvent.click(within(cidade).getByText('Cidade'))
    expect(
      within(cidade)
        .getByRole('link', { name: /Salvador/ })
        .getAttribute('href'),
    ).toBe('/conteudos?cidade=salvador')
  })

  it('renders nothing without any option', () => {
    const { container } = render(
      <ContentPieceHomeFilterRow facets={{ tipo: [], cidade: [], regiao: [] }} />,
    )

    expect(container.firstChild).toBeNull()
  })
})
