import type { Page } from '@playwright/test'

import type { GoogleCalendarSync } from '../../src/payload-types.js'
import {
  campaignPageChrome,
  expect,
  test,
  type CampaignE2EOwnership,
} from './fixtures/campaignE2EFixtures.js'

/**
 * C114 + C122 — Google Calendar mirror surface on the agenda. The e2e pins the
 * four derived states deterministically: the sync doc is seeded per test and
 * the dev server runs with the FAKE service-account key
 * (`googleCalendarTestKey.ts`, injected via `webServer.env`) — it parses as a
 * credential (so the view derives real states) but fails locally at JWT
 * signing, so any sync pass the auto-retry/hooks run fails fast WITHOUT
 * touching the real Google API.
 *
 * The `synced` seed uses a far-future `lastSuccessAt`: parallel activity
 * specs' hooks write `lastErrorAt` on the shared single sync doc while this
 * test runs, and a stale `lastSuccessAt` would flip the derived state to
 * `paused`. `disabled`/`paused` are naturally immune (their derivation wins).
 * The no-seed states (`not-configured`, mobile) are safe for the same reason
 * no other spec ever creates a `googleCalendarSync` doc — only this spec
 * seeds it.
 *
 * Serial mode: the four states share the ONE `googleCalendarSync` doc — if the
 * file's tests ran in parallel they would race each other on it (same pattern
 * as `campaignNearestMunicipality`).
 */
test.describe.configure({ mode: 'serial' })

const CALENDAR_ID = 'c_campanha_e2e@group.calendar.google.com'
const FAR_FUTURE = '2099-01-01T00:00:00.000Z'

const syncDialog = (page: Page) =>
  page.getByRole('dialog', { name: /Agenda da Campanha no Google/ })

const seedSyncConfig = (
  fixtures: CampaignE2EOwnership,
  overrides: Partial<GoogleCalendarSync> = {},
) =>
  fixtures.payload.create({
    collection: 'googleCalendarSync',
    data: { calendarId: CALENDAR_ID, ...overrides },
    depth: 0,
    overrideAccess: true,
  })

