import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RelationChipCell,
  type RelationChip,
  type RelationChipCellCopy,
  type RelationSearchHit,
} from '@/components/campaign/shared/RelationChipCell'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

/**
 * B170 F1: pins the collapse contract that B169 hardened and left untested —
 * how many chips fit below the 3-row cap is decided by the REAL layout
 * (`getBoundingClientRect`), not by an estimate. Every spec that predates this
 * one either disabled measurement (`measureOverflow: false`) or collapsed to a
 * single chip, so the "recolher para N chips cujas linhas cabem" branch had no
 * regression unit. Here the geometry is stubbed deterministically: 4 chips per
 * line, 20px tall, 6px flex gap — the shared cell's own `COLLAPSED_CHIP_ROWS`
 * (=3) then leaves exactly 12 chips visible out of 16, with
 * "Ver mais…"/"Ver menos" toggling between the slice and the full set.
 *
 * The stub keys off attributes, mirroring how the measurement walks the DOM:
 * `[data-relation-chip]` spans get index-derived rects (line = floor(idx/N),
 * N = 4 by default), `[data-relation-toggle]` reserves a small width on the
 * last line, INPUT is width 0 by default (so the `minWidth` branch is
 * skipped), and every other element is the row, `right` = 500 by default
 * (generously wide, keeping the trailing-width loop from shrinking the slice).
 * The `// Issue #1042` case below overrides all three, because the floor of
 * one only matters where the defaults do not reach.
 */

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

const CHIP_GAP_PX = 6
const CHIP_HEIGHT = 20
const CHIP_WIDTH = 100
const CHIPS_PER_LINE = 4
const ROW_RIGHT = 500
const TOGGLE_WIDTH = 40

/**
 * Issue #1042 — the geometry is per-test so the regression can narrow the
 * column and make the search input reserve its real `min-w-32` (128px): that
 * reservation is what used to walk `fitting` to zero. Reset in `beforeEach`.
 */
let chipsPerLine = CHIPS_PER_LINE
let rowRight = ROW_RIGHT
let inputWidth = 0

const chipRect = (index: number) => {
  const line = Math.floor(index / chipsPerLine)
  const col = index % chipsPerLine
  const top = line * (CHIP_HEIGHT + CHIP_GAP_PX)
  const left = col * (CHIP_WIDTH + CHIP_GAP_PX)
  return {
    top,
    left,
    right: left + CHIP_WIDTH,
    bottom: top + CHIP_HEIGHT,
    width: CHIP_WIDTH,
    height: CHIP_HEIGHT,
    x: left,
    y: top,
    toJSON: () => ({}) as DOMRect,
  } as DOMRect
}

const indexAmongChipSiblings = (element: Element): number => {
  let index = 0
  let sibling = element.previousElementSibling
  while (sibling) {
    if (sibling.hasAttribute('data-relation-chip')) index += 1
    sibling = sibling.previousElementSibling
  }
  return index
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect
const originalGetComputedStyle = window.getComputedStyle.bind(window)

const chip = (id: number): RelationChip => ({
  key: `chip-${id}`,
  label: `Estado ${id}`,
  href: `/campanha/dobradinhas/${id}`,
  ids: [id],
})

const copy: RelationChipCellCopy = {
  searchPlaceholder: 'Buscar deputado estadual…',
  searchLabel: 'Buscar deputado estadual',
  suggestionsLabel: 'Sugestões de deputados estaduais',
  emptyDrawerMessage: 'Nenhuma dobradinha vinculada.',
  savingMessage: 'Salvando dobradinhas.',
  savedMessage: 'Dobradinhas salvas.',
  removedMessage: (count) => (count === 1 ? 'Dobradinha removida.' : `${count} removidas.`),
}

const chipCell = (ids: number[]) =>
  createElement(RelationChipCell, {
    ownerId: 99,
    ownerName: 'Maria Souza',
    ids,
    buildChips: (assignedIds: number[]) => assignedIds.map(chip),
    searchHits: (): RelationSearchHit[] => [],
    buildFormData: () => new FormData(),
    commitAction: async (): Promise<CampaignFormActionState> => ({ status: 'success' as const }),
    drawerTitle: 'Dobradinhas da liderança',
    triggerLabel: 'Editar dobradinhas de Maria Souza',
    updateErrorMessage: 'Não foi possível atualizar as dobradinhas. Tente novamente.',
    copy,
  })

const chipCount = (container: HTMLElement): number =>
  container.querySelectorAll('[data-relation-chip]').length

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this.hasAttribute('data-relation-chip')) {
      return chipRect(indexAmongChipSiblings(this))
    }
    if (this.hasAttribute('data-relation-toggle')) {
      return { width: TOGGLE_WIDTH } as DOMRect
    }
    if (this.tagName === 'INPUT') {
      return { width: inputWidth, height: CHIP_HEIGHT } as DOMRect
    }
    return { right: rowRight, width: rowRight } as DOMRect
  }
})

