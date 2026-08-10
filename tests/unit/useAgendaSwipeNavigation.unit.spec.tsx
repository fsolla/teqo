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
  onSwipePreviewStart,
  onSwipePreviewEnd,
  onReady,
}: {
  enabled?: boolean
  blockRef?: MutableRefObject<boolean>
  onSwipe: (direction: 'next' | 'prev') => void
  onSwipePreviewStart?: (direction: 'next' | 'prev') => void
  onSwipePreviewEnd?: () => void
  onReady?: (suppressDateClickRef: MutableRefObject<boolean>) => void
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const internalBlockRef = useRef(false)
  const { suppressDateClickRef } = useAgendaSwipeNavigation({
    containerRef,
    enabled,
    blockRef: blockRef ?? internalBlockRef,
    onSwipe,
    onSwipePreviewStart,
    onSwipePreviewEnd,
  })
  if (onReady) onReady(suppressDateClickRef)
  return createElement('div', { ref: containerRef, 'data-testid': 'agenda' })
}
const agendaOf = (container: HTMLElement): HTMLElement => container.firstElementChild as HTMLElement

/** Dispatches a cancellable touchmove and returns the event for assertion. */
const touchMoveAt = (agenda: HTMLElement, x: number, y: number): Event => {
  const event = new Event('touchmove', { bubbles: true, cancelable: true })
  Object.defineProperty(event, 'touches', {
    value: [{ clientX: x, clientY: y }],
  })
  agenda.dispatchEvent(event)
  return event
}

const claim = (agenda: HTMLElement, fromX: number, toX: number, y = 100) => {
  // C110 — the claim lives in the non-passive touchmove: pointerdown, then a
  // touchmove past the 12px dead zone (dominance horizontal), then the
  // pointermove that keeps the transform fresh.
  fireEvent(agenda, pointerEvent('pointerdown', { clientX: fromX, clientY: y }))
  fireEvent.touchMove(agenda, { touches: [{ clientX: toX, clientY: y }] })
  fireEvent(window, pointerEvent('pointermove', { clientX: toX, clientY: y }))
}

const release = (_agenda: HTMLElement, x: number, y = 100) => {
  fireEvent(window, pointerEvent('pointerup', { clientX: x, clientY: y }))
}

