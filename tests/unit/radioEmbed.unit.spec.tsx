import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { RadioEmbed } from '@/components/jingles/RadioEmbed'

const frame = () => document.querySelector<HTMLIFrameElement>('iframe')

afterEach(cleanup)

describe('RadioEmbed', () => {
  it('mounts the official player on the first render, without a click', () => {
    render(<RadioEmbed />)

    const mountedFrame = frame()
    expect(mountedFrame).not.toBeNull()
    expect(mountedFrame?.getAttribute('src')).toBe('https://zeno.fm/player/jorge-solla-1313/')
    expect(mountedFrame?.getAttribute('title')).toContain('Rádio Jorge Solla 1313')
    expect(mountedFrame?.getAttribute('allow')).toBe('autoplay')
  })

  it('does not defer the frame to the viewport', () => {
    render(<RadioEmbed />)

    expect(frame()?.hasAttribute('loading')).toBe(false)
  })

  it('labels the frame region and drops every facade affordance', () => {
    render(<RadioEmbed />)

    expect(screen.getByRole('article', { name: 'Player da Rádio Jorge Solla 1313' })).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.queryByText(/Ouvir a rádio/)).toBeNull()
    expect(screen.queryByText(/Abrir no Zeno/)).toBeNull()
    expect(screen.queryByText(/só é carregado depois do seu clique/)).toBeNull()
  })

  it('narrows and centers the frame only in the compact variant', () => {
    const { container, unmount } = render(<RadioEmbed compact />)

    expect(container.querySelector('[data-radio]')?.className).toContain('mx-auto')
    expect(container.querySelector('[data-radio]')?.className).toContain('max-w-[880px]')

    unmount()
    const full = render(<RadioEmbed />)

    expect(full.container.querySelector('[data-radio]')?.className).not.toContain('max-w-[880px]')
  })
})
