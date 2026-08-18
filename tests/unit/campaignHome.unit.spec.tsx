import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import HomePage from '@/app/(frontend)/(home)/page'

type MockImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  fill?: boolean
  priority?: boolean
}

vi.mock('next/image', () => ({
  default: ({ alt, fill: _fill, priority: _priority, ...props }: MockImageProps) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} {...props} />
  ),
}))

// The content section is an async server component that reads posts through
// the Payload DB; the unit env has no database and an async child suspends the
// whole tree under testing-library. Its empty/full behavior is covered by e2e
// (frontend.e2e.spec.ts), so the home skeleton tests render it away.
vi.mock('@/components/CampaignContentSection', () => ({
  CampaignContentSection: () => null,
}))

afterEach(cleanup)

describe('Campaign home', () => {
  it('monta as quatro seções previstas e o rodapé eleitoral', async () => {
    render(await HomePage())

    expect(screen.getByRole('heading', { level: 1, name: 'MAIS SAÚDE MAIS FUTURO' })).toBeTruthy()
    expect(screen.getByText('3.333')).toBeTruthy()
    expect(screen.getByText('1.031')).toBeTruthy()
    expect(screen.getByText('3º')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /Eleger deputado é coisa séria/i })).toBeTruthy()
    expect(
      screen.getByRole('heading', {
        name: /Junto com o trabalhador e do lado de quem mais precisa, sempre/i,
      }),
    ).toBeTruthy()
    expect(screen.getByText(/CNPJ: 68\.430\.467\/0001-05/)).toBeTruthy()
  })

  it('usa exatamente as seis bandeiras aprovadas', async () => {
    render(await HomePage())

    // S6: cada bandeira aparece em duas renderizações irmãs (grade desktop e
    // carrossel mobile); o teste garante que as duas seguem a mesma copy.
    const expectedTitles = [
      'Defender o SUS e valorizar quem cuida',
      'Fim da escala 6×1 e jornada de 40h',
      'Educação em tempo integral e federais no interior',
      'Recomprar a Refinaria de Mataripe',
      'Salário mínimo forte, emprego e moradia',
      'Defesa intransigente da democracia',
    ]
    for (const title of expectedTitles) {
      expect(screen.getAllByText(title)).toHaveLength(2)
    }
  })
})
