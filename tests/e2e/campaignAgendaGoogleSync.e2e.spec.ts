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
  test('staff vê a pill "não configurado" e o diálogo oferece conectar (C149)', async ({
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
    // C149: sem conexão, o card oferece o botão de conectar (o client OAuth
    // dummy está no webServer) e mantém a service account como fallback.
    await expect(dialog.getByText('Não configurado')).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Conectar com o Google' })).toBeVisible()
    await expect(dialog.getByText(/service account continua disponível/)).toBeVisible()
  })

  test('o botão Conectar leva ao consent do Google com os escopos mínimos (C149)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    // Row owned by the fixture: the start action UPDATES it (the connection
    // row may exist before any calendar is chosen) instead of creating a row
    // the cleanup would not track.
    await fixtures.payload.create({
      collection: 'googleCalendarSync',
      data: {},
      depth: 0,
      overrideAccess: true,
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    // The click navigates the browser to accounts.google.com — intercept so
    // the assertion observes the URL Google would receive, with no network.
    await page.route('https://accounts.google.com/**', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<title>consent</title>' }),
    )

    const pill = page.getByRole('button', { name: 'Google: não configurado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Conectar com o Google' }).click()

    await expect.poll(() => page.url()).toContain('accounts.google.com/o/oauth2/v2/auth')
    const url = new URL(page.url())
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('prompt')).toBe('consent')
    expect(url.searchParams.get('response_type')).toBe('code')
    expect(url.searchParams.get('scope')).toBe(
      'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.calendarlist.readonly',
    )
    expect(url.searchParams.get('state')).toBeTruthy()
    const redirectUri = new URL(url.searchParams.get('redirect_uri') as string)
    expect(redirectUri.pathname).toBe('/campanha/agenda/google-oauth/callback')
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

  test('estado synced: pill, link do calendário, seletor principal e one-click (C150)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const coordinator = await fixtures.createCampaignUser('coordinator')
    // lastSuccessAt no futuro: imune a lastErrorAt gravado por hooks de specs
    // paralelas (a derivação só volta a synced enquanto erro não for mais novo).
    // O refresh token seedado dá o estado `connected` (o client OAuth dummy
    // está no webServer) — necessário para o seletor de calendário principal.
    await seedSyncConfig(fixtures, {
      lastSyncedAt: FAR_FUTURE,
      lastSuccessAt: FAR_FUTURE,
      oauthRefreshToken: 'c150-e2e-refresh',
      oauthConnectedAt: '2026-08-01T10:00:00.000Z',
    })

    await campaign.login(page, coordinator.email!, coordinator.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    // C150 — o one-click do header aparece para staff quando há calendário.
    const headerAdd = page.locator('a[aria-label="Adicionar ao meu Google Calendar"]:visible')
    await expect(headerAdd).toBeVisible({ timeout: 15_000 })
    await expect(headerAdd).toHaveAttribute(
      'href',
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_ID)}`,
    )

    const pill = page.getByRole('button', { name: 'Google: sincronizado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(
      dialog.getByText(/Sincronizado — as mudanças da agenda já refletiram/),
    ).toBeVisible()
    // C150 — o seletor do calendário principal (manager + conexão ativa).
    await expect(dialog.getByRole('button', { name: 'Trocar calendário principal' })).toBeVisible()
    // O one-click no diálogo e a URL iCal pública para o caminho manual.
    await expect(
      dialog.getByRole('link', { name: 'Adicionar ao meu Google Calendar' }),
    ).toHaveAttribute(
      'href',
      `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_ID)}`,
    )
    const icalInput = dialog.getByLabel(
      'URL pública do calendário (Por URL, Apple Calendar e Outlook)',
    )
    await expect(icalInput).toHaveValue(
      `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`,
    )
    await expect(dialog.getByRole('button', { name: 'Copiar link' })).toBeVisible()
    await expect(dialog.getByText(/Como adicionar ao Google Calendar:/)).toBeVisible()
    await expect(dialog.getByRole('button', { name: 'Desativar' })).toBeVisible()

    // C148 — na janela baixa o corpo rola dentro do modal e o rodapé de ações
    // permanece visível (antes o conteúdo vazava para fora da tela sem scroll).
    await page.setViewportSize({ width: 1280, height: 560 })
    // O `100dvh` reflui no frame seguinte ao resize; poll até o box caber.
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox()
        return box ? Math.round(box.y + box.height) : Number.POSITIVE_INFINITY
      })
      .toBeLessThanOrEqual(560)
    const body = dialog.locator('[data-slot="dialog-scroll-body"]')
    await expect(body).toBeVisible()
    expect(await body.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeGreaterThan(0)
    await expect(dialog.getByRole('button', { name: 'Sincronizar agora' })).toBeVisible()
  })

  test('advisor vê o one-click mas não o seletor de calendário (C150)', async ({
    campaign,
    page,
  }) => {
    const { fixtures } = campaign
    const advisor = await fixtures.createCampaignUser('advisor')
    await seedSyncConfig(fixtures, {
      lastSyncedAt: FAR_FUTURE,
      lastSuccessAt: FAR_FUTURE,
      oauthRefreshToken: 'c150-e2e-refresh-advisor',
      oauthConnectedAt: '2026-08-01T10:00:00.000Z',
    })

    await campaign.login(page, advisor.email!, advisor.password)
    await page.goto(`${campaign.baseURL}/campanha/agenda`)

    const headerAdd = page.locator('a[aria-label="Adicionar ao meu Google Calendar"]:visible')
    await expect(headerAdd).toBeVisible({ timeout: 15_000 })

    const pill = page.getByRole('button', { name: 'Google: sincronizado' })
    await expect(pill).toBeVisible({ timeout: 15_000 })
    await pill.click()

    const dialog = syncDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog.getByRole('button', { name: /calendário principal/ })).toHaveCount(0)
    await expect(dialog.getByText(/escolhido por candidato ou coordenação/)).toBeVisible()
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

      // C101: no mobile o título da top bar vira o rótulo do período assim que
      // o calendário settle ("12 Agosto") — a asserção de página carregada é
      // o próprio FAB, o sujeito do teste.
      const fab = page.getByRole('button', { name: 'Ações rápidas' })
      await expect(fab).toBeVisible({ timeout: 15_000 })

      // Sem doc seedado + chave fake presente → estado not-configured.
      await fab.click()
      await page.getByRole('button', { name: 'Agenda da Campanha' }).click()

      const sheet = syncDialog(page)
      await expect(sheet).toBeVisible({ timeout: 15_000 })
      await expect(sheet.getByText('Não configurado')).toBeVisible()
      await expect(sheet.getByRole('button', { name: 'Conectar com o Google' })).toBeVisible()
    })

    test('o one-click do header aparece no mobile com calendário principal (C150)', async ({
      campaign,
      page,
    }) => {
      const { fixtures } = campaign
      const coordinator = await fixtures.createCampaignUser('coordinator')
      await seedSyncConfig(fixtures, {
        lastSyncedAt: FAR_FUTURE,
        lastSuccessAt: FAR_FUTURE,
      })

      await campaign.login(page, coordinator.email!, coordinator.password)
      await page.goto(`${campaign.baseURL}/campanha/agenda`)

      // O cluster do top bar não suporta botão full-width (adaptação do
      // rascunho): no mobile o one-click é o ícone com aria-label.
      const addLink = page.locator('a[aria-label="Adicionar ao meu Google Calendar"]:visible')
      await expect(addLink).toBeVisible({ timeout: 15_000 })
      await expect(addLink).toHaveAttribute(
        'href',
        `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(CALENDAR_ID)}`,
      )
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

  test('o webhook aceita uma entrega válida e trata os estados do recurso (C115)', async ({
    campaign,
    request,
  }) => {
    const { fixtures } = campaign
    const secret = 'c'.repeat(32)
    const channelId = 'channel-e2e'
    const resourceId = 'resource-e2e'

    await fixtures.payload.create({
      collection: 'googleCalendarSync',
      data: {
        calendarId: 'c_campanha_e2e@group.calendar.google.com',
        pushChannelId: channelId,
        pushChannelResourceId: resourceId,
        pushChannelSecret: secret,
      },
      depth: 0,
      overrideAccess: true,
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

      // A valid change ping: acknowledged and the reconciliation runs (no
      // credential env in the test runtime → the engine no-ops as
      // `not-configured`; the 200 contract is what matters — Google must not
      // retry a delivery whose pass failed).
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
