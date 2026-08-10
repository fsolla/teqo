import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useRef, type MutableRefObject } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useAgendaSwipeNavigation } from '@/components/campaign/activity/useAgendaSwipeNavigation'

const pointerEvent = (
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  init: {
    pointerId?: number
    pointerType?: string
    isPrimary?: boolean
    clientX: number
    clientY: number
  },
) =>
  new PointerEvent(type, {
    pointerId: init.pointerId ?? 1,
    pointerType: init.pointerType ?? 'touch',
    isPrimary: init.isPrimary ?? true,
    bubbles: true,
    clientX: init.clientX,
    clientY: init.clientY,
  })

const Harness = ({
  enabled = true,
  blockRef,
  onSwipe,
  onReady,
}: {
  enabled?: boolean
  blockRef?: MutableRefObject<boolean>
  onSwipe: (direction: 'next' | 'prev') => void
  onReady?: (suppressDateClickRef: MutableRefObject<boolean>) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalBlockRef = useRef(false)
  const { suppressDateClickRef } = useAgendaSwipeNavigation({
    containerRef,
    enabled,
    blockRef: blockRef ?? internalBlockRef,
    onSwipe,
  })
  if (onReady) onReady(suppressDateClickRef)
  return createElement('div', { ref: containerRef, 'data-testid': 'agenda' })
}

const swipe = (container: HTMLElement, fromX: number, toX: number, y = 100) => {
  const agenda = container.firstElementChild as HTMLElement
  fireEvent(agenda, pointerEvent('pointerdown', { clientX: fromX, clientY: y }))
  fireEvent(window, pointerEvent('pointermove', { clientX: toX, clientY: y }))
  fireEvent(window, pointerEvent('pointerup', { clientX: toX, clientY: y }))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useAgendaSwipeNavigation', () => {
  it('navega para o período seguinte com um arrasto horizontal à esquerda', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    swipe(container as HTMLElement, 300, 100)
    expect(onSwipe).toHaveBeenCalledWith('next')
  })

  it('navega para o período anterior com um arrasto horizontal à direita', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    swipe(container as HTMLElement, 100, 300)
    expect(onSwipe).toHaveBeenCalledWith('prev')
  })

  it('não navega abaixo do limiar de 48px', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    swipe(container as HTMLElement, 300, 260)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('não navega num arrasto diagonal (dominância vertical)', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    fireEvent(
      container.firstElementChild as HTMLElement,
      pointerEvent('pointerdown', { clientX: 300, clientY: 100 }),
    )
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 180 }))
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('ignora mouse (a toolbar do desktop continua mandando)', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    fireEvent(
      container,
      pointerEvent('pointerdown', { pointerType: 'mouse', clientX: 300, clientY: 100 }),
    )
    fireEvent(
      window,
      pointerEvent('pointermove', { pointerType: 'mouse', clientX: 100, clientY: 100 }),
    )
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('não inicia gesto com enabled=false', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { enabled: false, onSwipe }))
    swipe(container as HTMLElement, 300, 100)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('abandona o gesto quando o FullCalendar começa um drag de evento (blockRef)', () => {
    const onSwipe = vi.fn()
    const blockRef = { current: false }
    const { container } = render(createElement(Harness, { blockRef, onSwipe }))
    fireEvent(
      container.firstElementChild as HTMLElement,
      pointerEvent('pointerdown', { clientX: 300, clientY: 100 }),
    )
    // a flag vira true a meio do gesto (long-press do FC venceu)
    blockRef.current = true
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('marca suppressDateClickRef no consumo (o swipe não abre o inline create)', () => {
    const onSwipe = vi.fn()
    let suppressDateClickRef: MutableRefObject<boolean> | undefined
    const { container } = render(
      createElement(Harness, { onSwipe, onReady: (ref) => (suppressDateClickRef = ref) }),
    )
    expect(suppressDateClickRef).toBeDefined()
    expect(suppressDateClickRef!.current).toBe(false)
    swipe(container as HTMLElement, 300, 100)
    expect(suppressDateClickRef!.current).toBe(true)
  })

  it('marca suppressDateClickRef já no claim de 12px (um flick sub-limiar não abre o inline create)', () => {
    const onSwipe = vi.fn()
    let suppressDateClickRef: MutableRefObject<boolean> | undefined
    const { container } = render(
      createElement(Harness, { onSwipe, onReady: (ref) => (suppressDateClickRef = ref) }),
    )
    const agenda = container.firstElementChild as HTMLElement
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    // flick de 20px: cruza o claim (12px) mas não o limiar de navegação
    // (48px) — o claim vive no touchmove não-passivo.
    fireEvent.touchMove(agenda, { touches: [{ clientX: 280, clientY: 100 }] })
    expect(onSwipe).not.toHaveBeenCalled()
    expect(suppressDateClickRef!.current).toBe(true)
  })

  it('limpa suppressDateClickRef no próximo pointerdown (o tap genuíno continua abrindo o create)', () => {
    const onSwipe = vi.fn()
    let suppressDateClickRef: MutableRefObject<boolean> | undefined
    const { container } = render(
      createElement(Harness, { onSwipe, onReady: (ref) => (suppressDateClickRef = ref) }),
    )
    const agenda = container.firstElementChild as HTMLElement
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    expect(suppressDateClickRef!.current).toBe(true)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 200, clientY: 100 }))
    expect(suppressDateClickRef!.current).toBe(false)
  })

  it('aceita pen além de touch', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    const agenda = container.firstElementChild as HTMLElement
    fireEvent(
      agenda,
      pointerEvent('pointerdown', { pointerType: 'pen', clientX: 300, clientY: 100 }),
    )
    fireEvent(
      window,
      pointerEvent('pointermove', { pointerType: 'pen', clientX: 100, clientY: 100 }),
    )
    expect(onSwipe).toHaveBeenCalledWith('next')
  })

  it('reseta o gesto no pointercancel e aceita o próximo swipe', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    const agenda = container.firstElementChild as HTMLElement
    // o browser tomou o gesto (scroll vertical): pointercancel
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent(window, pointerEvent('pointercancel', { clientX: 300, clientY: 180 }))
    // o swipe seguinte funciona normalmente
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    expect(onSwipe).toHaveBeenCalledWith('next')
  })
})