beforeEach(() => {
  chipsPerLine = CHIPS_PER_LINE
  rowRight = ROW_RIGHT
  inputWidth = 0
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect
})

describe('RelationChipCell collapse contract (B170 F1)', () => {
  it('collapses 16 chips to the 12 that fit in three measured rows', () => {
    const { container } = render(chipCell([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))

    // 4 per line × 3 lines = 12; the 4 chips whose rect lands on line 3 are out.
    expect(chipCount(container)).toBe(12)
    expect(screen.getByText('Estado 12')).toBeTruthy()
    expect(screen.queryByText('Estado 13')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver mais…' })).toBeTruthy()
  })

  it('expands to every chip on "Ver mais…" and collapses back on "Ver menos"', () => {
    const { container } = render(chipCell([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]))

    fireEvent.click(screen.getByRole('button', { name: 'Ver mais…' }))
    expect(chipCount(container)).toBe(16)
    expect(screen.getByText('Estado 16')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Ver mais…' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver menos' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }))
    expect(chipCount(container)).toBe(12)
    expect(screen.queryByText('Estado 13')).toBeNull()
    expect(screen.getByRole('button', { name: 'Ver mais…' })).toBeTruthy()
  })

  it('renders every chip without a toggle when all fit in three rows', () => {
    // 8 chips occupy exactly lines 0–1, well inside the 3-row cap.
    const { container } = render(chipCell([1, 2, 3, 4, 5, 6, 7, 8]))

    expect(chipCount(container)).toBe(8)
    expect(screen.getByText('Estado 8')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ver mais/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ver menos/ })).toBeNull()
  })

  it('does not show a toggle when the count exactly fills the three rows', () => {
    // 12 chips = the full 3×4 grid: nothing hidden, no affordance.
    const { container } = render(chipCell([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]))

    expect(chipCount(container)).toBe(12)
    expect(screen.getByText('Estado 12')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Ver mais/ })).toBeNull()
  })

  it('keeps one chip visible when wide chips fill every line (Issue #1042)', () => {
    // One chip per line: the 4th lands past the 3-row cap, so the shrink loop
    // runs — and in the narrow column the input's 128px `min-w-32`
    // reservation leaves no room for any tail chip. The loop used to walk
    // `fitting` to 0 and the cell rendered with no chips at all, only
    // "Ver mais…" (the B34 e2e failure snapshot). The floor of one keeps the
    // first chip; the toggle and the input wrap to the next line.
    chipsPerLine = 1
    rowRight = 200
    inputWidth = 128
    vi.spyOn(window, 'getComputedStyle').mockImplementation((element: Element) =>
      element.tagName === 'INPUT'
        ? ({ minWidth: '128px' } as CSSStyleDeclaration)
        : originalGetComputedStyle(element),
    )

    const { container } = render(chipCell([1, 2, 3, 4]))

    expect(chipCount(container)).toBe(1)
    expect(screen.getByText('Estado 1')).toBeTruthy()
    expect(screen.queryByText('Estado 2')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Ver mais…' }))
    expect(chipCount(container)).toBe(4)
    fireEvent.click(screen.getByRole('button', { name: 'Ver menos' }))
    expect(chipCount(container)).toBe(1)
  })
})