test.describe('Agenda — sincronização Google (C114/C122)', () => {
  test('staff vê a pill "não configurado" e o diálogo explica o passo de operação', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()

    const pill = page.getByRole('button', { name: 'Google: não configurado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Ainda não configurado')).toBeVisible()
    // O runbook de operação aparece (a ativação depende da conta Google da campanha).
    await expect(dialog.getByText(/service account do Teqo/)).toBeVisible()
  })

  test('estado disabled: pill, aviso de desativação e Reativar re-sincroniza (D7)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    await seedSyncConfig(fixtures, { disabledAt: '2026-08-11T10:00:00.000Z' })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const pill = page.getByRole('button', { name: 'Google: desativado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/A sincronização está desativada/)).toBeVisible()

    // Re-enable: o hook da config roda uma pass (D7) que falha localmente na
    // chave fake — o estado derivado vira paused, determinístico e sem rede.
    await dialog.getByRole('button', { name: 'Reativar' }).click()
    await expect(dialog.getByText('Pausado — re-tentando')).toBeVisible({ timeout: 15_000 })
    // CSS locator de propósito: com o dialog modal aberto, o Radix aplica
    // aria-hidden no shell do app e a pill some das queries por role.
    await expect(
      page.locator('button[aria-label="Google: pausado — re-tentando"]:visible'),
    ).toBeVisible()
  })

  test('estado paused: pill, erro da última tentativa e link para o Google', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    await seedSyncConfig(fixtures, {
      lastSyncedAt: '2026-08-11T10:05:00.000Z',
      lastErrorAt: '2026-08-11T10:05:00.000Z',
      lastError: 'Google fora do ar (simulado)',
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const pill = page.getByRole('button', { name: 'Google: pausado — re-tentando' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText('Pausado — re-tentando')).toBeVisible()
    // A linha da última tentativa aparece com o erro; o auto-retry de mount
    // falha localmente na chave fake e sobrescreve a mensagem seedada com a
    // mensagem do jose — o formato (não o texto) é o contrato.
    await expect(dialog.getByText(/Última tentativa: .* — /)).toBeVisible()
    // O atalho para a tela de adicionar por URL do Google.
    await expect(dialog.getByRole('link', { name: 'Abrir Google Calendar' })).toHaveAttribute(
      'href',
      /calendar\.google\.com\/calendar\/(u\/\d+\/)?r\/settings\/addbyurl/,
    )
  })

  test('estado synced: pill, link do calendário com copiar e instruções', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    // lastSuccessAt no futuro: imune a lastErrorAt gravado por hooks de specs
    // paralelas (a derivação só volta a synced enquanto erro não for mais novo).
    await seedSyncConfig(fixtures, {
      lastSyncedAt: FAR_FUTURE,
      lastSuccessAt: FAR_FUTURE,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const pill = page.getByRole('button', { name: 'Google: sincronizado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/Sincronizado — as mudanças da agenda já refletiram/),
    ).toBeVisible()
    // O link de adição vem do calendarId seedado (webcal → cid) + copiar + instruções.
    const linkInput = dialog.getByLabel('Link do calendário (copie e envie à equipe)')
    await expect(linkInput).toHaveValue(
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(
        `webcal://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`,
      )}`,
    )
    await expect(dialog.getByRole('button', { name: 'Copiar link' })).toBeVisible()
    await expect(dialog.getByText(/Como adicionar ao Google Calendar:/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Desativar' })).toBeVisible()
  })

  test.describe('mobile (FAB)', () => {
    test.use({ viewport: { width: 390, height: 844 } })

    test('o FAB "Ações rápidas" abre o sheet do espelho pela ação "Agenda da Campanha"', async ({
      campaign,
      page,
    }) => {
      const { fixtures } = campaign
      const coordinator = await fixtures.createCampaignUser('coordinator')

      await campaign.login(page, coordinator.email!, coordinator.password)
      await page.goto(`${campaign.baseURL}/campanha/agenda`)

      await expect(campaignPageChrome(page, 'Agenda')).toBeVisible()

      // Sem doc seedado + chave fake presente → estado not-configured.
      await page.getByRole('button', { name: 'Ações rápidas' }).click()
      await page.getByRole('button', { name: 'Agenda da Campanha' }).click()

      const sheet = syncDialog(page)
      await expect(sheet).toBeVisible({ timeout: 15_000 })
      await expect(sheet.getByText('Ainda não configurado')).toBeVisible()
    })
  })

  test.describe('webhook público (C115)', () => {
    test('falha fechado sem canal configurado', async ({ campaign, request }) => {
      const baseURL = campaign.baseURL
      const wrongSecret = 'a'.repeat(32)
      const validSecret = 'b'.repeat(32)

      // Unknown URL secret → 404, com ou sem headers de canal.
      const unknown = await request.post(
        `${baseURL}/campanha/agenda/google-webhook/${wrongSecret}`,
        {
          headers: {
            'x-goog-channel-id': 'channel-x',
            'x-goog-resource-id': 'resource-x',
            'x-goog-channel-token': validSecret,
          },
        },
      )
      expect(unknown.status()).toBe(404)

      // Short secret (below the 32-char contract) → 404.
      const short = await request.post(`${baseURL}/campanha/agenda/google-webhook/short`)
      expect(short.status()).toBe(404)

      // GET is not a delivery method → 404.
      const get = await request.get(`${baseURL}/campanha/agenda/google-webhook/${validSecret}`)
      expect(get.status()).toBe(404)
    })

    test('aceita uma entrega válida e trata os estados do recurso', async ({
      campaign,
      request,
    }) => {
      const { fixtures } = campaign
      const secret = 'c'.repeat(32)
      const channelId = 'channel-e2e-c115'
      const resourceId = 'resource-e2e-c115'

      await seedSyncConfig(fixtures, {
        pushChannelId: channelId,
        pushChannelResourceId: resourceId,
        pushChannelSecret: secret,
      })

      const url = `${campaign.baseURL}/campanha/agenda/google-webhook/${secret}`
      const headers = {
        'x-goog-channel-id': channelId,
        'x-goog-resource-id': resourceId,
        'x-goog-channel-token': secret,
      }

      try {
        // `sync` — channel-creation ping: acknowledged, nothing recorded.
        const syncPing = await request.post(url, {
          headers: { ...headers, 'x-goog-resource-state': 'sync' },
        })
        expect(syncPing.status()).toBe(200)

        // A valid change ping: acknowledged and the reconciliation runs — the
        // fake credential makes the pass fail fast locally, but the 200
        // contract is the point: Google must not retry a delivery whose pass
        // failed (the local auto-retry paths recover).
        const changePing = await request.post(url, {
          headers: { ...headers, 'x-goog-resource-state': 'exists' },
        })
        expect(changePing.status()).toBe(200)

        // `not_exists` — the watched calendar is gone: still 200 (no retry
        // storm), and the staff-visible error state records WHY.
        const gonePing = await request.post(url, {
          headers: { ...headers, 'x-goog-resource-state': 'not_exists' },
        })
        expect(gonePing.status()).toBe(200)

        const doc = await fixtures.payload.find({
          collection: 'googleCalendarSync',
          depth: 0,
          limit: 1,
          pagination: false,
          overrideAccess: true,
        })
        expect(doc.docs[0]?.lastError).toContain('não existe mais')
      } finally {
        await fixtures.payload.delete({
          collection: 'googleCalendarSync',
          where: { pushChannelId: { equals: channelId } },
          overrideAccess: true,
        })
      }
    })
  })
})
