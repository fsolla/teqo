import { cleanup, fireEvent, render } from '@testing-library/react'
import { createElement, useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  agendaKeyboardDirection,
  useAgendaKeyboardNavigation,
} from '@/components/campaign/activity/useAgendaKeyboardNavigation'

const keyEvent = (
  key: string,
  init: {
    target?: EventTarget | null
    altKey?: boolean
    ctrlKey?: boolean
    metaKey?: boolean
  } = {},
) => ({
  key,
  altKey: init.altKey ?? false,
  ctrlKey: init.ctrlKey ?? false,
  metaKey: init.metaKey ?? false,
  target: init.target ?? null,
})

const Harness = ({
  enabled = true,
  onNavigate,
  withChild = false,
}: {
  enabled?: boolean
  onNavigate: (direction: 'next' | 'prev') => void
  /** Simulates the grid content inside the region (date cells / event anchors). */
  withChild?: boolean
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const { handleKeyDown } = useAgendaKeyboardNavigation({
    containerRef,
    enabled,
    onNavigate,
  })
  return createElement(
    'div',
    {
      ref: containerRef,
      tabIndex: 0,
      onKeyDown: handleKeyDown,
      'data-testid': 'agenda',
    },
    withChild ? createElement('button', { 'data-testid': 'cell' }, 'célula') : null,
  )
}

const pressKey = (container: HTMLElement, key: string) => {
  const agenda = container.firstElementChild as HTMLElement
  fireEvent.keyDown(agenda, { key })
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('agendaKeyboardDirection', () => {
  it('mapeia ArrowRight para o período seguinte', () => {
    expect(agendaKeyboardDirection(keyEvent('ArrowRight'))).toBe('next')
  })

  it('mapeia ArrowLeft para o período anterior', () => {
    expect(agendaKeyboardDirection(keyEvent('ArrowLeft'))).toBe('prev')
  })

  it('ignora teclas que não são setas de período', () => {
    expect(agendaKeyboardDirection(keyEvent('ArrowUp'))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowDown'))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('Home'))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('Enter'))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('a'))).toBeNull()
  })

  it('não sequestra atalhos com modificador (Alt/Ctrl/Meta)', () => {
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { altKey: true }))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { ctrlKey: true }))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { metaKey: true }))).toBeNull()
  })

  it('ignora setas dentro do more-popover do FullCalendar (role=dialog)', () => {
    const dialog = document.createElement('div')
    dialog.setAttribute('role', 'dialog')
    const cell = document.createElement('button')
    dialog.appendChild(cell)
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { target: cell }))).toBeNull()
  })

  it('ignora setas dentro de menus (o menu do seletor de vista tem setas próprias)', () => {
    const menu = document.createElement('nav')
    menu.setAttribute('role', 'menu')
    const item = document.createElement('a')
    menu.appendChild(item)
    expect(agendaKeyboardDirection(keyEvent('ArrowLeft', { target: item }))).toBeNull()
  })

  it('ignora setas em controles de formulário (defensivo)', () => {
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    const select = document.createElement('select')
    // jsdom não implementa isContentEditable (sempre false) — simula o
    // elemento editável para pinar o ramo defensivo.
    const contentEditable = document.createElement('div')
    Object.defineProperty(contentEditable, 'isContentEditable', { value: true })
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { target: input }))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { target: textarea }))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { target: select }))).toBeNull()
    expect(agendaKeyboardDirection(keyEvent('ArrowRight', { target: contentEditable }))).toBeNull()
  })

  it('aceita alvos fora do DOM (target null ou não-Element)', () => {
    expect(agendaKeyboardDirection(keyEvent('ArrowRight'))).toBe('next')
    const text = document.createTextNode('x')
    expect(agendaKeyboardDirection(keyEvent('ArrowLeft', { target: text }))).toBe('prev')
  })
})

describe('useAgendaKeyboardNavigation', () => {
  it('navega para o período seguinte com ArrowRight', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { onNavigate }))
    pressKey(container as HTMLElement, 'ArrowRight')
    expect(onNavigate).toHaveBeenCalledWith('next')
  })

  it('navega para o período anterior com ArrowLeft', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { onNavigate }))
    pressKey(container as HTMLElement, 'ArrowLeft')
    expect(onNavigate).toHaveBeenCalledWith('prev')
  })

  it('não navega com enabled=false (desktop mantém a toolbar)', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { enabled: false, onNavigate }))
    pressKey(container as HTMLElement, 'ArrowRight')
    pressKey(container as HTMLElement, 'ArrowLeft')
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('bloqueia o scroll nativo da seta quando navega', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { onNavigate }))
    const agenda = container.firstElementChild as HTMLElement
    // fireEvent retorna o valor de dispatchEvent: false quando preventDefault
    // foi chamado (o default da seta — scroll — é cancelado).
    const dispatched = fireEvent.keyDown(agenda, { key: 'ArrowRight' })
    expect(dispatched).toBe(false)
    expect(onNavigate).toHaveBeenCalled()
  })

  it('não impede o default de teclas que não navegam', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { onNavigate }))
    const agenda = container.firstElementChild as HTMLElement
    const dispatched = fireEvent.keyDown(agenda, { key: 'ArrowUp' })
    expect(dispatched).toBe(true)
    expect(onNavigate).not.toHaveBeenCalled()
  })

  it('restaura o foco na região quando a troca de período destrói o nó focado', () => {
    const onNavigate = vi.fn()
    const { container } = render(createElement(Harness, { onNavigate, withChild: true }))
    const agenda = container.firstElementChild as HTMLElement
    const cell = agenda.querySelector('[data-testid="cell"]') as HTMLElement
    cell.focus()
    expect(document.activeElement).toBe(cell)
    // A troca de período re-renderiza o grid e destrói o nó focado (âncora
    // de evento / célula): o handler já levou o foco para a região, então a
    // destruição do filho não derruba o teclado no body.
    fireEvent.keyDown(cell, { key: 'ArrowRight' })
    expect(document.activeElement).toBe(agenda)
    cell.remove()
    expect(document.activeElement).toBe(agenda)
  })
})
