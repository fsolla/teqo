import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { createElement, useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

import {
  CampaignHeaderFilterPopover,
  type CampaignHeaderFilterRow,
} from '@/components/campaign/shared/CampaignHeaderFilterPopover'

afterEach(cleanup)

const labelsInOrder = (nav: HTMLElement) =>
  within(nav)
    .getAllByRole('link')
    .map((link) => link.textContent?.trim() ?? '')

const multiRows = (selected: ReadonlySet<string>): CampaignHeaderFilterRow[] =>
  [
    { value: 'a', label: 'Alpha' },
    { value: 'b', label: 'Beta' },
    { value: 'c', label: 'Charlie' },
    { value: 'd', label: 'Delta' },
    { value: 'e', label: 'Echo' },
    { value: 'f', label: 'Foxtrot' },
    { value: 'g', label: 'Golf' },
    { value: 'h', label: 'Hotel' },
  ].map((option) => ({
    ...option,
    href: `/campanha/municipios?region=${option.value}`,
    selected: selected.has(option.value),
    checkbox: true,
    onChoose: () => undefined,
  }))

const singleRows = (selected: string | null): CampaignHeaderFilterRow[] => [
  {
    value: '',
    label: 'Todas',
    href: '/campanha/municipios',
    selected: selected === null,
    onChoose: () => undefined,
  },
  {
    value: 'municipio',
    label: 'Município',
    href: '/campanha/municipios?kind=municipio',
    selected: selected === 'municipio',
    onChoose: () => undefined,
  },
  {
    value: 'zona',
    label: 'Zona eleitoral',
    href: '/campanha/municipios?kind=zona',
    selected: selected === 'zona',
    onChoose: () => undefined,
  },
]

const openFilter = (label = 'Território') => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`Filtrar.*${label}`) }))
}

const optionNav = () => screen.getByRole('navigation', { name: 'Território' })

/** Popover + external button that replaces the selected set (simulates parent re-render). */
const SnapshotHarness = ({
  initialSelected,
  nextSelected,
  buttonLabel,
}: {
  initialSelected: ReadonlySet<string>
  nextSelected: ReadonlySet<string>
  buttonLabel: string
}) => {
  const [selected, setSelected] = useState(() => new Set(initialSelected))
  return createElement(
    'div',
    null,
    createElement(CampaignHeaderFilterPopover, {
      id: 'filter-region',
      label: 'Território',
      active: true,
      optionRows: multiRows(selected),
    }),
    createElement(
      'button',
      {
        type: 'button',
        onClick: () => setSelected(new Set(nextSelected)),
      },
      buttonLabel,
    ),
  )
}

describe('CampaignHeaderFilterPopover selected-first ordering', () => {
  it('lifts selected options to the top when the popover opens', () => {
    render(
      createElement(CampaignHeaderFilterPopover, {
        id: 'filter-region',
        label: 'Território',
        active: true,
        optionRows: multiRows(new Set(['c', 'a'])),
      }),
    )

    openFilter()

    expect(labelsInOrder(optionNav())).toEqual([
      'Alpha',
      'Charlie',
      'Beta',
      'Delta',
      'Echo',
      'Foxtrot',
      'Golf',
      'Hotel',
    ])
  })

  it('freezes order while open when the parent re-renders with a new selection', () => {
    render(
      createElement(SnapshotHarness, {
        initialSelected: new Set(['c', 'a']),
        nextSelected: new Set(['a']),
        buttonLabel: 'Drop Charlie',
      }),
    )
    openFilter()

    expect(labelsInOrder(optionNav()).slice(0, 2)).toEqual(['Alpha', 'Charlie'])

    fireEvent.click(screen.getByRole('button', { name: 'Drop Charlie' }))

    // Snapshot still has both — Charlie stays at the top even though unchecked.
    expect(labelsInOrder(optionNav()).slice(0, 2)).toEqual(['Alpha', 'Charlie'])
    expect(screen.getByRole('link', { name: 'Charlie' }).getAttribute('aria-current')).toBeNull()
    expect(screen.getByRole('link', { name: 'Alpha' }).getAttribute('aria-current')).toBe('true')
  })

  it('regroups on the next open after closing', () => {
    render(
      createElement(SnapshotHarness, {
        initialSelected: new Set(['c', 'a']),
        nextSelected: new Set(['d']),
        buttonLabel: 'Select Delta only',
      }),
    )
    openFilter()
    // Close via the trigger (Radix toggles).
    openFilter()

    fireEvent.click(screen.getByRole('button', { name: 'Select Delta only' }))
    openFilter()

    expect(labelsInOrder(optionNav())[0]).toBe('Delta')
  })

  it('keeps selected-first order among search matches', () => {
    render(
      createElement(CampaignHeaderFilterPopover, {
        id: 'filter-region',
        label: 'Território',
        active: true,
        optionRows: multiRows(new Set(['h', 'f'])),
      }),
    )

    openFilter()
    fireEvent.change(screen.getByRole('textbox', { name: 'Buscar em Território' }), {
      target: { value: 'o' },
    })

    // Echo / Foxtrot / Golf / Hotel match "o"; selected (Hotel, Foxtrot) first.
    expect(labelsInOrder(optionNav())).toEqual(['Foxtrot', 'Hotel', 'Echo', 'Golf'])
  })

  it('does not reorder single-select rows (no checkbox)', () => {
    render(
      createElement(CampaignHeaderFilterPopover, {
        id: 'filter-kind',
        label: 'Tipo',
        active: true,
        closeOnChoose: true,
        optionRows: singleRows('zona'),
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: /Filtrar.*Tipo/ }))

    expect(labelsInOrder(screen.getByRole('navigation', { name: 'Tipo' }))).toEqual([
      'Todas',
      'Município',
      'Zona eleitoral',
    ])
  })
})
