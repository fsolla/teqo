import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { CampaignColumnPicker } from '@/components/campaign/shared/CampaignColumnPicker'

const refresh = vi.fn()

// Spread the real module, like the sibling specs: replacing it wholesale would
// break the day the picker renders anything reading `usePathname`.
vi.mock('next/navigation', async (importActual) => ({
  ...(await importActual()),
  useRouter: () => ({ refresh }),
}))

/**
 * jsdom scopes `document.cookie` by the document URL, and the real cookie is
 * written with `path=/campanha` — so a jar that ignores attributes is what
 * lets these tests read back what the picker wrote.
 */
let cookieJar = ''

const COLUMNS = [
  { id: 'name', label: 'Município', mandatory: true },
  { id: 'region', label: 'Território' },
  { id: 'trend', label: 'Tendência' },
]

const picker = (hiddenColumnIds: string[]) =>
  createElement(CampaignColumnPicker, {
    listId: 'municipios' as const,
    columns: COLUMNS,
    hiddenColumnIds,
  })

const menuTrigger = () => screen.getByRole('button', { name: /Mostrar ou ocultar colunas/ })

const openMenu = () => fireEvent.click(menuTrigger())

/** Closing is the commit path — the idle timer is only a safety net. */
const closeMenu = () => fireEvent.click(menuTrigger())

beforeAll(() => {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => cookieJar,
    set: (value: string) => {
      const [pair = ''] = value.split('; ')
      const separator = pair.indexOf('=')
      const name = pair.slice(0, separator)
      const others = cookieJar.split('; ').filter((entry) => entry && !entry.startsWith(`${name}=`))
      cookieJar = [...others, pair].join('; ')
    },
  })
})

beforeEach(() => {
  cookieJar = ''
  refresh.mockClear()
})

afterEach(cleanup)

afterAll(() => {
  Reflect.deleteProperty(document, 'cookie')
})

describe('CampaignColumnPicker', () => {
  it('batches a whole editing session into one cookie write and one refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    try {
      render(picker([]))
      openMenu()

      fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))
      // Reading the next label takes longer than any debounce worth having:
      // a second between checkboxes must still be one refresh, not two.
      await vi.advanceTimersByTimeAsync(1_000)
      fireEvent.click(screen.getByRole('checkbox', { name: 'Tendência' }))
      await vi.advanceTimersByTimeAsync(1_000)

      expect(refresh).not.toHaveBeenCalled()
      closeMenu()

      expect(refresh).toHaveBeenCalledTimes(1)
      expect(cookieJar).toContain('campaign_columns=municipios:region~trend')
    } finally {
      vi.useRealTimers()
    }
  })

  it('saves without repainting when the menu is left open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })

    try {
      render(picker([]))
      openMenu()
      fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))

      await vi.advanceTimersByTimeAsync(3_000)

      // The idle timer is durability, not the commit: a slow reader who takes
      // more than the interval between checkboxes must not pay a route render
      // per column, which is the failure the 400 ms debounce was rejected for.
      expect(cookieJar).toContain('campaign_columns=municipios:region')
      expect(refresh).not.toHaveBeenCalled()

      closeMenu()
      expect(refresh).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('does not refresh a session that ends where it started', () => {
    render(picker(['region']))
    openMenu()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))
    closeMenu()

    expect(refresh).not.toHaveBeenCalled()
  })

  it('saves a pending edit when the list unmounts with the menu open', () => {
    const { unmount } = render(picker([]))
    openMenu()

    // Radix reports no close event here, so without the unmount flush this
    // choice would be lost to a sidebar navigation with no feedback at all.
    fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))
    unmount()

    expect(cookieJar).toContain('campaign_columns=municipios:region')
  })

  it('never lets the mandatory column be unchecked', () => {
    render(picker([]))
    openMenu()

    const mandatory = screen.getByRole('checkbox', { name: /^Município/ })

    expect(mandatory.getAttribute('aria-checked')).toBe('true')
    expect(mandatory).toHaveProperty('disabled', true)
  })

  it('keeps an edit made while the previous one is still in flight', async () => {
    const { rerender } = render(picker([]))
    openMenu()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Território' }))
    closeMenu()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1))

    // The second toggle opens a new window …
    openMenu()
    fireEvent.click(screen.getByRole('checkbox', { name: 'Tendência' }))
    // … and the RSC payload of the FIRST one lands inside it. Adopting it here
    // would uncheck nothing and re-commit `region` alone, dropping `trend`.
    rerender(picker(['region']))

    expect(screen.getByRole('checkbox', { name: 'Tendência' }).getAttribute('aria-checked')).toBe(
      'false',
    )

    closeMenu()
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(2))
    expect(cookieJar).toContain('campaign_columns=municipios:region~trend')
  })

  it('adopts the server payload once nothing is pending', async () => {
    const { rerender } = render(picker([]))

    rerender(picker(['region']))
    openMenu()

    await waitFor(() =>
      expect(
        screen.getByRole('checkbox', { name: 'Território' }).getAttribute('aria-checked'),
      ).toBe('false'),
    )
    expect(refresh).not.toHaveBeenCalled()
  })
})
