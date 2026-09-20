import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { JingleHomeSection } from '@/components/jingles/JingleHomeSection'
import type { JingleViewModel } from '@/lib/jingle'

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

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

const jingle = (id: number, title: string): JingleViewModel => ({
  id,
  title,
  coverUrl: `/api/media/file/capa-${id}.jpg`,
  coverAlt: `Capa do jingle ${title} de Jorge Solla 1313`,
  audioUrl: `/api/media/file/${id}.mp3`,
  downloadFilename: `jorge-solla-1313-${id}.mp3`,
})

const THREE_JINGLES = [jingle(1, 'Axé'), jingle(2, 'Forró'), jingle(3, 'Pagodão')] as const
const cards = () => document.querySelectorAll('article[data-jingle]')

afterEach(cleanup)

describe('JingleHomeSection', () => {
  it('renders the radio alone with zero published jingles (fail-closed)', () => {
    render(<JingleHomeSection jingles={[]} showAll={false} />)

    expect(document.querySelector('[data-home-section="sound"]')).not.toBeNull()
    expect(document.querySelector('[data-radio][data-radio-state="facade"]')).not.toBeNull()
    expect(cards()).toHaveLength(0)
    expect(screen.queryByText('Jingles oficiais')).toBeNull()
    expect(screen.queryByRole('link', { name: /Ver todos os jingles/ })).toBeNull()
    expect(screen.getByRole('heading', { name: 'Sintonize com a Rádio 1313' })).toBeDefined()
  })

  it('renders one or two jingles without inventing content or "Ver todos"', () => {
    render(<JingleHomeSection jingles={[jingle(1, 'Axé')]} showAll={false} />)

    expect(cards()).toHaveLength(1)
    expect(screen.queryByRole('link', { name: /Ver todos os jingles/ })).toBeNull()
    expect(screen.getByText('Jingles oficiais')).toBeDefined()
  })

  it('renders the three shown jingles without "Ver todos" when the listing fits', () => {
    render(<JingleHomeSection jingles={THREE_JINGLES} showAll={false} />)

    expect(cards()).toHaveLength(3)
    expect(screen.getByRole('heading', { name: 'Cante, baixe e espalhe' })).toBeDefined()
    expect(screen.queryByRole('link', { name: /Ver todos os jingles/ })).toBeNull()
  })

  it('hands off to /jingles only when more than three are published', () => {
    render(<JingleHomeSection jingles={THREE_JINGLES} showAll />)

    const link = screen.getByRole('link', { name: /Ver todos os jingles/ })
    expect(link.getAttribute('href')).toBe('/jingles')
  })
})
