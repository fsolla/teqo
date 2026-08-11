import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import type { GoogleCalendarSyncActionResult } from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { AgendaGoogleSyncChrome } from '@/components/campaign/activity/AgendaGoogleSyncChrome'
import {
  CampaignPageChromeProvider,
  useCampaignHeaderActions,
} from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignQuickActionContextProvider } from '@/components/campaign/shell/CampaignQuickActionContext'
import type { GoogleCalendarSyncStatus } from '@/utilities/googleCalendarSync'

import { stubMatchMedia } from '../helpers/matchMedia'

/**
 * S14 (C122) — the agenda Google mirror chrome: the status pill label per
 * derived status and the paused auto-retry (exactly one attempt per mount).
 * The pill is registered into the page chrome via `SetCampaignHeaderAction`
 * (which renders nothing in place), so the harness reads the registered node
 * back through `useCampaignHeaderActions` — the same contract the app header
 * uses.
 */

const stateFor = (status: GoogleCalendarSyncStatus): GoogleCalendarSyncActionResult => ({
  ok: true,
  status,
  calendarId: status === 'not-configured' ? null : 'c_campanha@group.calendar.google.com',
  lastSyncedAt: status === 'synced' || status === 'paused' ? '2026-08-11T10:00:00.000Z' : null,
  lastSuccessAt: status === 'synced' ? '2026-08-11T10:00:00.000Z' : null,
  lastErrorAt: status === 'paused' ? '2026-08-11T10:05:00.000Z' : null,
  lastError: status === 'paused' ? 'Google fora do ar (simulado)' : null,
  addLink: status === 'not-configured' ? null : 'https://calendar.google.com/calendar/r?cid=webcal',
})

const PILL_LABELS: Record<GoogleCalendarSyncStatus, string> = {
  synced: 'Google: sincronizado',
  paused: 'Google: pausado — re-tentando',
  'not-configured': 'Google: não configurado',
  disabled: 'Google: desativado',
}

const HeaderActionsProbe = () => {
  const actions = useCampaignHeaderActions()
  return <>{actions['google-calendar-sync'] ?? null}</>
}

const renderChrome = ({
  status,
  // Status-consistent default: a paused mount's auto-retry resolves back to
  // the same state, so the label assertions never race the retry's setState.
  onSyncNow = vi.fn(async () => stateFor(status)),
}: {
  status: GoogleCalendarSyncStatus
  onSyncNow?: () => Promise<GoogleCalendarSyncActionResult>
}) =>
  render(
    <CampaignPageChromeProvider role="coordinator">
      <CampaignQuickActionContextProvider>
        <AgendaGoogleSyncChrome
          initialState={stateFor(status)}
          onSyncNow={onSyncNow}
          onSetDisabled={vi.fn(async () => stateFor('disabled'))}
        />
        <HeaderActionsProbe />
      </CampaignQuickActionContextProvider>
    </CampaignPageChromeProvider>,
  )

beforeAll(() => {
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

beforeEach(() => {
  stubMatchMedia()
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

afterAll(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(Element.prototype, 'scrollIntoView')
})

describe('AgendaGoogleSyncChrome (S14)', () => {
  it.each(Object.entries(PILL_LABELS) as [GoogleCalendarSyncStatus, string][])(
    'renders the pill label for status %s',
    (status, label) => {
      renderChrome({ status })

      const button = screen.getByRole('button', { name: label })
      expect(button.getAttribute('title')).toBe(label)
    },
  )

  it('opens the sync dialog when the pill is clicked (any status)', () => {
    renderChrome({ status: 'synced' })

    fireEvent.click(screen.getByRole('button', { name: /^Google:/ }))

    expect(screen.getByRole('dialog', { name: /Agenda da Campanha no Google/ })).toBeTruthy()
  })

  it('auto-retries exactly once on mount when paused', async () => {
    const onSyncNow = vi.fn(async () => stateFor('paused'))
    renderChrome({ status: 'paused', onSyncNow })

    await waitFor(() => expect(onSyncNow).toHaveBeenCalledTimes(1))

    // The retry resolved to the same paused state — it must NOT fire again.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(onSyncNow).toHaveBeenCalledTimes(1)
  })

  it.each(['synced', 'not-configured'] as const)('does not auto-retry on a %s mount', (status) => {
    const onSyncNow = vi.fn(async () => stateFor(status))
    renderChrome({ status, onSyncNow })
    expect(onSyncNow).not.toHaveBeenCalled()
  })

  it('follows a successful paused retry into the synced label', async () => {
    const onSyncNow = vi.fn(async () => stateFor('synced'))
    renderChrome({ status: 'paused', onSyncNow })

    await waitFor(() =>
      expect(screen.getByRole('button', { name: PILL_LABELS.synced })).toBeTruthy(),
    )
    expect(onSyncNow).toHaveBeenCalledTimes(1)
  })
})
