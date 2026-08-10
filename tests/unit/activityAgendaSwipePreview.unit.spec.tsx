import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ActivityAgendaSwipePreview } from '@/components/campaign/activity/ActivityAgendaSwipePreview'
import type { ActivityAgendaEvent } from '@/utilities/activityViewModels'

afterEach(() => {
  cleanup()
})

const event = (overrides: Partial<ActivityAgendaEvent> = {}): ActivityAgendaEvent => ({
  id: 1,
  title: 'Caminhada',
  href: '/campanha/atividades/caminhada',
  tags: [],
  status: 'confirmado',
  deputyPresent: false,
  allDay: false,
  startAt: '2026-08-10T09:00:00-03:00',
  endAt: null,
  municipality: null,
  locality: null,
  canReschedule: true,
  ...overrides,
})

const range = {
  start: '2026-08-03T00:00:00-03:00',
  end: '2026-08-10T00:00:00-03:00',
  anchorDate: '2026-08-03T00:00:00-03:00',
}

describe('ActivityAgendaSwipePreview', () => {
  it('ancora os dots do mês dentro da cena posicionada junto ao frame (C110+)', () => {
    const { container } = render(
      <ActivityAgendaSwipePreview view="month" direction="next" range={range} events={[event()]} />,
    )

    const scene = container.querySelector('.activity-agenda-swipe-scene')
    expect(scene).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-frame')).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-dot')).not.toBeNull()
  })

  it('ancora as barras de dia dentro da cena posicionada junto ao frame (C110+)', () => {
    const { container } = render(
      <ActivityAgendaSwipePreview view="day" direction="next" range={range} events={[event()]} />,
    )

    const scene = container.querySelector('.activity-agenda-swipe-scene')
    expect(scene).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-frame')).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-event')).not.toBeNull()
  })

  it('mantém o cabeçalho de iniciais na semana dentro da cena (C110+)', () => {
    const { container } = render(
      <ActivityAgendaSwipePreview view="week" direction="next" range={range} events={[event()]} />,
    )

    const scene = container.querySelector('.activity-agenda-swipe-scene')
    expect(scene).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-frame-head')).not.toBeNull()
    expect(scene!.querySelector('.activity-agenda-swipe-event')).not.toBeNull()
  })

  it('deixa as linhas da lista no fluxo do conteúdo, fora da cena (C110+)', () => {
    const { container } = render(
      <ActivityAgendaSwipePreview view="list" direction="next" range={range} events={[event()]} />,
    )

    expect(container.querySelector('.activity-agenda-swipe-scene')).toBeNull()
    const row = container.querySelector('.activity-agenda-swipe-list-row')
    expect(row).not.toBeNull()
    expect(row!.textContent).toContain('Caminhada')
  })

  it('não desenha dot para evento fora do range de 42 dias do mês', () => {
    const { container } = render(
      <ActivityAgendaSwipePreview
        view="month"
        direction="next"
        range={range}
        events={[event({ startAt: '2026-10-01T09:00:00-03:00' })]}
      />,
    )

    expect(container.querySelector('.activity-agenda-swipe-dot')).toBeNull()
  })

  it('aponta o chevron para o lado revelado: direita no próximo, esquerda no anterior', () => {
    const { container: nextContainer } = render(
      <ActivityAgendaSwipePreview view="month" direction="next" range={range} events={[]} />,
    )
    expect(nextContainer.querySelector('svg.lucide-chevron-right')).not.toBeNull()
    expect(nextContainer.querySelector('svg.lucide-chevron-left')).toBeNull()

    const { container: prevContainer } = render(
      <ActivityAgendaSwipePreview view="month" direction="prev" range={range} events={[]} />,
    )
    expect(prevContainer.querySelector('svg.lucide-chevron-left')).not.toBeNull()
    expect(prevContainer.querySelector('svg.lucide-chevron-right')).toBeNull()
  })
})