const dragAndRelease = (container: HTMLElement, fromX: number, toX: number, y = 100) => {
  const agenda = agendaOf(container)
  claim(agenda, fromX, toX, y)
  release(agenda, toX, y)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('useAgendaSwipeNavigation', () => {
  it('commita o período seguinte ao soltar acima do limiar de 48px', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewStart = vi.fn()
    const onSwipePreviewEnd = vi.fn()
    const { container } = render(
      createElement(Harness, { onSwipe, onSwipePreviewStart, onSwipePreviewEnd }),
    )
    dragAndRelease(container as HTMLElement, 300, 100)
    expect(onSwipe).toHaveBeenCalledTimes(1)
    expect(onSwipe).toHaveBeenCalledWith('next')
    expect(onSwipePreviewStart).toHaveBeenCalledWith('next')
    expect(onSwipePreviewEnd).toHaveBeenCalledTimes(1)
  })

  it('commita o período anterior ao soltar à direita', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    dragAndRelease(container as HTMLElement, 100, 300)
    expect(onSwipe).toHaveBeenCalledWith('prev')
  })

  it('não navega abaixo do limiar: snap-back sem onSwipe', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewEnd = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe, onSwipePreviewEnd }))
    dragAndRelease(container as HTMLElement, 300, 260)
    expect(onSwipe).not.toHaveBeenCalled()
    expect(onSwipePreviewEnd).toHaveBeenCalledTimes(1)
  })

  it('não abre preview nem transforma o grid abaixo do claim de 12px', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewStart = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe, onSwipePreviewStart }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 291, clientY: 100 }] })
    fireEvent(window, pointerEvent('pointermove', { clientX: 291, clientY: 100 }))
    release(agenda, 291)
    expect(onSwipePreviewStart).not.toHaveBeenCalled()
    expect(onSwipe).not.toHaveBeenCalled()
    expect(agenda.style.transform).toBe('')
  })

  it('abre o preview e transforma o grid no claim; o grid segue o dedo', () => {
    const onSwipePreviewStart = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe: vi.fn(), onSwipePreviewStart }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 285, clientY: 100 }] })
    expect(onSwipePreviewStart).toHaveBeenCalledWith('next')
    expect(agenda.classList.contains('activity-agenda-swipe-dragging')).toBe(true)
    expect(agenda.style.transform).toBe('translateX(-15px)')
    // o dedo continua: o transform acompanha (200px de deslocamento total)
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    expect(agenda.style.transform).toBe('translateX(-200px)')
    release(agenda, 100)
  })

  it('preventDefault em todo touchmove claimado (segura o gesto do browser)', () => {
    const { container } = render(createElement(Harness, { onSwipe: vi.fn() }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    // o claim preventDefault o primeiro move horizontal
    const claimEvent = touchMoveAt(agenda, 285, 100)
    expect(claimEvent.defaultPrevented).toBe(true)
    // e CADA move seguinte também — o pan controller reavalia por move e um
    // move não-prevented dispara pointercancel real, matando o gesto vivo
    const nextMove = touchMoveAt(agenda, 200, 100)
    expect(nextMove.defaultPrevented).toBe(true)
    const lastMove = touchMoveAt(agenda, 150, 100)
    expect(lastMove.defaultPrevented).toBe(true)
    release(agenda, 150)
  })

  it('não preventDefault em touchmove vertical (o scroll nativo continua)', () => {
    const { container } = render(createElement(Harness, { onSwipe: vi.fn() }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    const verticalMove = touchMoveAt(agenda, 300, 180)
    expect(verticalMove.defaultPrevented).toBe(false)
  })

  it('trava a direção no claim: reverter não vira o preview nem cruza a origem', () => {
    const onSwipePreviewStart = vi.fn()
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe, onSwipePreviewStart }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 280, clientY: 100 }] })
    expect(onSwipePreviewStart).toHaveBeenCalledWith('next')
    // reversão para +100px: clamp na direção 'next' — o grid nunca cruza a origem
    fireEvent(window, pointerEvent('pointermove', { clientX: 400, clientY: 100 }))
    expect(agenda.style.transform).toBe('')
    // soltar em +100 não commita (deslocamento final é 0 no domínio travado)
    release(agenda, 400)
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('abandona e volta quando um gesto claimado vira vertical (dominância)', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewEnd = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe, onSwipePreviewEnd }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 280, clientY: 100 }] })
    expect(agenda.style.transform).toBe('translateX(-20px)')
    // vertical 3:1 sobre o horizontal — o scroll tomou o gesto
    fireEvent(window, pointerEvent('pointermove', { clientX: 280, clientY: 400 }))
    expect(onSwipe).not.toHaveBeenCalled()
    expect(onSwipePreviewEnd).toHaveBeenCalledTimes(1)
    expect(agenda.style.transform).toBe('')
    expect(agenda.classList.contains('activity-agenda-swipe-exit')).toBe(true)
  })

  it('não navega num arrasto diagonal antes do claim (dominância vertical)', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    fireEvent(
      container.firstElementChild as HTMLElement,
      pointerEvent('pointerdown', { clientX: 300, clientY: 100 }),
    )
    fireEvent(window, pointerEvent('pointermove', { clientX: 200, clientY: 180 }))
    expect(onSwipe).not.toHaveBeenCalled()
  })

  it('não commita no soltar se o deslocamento final virou vertical', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 250, clientY: 100 }] })
    // deslocamento final: dx=-50 (acima do limiar) mas dy=-80 (dominância vertical)
    fireEvent(window, pointerEvent('pointermove', { clientX: 250, clientY: 180 }))
    release(agenda, 250, 180)
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
    const onSwipePreviewStart = vi.fn()
    const { container } = render(
      createElement(Harness, { enabled: false, onSwipe, onSwipePreviewStart }),
    )
    dragAndRelease(container as HTMLElement, 300, 100)
    expect(onSwipe).not.toHaveBeenCalled()
    expect(onSwipePreviewStart).not.toHaveBeenCalled()
  })

  it('abandona o gesto quando o FullCalendar começa um drag de evento (blockRef)', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewEnd = vi.fn()
    const blockRef = { current: false }
    const { container } = render(createElement(Harness, { blockRef, onSwipe, onSwipePreviewEnd }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    // a flag vira true a meio do gesto (long-press do FC venceu)
    blockRef.current = true
    fireEvent(window, pointerEvent('pointermove', { clientX: 100, clientY: 100 }))
    expect(onSwipe).not.toHaveBeenCalled()
    expect(onSwipePreviewEnd).not.toHaveBeenCalled()
  })

  it('fecha o preview e volta no pointercancel depois do claim', () => {
    const onSwipe = vi.fn()
    const onSwipePreviewEnd = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe, onSwipePreviewEnd }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 250, clientY: 100 }] })
    // o browser tomou o gesto (scroll vertical): pointercancel
    fireEvent(window, pointerEvent('pointercancel', { clientX: 250, clientY: 180 }))
    expect(onSwipe).not.toHaveBeenCalled()
    expect(onSwipePreviewEnd).toHaveBeenCalledTimes(1)
    expect(agenda.style.transform).toBe('')
    // o swipe seguinte funciona normalmente
    dragAndRelease(container as HTMLElement, 300, 100)
    expect(onSwipe).toHaveBeenCalledWith('next')
  })

  it('marca suppressDateClickRef no claim (o swipe não abre o inline create)', () => {
    const onSwipe = vi.fn()
    let suppressDateClickRef: MutableRefObject<boolean> | undefined
    const { container } = render(
      createElement(Harness, { onSwipe, onReady: (ref) => (suppressDateClickRef = ref) }),
    )
    expect(suppressDateClickRef).toBeDefined()
    expect(suppressDateClickRef!.current).toBe(false)
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    // flick de 20px: cruza o claim (12px) mas não o limiar de navegação (48px)
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
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent.touchMove(agenda, { touches: [{ clientX: 280, clientY: 100 }] })
    expect(suppressDateClickRef!.current).toBe(true)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 200, clientY: 100 }))
    expect(suppressDateClickRef!.current).toBe(false)
  })

  it('aceita pen além de touch', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(
      agenda,
      pointerEvent('pointerdown', { pointerType: 'pen', clientX: 300, clientY: 100 }),
    )
    // pen gera touch events no Chrome — o claim vive no touchmove como no touch
    fireEvent.touchMove(agenda, { touches: [{ clientX: 280, clientY: 100 }] })
    fireEvent(
      window,
      pointerEvent('pointermove', { pointerType: 'pen', clientX: 100, clientY: 100 }),
    )
    release(agenda, 100)
    expect(onSwipe).toHaveBeenCalledWith('next')
  })

  it('reseta o gesto no pointercancel e aceita o próximo swipe', () => {
    const onSwipe = vi.fn()
    const { container } = render(createElement(Harness, { onSwipe }))
    const agenda = agendaOf(container as HTMLElement)
    fireEvent(agenda, pointerEvent('pointerdown', { clientX: 300, clientY: 100 }))
    fireEvent(window, pointerEvent('pointercancel', { clientX: 300, clientY: 180 }))
    dragAndRelease(container as HTMLElement, 300, 100)
    expect(onSwipe).toHaveBeenCalledWith('next')
  })
})
