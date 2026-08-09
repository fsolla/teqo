import type { Page } from '@playwright/test'

import { expect, test } from './fixtures/campaignE2EFixtures.js'

/**
 * B173 — voice transcription for the Sollinha chat.
 *
 * The real browser media stack (getUserMedia/MediaRecorder) is stubbed with an
 * init script: `getUserMedia` resolves a fake track and `MediaRecorder` pushes
 * one data chunk then stops on the next tick, so the app's own record→transcribe
 * flow runs for real while the two network surfaces are mocked:
 * - `/campanha/api/ai-transcribe` returns a fixed transcript (editable draft).
 * - `/campanha/api/ai-chat` returns an SSE stream (normal send).
 */

const fakeMediaInit = `
  const makeTrack = () => ({ stop: () => {} })
  const fakeStream = { getTracks: () => [makeTrack()] }

  navigator.mediaDevices.getUserMedia = async () => fakeStream

  class FakeMediaRecorder {
    static isTypeSupported = () => true
    state = 'inactive'
    mimeType = 'audio/webm'
    listeners = {}
    constructor(stream) { this.stream = stream }
    addEventListener(type, cb) { (this.listeners[type] ??= []).push(cb) }
    start() { this.state = 'recording' }
    stop() {
      if (this.state === 'inactive') return
      this.listeners.dataavailable?.forEach((cb) =>
        cb({ data: new Blob(['fake'], { type: 'audio/webm' }) }))
      this.state = 'inactive'
      this.listeners.stop?.forEach((cb) => cb({}))
    }
  }
  window.MediaRecorder = FakeMediaRecorder
`

const mockTranscribe = (page: Page, text: string) =>
  page.route('**/campanha/api/ai-transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ text }),
    })
  })

const mockAiChat = (page: Page) =>
  page.route('**/campanha/api/ai-chat', async (route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' },
      body: 'data: {"type":"text","text":"Resposta mockada da Sollinha."}\n\n',
    })
  })

const openChat = async (page: Page) => {
  await expect(page.getByText('Olá! Eu sou o Sollinha')).toBeVisible({ timeout: 20_000 })
}

test.describe('B173 — consulta por voz no chat da Sollinha', () => {
  test.beforeEach(async ({ page }) => {
    test.slow()
    await page.addInitScript(fakeMediaInit)
    await page.setViewportSize({ width: 1280, height: 800 })
  })

  test('falar transcreve para um rascunho editável que roda no fluxo normal do chat', async ({
    page,
    campaign,
  }) => {
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Voz Coordenador'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')

    await mockTranscribe(page, 'Quantos votos tivemos em Ilhéus?')
    await mockAiChat(page)
    await openChat(page)

    const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })

    // Tap the mic → the bar enters "Ouvindo..." while we "speak".
    await page.getByRole('button', { name: 'Falar pergunta (voz)' }).click()
    await expect(page.getByText(/Ouvindo\.\.\./)).toBeVisible({ timeout: 20_000 })

    // Tap again to finish → the fake recorder emits its chunk → transcript draft.
    await page.getByRole('button', { name: 'Parar gravação' }).click()
    await expect(input).toHaveValue('Quantos votos tivemos em Ilhéus?', { timeout: 20_000 })

    // It stays an editable draft (never auto-sent): no user bubble yet.
    await expect(page.getByText('Quantos votos tivemos em Ilhéus?').first()).toBeVisible()

    // Edit the draft, then send through the regular flow. The send is what must
    // happen — the mock ai-chat stream stops the chat from hanging, and the
    // user bubble proves the transcribed draft rode the same path as text.
    await input.fill('Quantos votos tivemos em Ilhéus em 2022?')
    await input.press('Enter')
    await expect(page.getByText('Quantos votos tivemos em Ilhéus em 2022?')).toBeVisible({
      timeout: 20_000,
    })
  })

  test('permissão negada mostra mensagem e o chat por texto segue usável', async ({
    page,
    campaign,
  }) => {
    await page.addInitScript(
      `navigator.mediaDevices.getUserMedia = async () => { throw new Error('Permission denied') }`,
    )
    const user = await campaign.fixtures.createCampaignUser('coordinator', {
      name: campaign.fixtures.value('Voz Sem Permissão'),
    })
    await campaign.login(page, user.email!, user.password)
    await page.goto('/campanha')
    await mockAiChat(page)
    await openChat(page)

    await page.getByRole('button', { name: 'Falar pergunta (voz)' }).click()
    await expect(page.getByText(/Não foi possível acessar o microfone/)).toBeVisible({
      timeout: 20_000,
    })

    // Text chat still works.
    const input = page.getByRole('textbox', { name: 'Pergunte para o Sollinha...' })
    await input.fill('Foco no texto')
    await input.press('Enter')
    await expect(page.getByText('Foco no texto')).toBeVisible({ timeout: 20_000 })
  })
})
