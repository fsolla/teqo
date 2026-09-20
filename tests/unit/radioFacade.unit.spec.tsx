import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { RadioFacade } from '@/components/jingles/RadioFacade'

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

const card = () => document.querySelector<HTMLElement>('[data-radio]')
const radioState = () => card()?.getAttribute('data-radio-state')
const frame = () => document.querySelector<HTMLIFrameElement>('iframe')

afterEach(cleanup)

describe('RadioFacade', () => {
  it('starts at the facade with no iframe, script or third-party request', () => {
    render(<RadioFacade />)

    expect(radioState()).toBe('facade')
    expect(frame()).toBeNull()
    expect(screen.getByRole('button', { name: 'Ouvir a rádio' })).toBeDefined()
    expect(
      screen.getByText(/O player do zeno\.fm só é carregado depois do seu clique/),
    ).toBeDefined()
  })

  it('keeps the external link as the always-available alternative', () => {
    render(<RadioFacade />)

    const link = screen.getByRole('link', { name: /Abrir no Zeno/ })
    expect(link.getAttribute('href')).toBe('https://zeno.fm/radio/jorge-solla-1313/')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('mounts the official player only on click and promotes to loaded on onLoad', () => {
    render(<RadioFacade />)

    fireEvent.click(screen.getByRole('button', { name: 'Ouvir a rádio' }))

    expect(radioState()).toBe('loading')
    const mountedFrame = frame()
    expect(mountedFrame).not.toBeNull()
    expect(mountedFrame?.getAttribute('src')).toBe('https://zeno.fm/player/jorge-solla-1313/')
    expect(mountedFrame?.getAttribute('title')).toContain('Rádio Jorge Solla 1313')
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
    expect(screen.getByRole('button', { name: 'Carregando…' }).hasAttribute('disabled')).toBe(true)

    fireEvent.load(mountedFrame as HTMLIFrameElement)

    expect(radioState()).toBe('loaded')
    expect(screen.queryByRole('status')).toBeNull()
    // The very same frame survives loading → loaded: the widget never refetches.
    expect(frame()).toBe(mountedFrame)
    expect(screen.getByText(/Player fornecido por zeno\.fm/)).toBeDefined()
  })
})
