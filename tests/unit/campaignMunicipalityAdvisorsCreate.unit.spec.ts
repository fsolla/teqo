import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { createElement } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { TooltipProvider } from '@/components/ui/tooltip'
import type { EligibleAdvisorOption } from '@/utilities/municipality/municipalityViewModels'

/**
 * B154 — the "Criar assessor" affordance is the whole point of the item: it
 * must appear exactly when the typed query matches no existing eligible advisor
 * (and is long enough to create), and never otherwise. These cases pin that
 * contract without touching the network — the popover is only opened and typed
 * into; nothing is submitted.
 */
const MUNICIPALITY_NAME = 'Feira de Santana'

const advisorControl = (options: EligibleAdvisorOption[]) =>
  createElement(MunicipalityListAdvisorsControl, {
    municipalityID: 1,
    municipalityName: MUNICIPALITY_NAME,
    currentAdvisorIDs: [],
    isPriority: false,
    advisorNamesById: new Map(),
    options,
    variant: 'sheet',
  })

const openAndType = async (query: string) => {
  fireEvent.click(screen.getByRole('button', { name: /Editar assessores em/ }))
  const dialog = await screen.findByRole('dialog')
  const search = within(dialog).getByLabelText('Buscar assessor')
  fireEvent.change(search, { target: { value: query } })
  return dialog
}

beforeAll(() => {
  // The advisors control renders `cmdk`, which measures its list and keeps the
  // selected item in view. jsdom implements neither — same stub as the overlay
  // spec.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Element.prototype.scrollIntoView = () => {}
})

afterEach(cleanup)

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

const renderControl = (element: ReturnType<typeof advisorControl>) =>
  render(createElement(TooltipProvider, null, element))

describe('MunicipalityListAdvisorsControl create option (B154)', () => {
  it('offers "Criar assessor" when the query matches no eligible advisor', async () => {
    renderControl(advisorControl([]))

    const dialog = await openAndType('Carlos')
    const option = await within(dialog).findByRole('option', { name: /Criar assessor/ })
    expect(option.textContent).toContain('Carlos')
    expect(within(dialog).queryByText('Nenhum resultado.')).toBeNull()
  })

  it('keeps the empty state for a query too short to create', async () => {
    renderControl(advisorControl([]))

    const dialog = await openAndType('C')
    await waitFor(() => expect(within(dialog).getByText('Nenhum resultado.')).toBeTruthy())
    expect(within(dialog).queryByRole('option', { name: /Criar assessor/ })).toBeNull()
  })

  it('never offers create when an existing advisor matches the query', async () => {
    renderControl(advisorControl([{ id: 7, name: 'Carlos Souza', isCurrent: false }]))

    const dialog = await openAndType('Carlos')
    expect(await within(dialog).findByRole('option', { name: /Carlos Souza/ })).toBeTruthy()
    expect(within(dialog).queryByRole('option', { name: /Criar assessor/ })).toBeNull()
  })
})
