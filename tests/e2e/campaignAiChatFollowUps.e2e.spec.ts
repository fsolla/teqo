import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * Mock the AI endpoint with SDK v7 UI-message-stream SSE chunks (start /
 * text-start / text-delta / text-end / finish — the same wire format the
 * `campaignAiLinks.e2e.spec.ts` mock uses; a bare legacy `{"type":"text"}`
 * chunk fails the client schema and the chat never settles), deciding the
 * answer from the last user text so the follow-up slot can be asserted across
 * the conversation.
 */
const FIRST_RESPONSE = `Em 2022, o Solla teve 12.345 votos em Ilhéus.

**Sugestões de continuação:**
- Quantos votos tivemos em Salvador em 2022?
- Quem foi o deputado mais votado em Barreiras?
- Como está o município de Vitória da Conquista?`

const SECOND_RESPONSE = `Em 2022, foram 88.765 votos em Salvador.

**Sugestões de continuação:**
- Qual a votação em Feira de Santana?
- Quais dobradinhas temos em Salvador?`

const THIRD_RESPONSE = `Os dados de 2026 ainda não existem.`

const lastUserText = (body: unknown): string | null => {
  const messages =
    (
      body as {
        messages?: Array<{ role?: string; parts?: Array<{ type?: string; text?: string }> }>
      }
    )?.messages ?? []
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user') continue
    for (const part of message.parts ?? []) {
      if (part.type === 'text' && part.text) return part.text
    }
  }
  return null
}

const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    const raw = route.request().postData() ?? ''
    const userText = lastUserText(JSON.parse(raw || '{}'))
    const response = userText?.includes('Ilhéus')
      ? FIRST_RESPONSE
      : userText?.includes('Salvador em 2022?')
        ? SECOND_RESPONSE
        : THIRD_RESPONSE
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: [
        'data: {"type":"start"}\n\n',
        'data: {"type":"text-start","id":"t1"}\n\n',
        `data: {"type":"text-delta","id":"t1","delta":${JSON.stringify(response)}}\n\n`,
        'data: {"type":"text-end","id":"t1"}\n\n',
        'data: {"type":"finish","finishReason":"stop"}\n\n',
      ].join(''),
    })
  })

const chipButton = (page: Page, text: string) =>
  page.getByRole('button', { name: text, exact: true })

/**
 * Same hydration flake class as B191: clicks landing before hydration are
 * silent no-ops. Retry until the send actually lands — sending unmounts the
 * chips (`status` flips to busy), which is the unambiguous observable.
 */
const pickChip = async (page: Page, text: string) => {
  await expect(async () => {
    await chipButton(page, text).click({ timeout: 1_000 })
    await expect(chipButton(page, text)).toHaveCount(0, { timeout: 1_000 })
  }).toPass({ timeout: 15_000 })
}

const askViaInput = async (page: Page, text: string, expected: string) => {
  const input = page.getByPlaceholder('Pergunte para o Sollinha...')
  // Dev-mode defense (same as campaignAiLinks): a first-hit route compile can
  // trigger a full-page reload that wipes the draft — re-send until the answer
  // actually lands.
  await expect(async () => {
    await input.fill(text)
    await input.press('Enter')
    await expect(page.getByText(expected)).toBeVisible({ timeout: 10_000 })
  }).toPass({ timeout: 60_000 })
}

test.describe('B192 — follow-ups sugeridos após cada resposta do Sollinha', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await mockAiChat(page)
  })

  test('resposta com bloco: bolha sem o bloco, chips acima do input, tocar envia e o slot é substituído', async ({
    page,
    campaign,
  }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Follow-up Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })

    // B191 gesture opens the conversation; the mock answers with a block.
    await pickChip(page, 'Quantos votos tivemos em Ilhéus em 2022?')
    await expect(page.getByText('Em 2022, o Solla teve 12.345 votos em Ilhéus.')).toBeVisible({
      timeout: 20_000,
    })

    // The block never shows as prose — not even the marker line.
    await expect(page.getByText('Sugestões de continuação')).toHaveCount(0)

    // The three follow-ups occupy the slot; the opening catalog is gone.
    for (const text of [
      'Quantos votos tivemos em Salvador em 2022?',
      'Quem foi o deputado mais votado em Barreiras?',
      'Como está o município de Vitória da Conquista?',
    ]) {
      await expect(chipButton(page, text)).toBeVisible()
    }
    await expect(
      chipButton(page, 'Quem foi o deputado mais votado em Feira de Santana?'),
    ).toHaveCount(0)

    // Touching a follow-up sends it as the user's message and the slot is
    // replaced by the next answer's suggestions.
    await pickChip(page, 'Quantos votos tivemos em Salvador em 2022?')
    await expect(page.getByText('Em 2022, foram 88.765 votos em Salvador.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(chipButton(page, 'Qual a votação em Feira de Santana?')).toBeVisible()
    await expect(chipButton(page, 'Quais dobradinhas temos em Salvador?')).toBeVisible()
    await expect(chipButton(page, 'Como está o município de Vitória da Conquista?')).toHaveCount(0)

    // An answer without a block empties the slot (fail-closed, no error).
    await pickChip(page, 'Quais dobradinhas temos em Salvador?')
    await expect(page.getByText('Os dados de 2026 ainda não existem.')).toBeVisible({
      timeout: 20_000,
    })
    await expect(chipButton(page, 'Qual a votação em Feira de Santana?')).toHaveCount(0)
    await expect(page.getByText('Sugestões de continuação')).toHaveCount(0)
  })

  test('drawer mobile: no máximo 2 follow-ups por resposta', async ({ page, campaign }) => {
    await page.setViewportSize({ width: 500, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('advisor', {
      name: campaign.fixtures.value('Follow-up Assessor'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    const drawer = page.getByRole('dialog', { name: 'Sollinha — Assistente virtual' })
    await page.getByRole('button', { name: 'Sollinha — Assistente virtual' }).click()
    await expect(drawer).toBeVisible({ timeout: 20_000 })

    await askViaInput(
      page,
      'Quantos votos tivemos em Ilhéus em 2022?',
      'Em 2022, o Solla teve 12.345 votos em Ilhéus.',
    )
    await expect(page.getByText('Em 2022, o Solla teve 12.345 votos em Ilhéus.')).toBeVisible({
      timeout: 20_000,
    })

    await expect(chipButton(page, 'Quantos votos tivemos em Salvador em 2022?')).toBeVisible()
    await expect(chipButton(page, 'Quem foi o deputado mais votado em Barreiras?')).toBeVisible()
    await expect(chipButton(page, 'Como está o município de Vitória da Conquista?')).toHaveCount(0)
    await expect(page.getByText('Sugestões de continuação')).toHaveCount(0)
  })

  test('resposta sem bloco: sem chips e sem erro (fail-closed)', async ({ page, campaign }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Follow-up Sem Bloco'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
    await askViaInput(page, 'Os dados de 2026 já existem?', 'Os dados de 2026 ainda não existem.')
    await expect(page.getByText('Os dados de 2026 ainda não existem.')).toBeVisible({
      timeout: 20_000,
    })

    await expect(chipButton(page, 'Quantos votos tivemos em Salvador em 2022?')).toHaveCount(0)
    await expect(page.getByText('Sugestões de continuação')).toHaveCount(0)
  })
})
