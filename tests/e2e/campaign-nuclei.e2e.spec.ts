/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign nucleus journeys', () => {
  test.describe.configure({ mode: 'parallel' })

  test('creates a nucleus with interactive sorted TSE tags', async ({ campaign, page }) => {
    test.setTimeout(240_000)
    const generalEmail = `${campaign.fixtures.value('general')}@example.com`
    const password = campaign.fixtures.value('NucleusPassword')
    const nucleusName = campaign.fixtures.value('Núcleo criado')
    const general = await campaign.transaction(async (payload, req) => {
      const general = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação Geral'),
          email: generalEmail,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      return general
    })

    await campaign.login(page, generalEmail, password)
    await page.goto(`${campaign.baseURL}/campanha/nucleos/novo`)
    await page.getByLabel('Nome do núcleo *').fill(nucleusName)
    await page.getByLabel('Território de identidade').fill('Irecê')
    await page.getByRole('option', { name: 'Irecê', exact: true }).click()
    const zoneInput = page.getByLabel('Adicionar Zona TSE')
    await zoneInput.pressSequentially('58,12 58')
    await zoneInput.press('Enter')
    const zoneGroup = zoneInput.locator('xpath=ancestor::*[@data-slot="input-group"]')
    await expect(zoneGroup.locator('[data-slot="badge"]')).toHaveText(['12', '58'])
    await expect(zoneGroup.getByRole('button', { name: 'Remover Zona TSE 58' })).toHaveCount(1)
    await page.getByText(`${general.name} (você)`, { exact: true }).click()
    await page.getByRole('button', { name: 'Criar núcleo' }).click()
    await expect
      .poll(
        async () =>
          (
            await campaign.payload.find({
              collection: 'electoralNucleus',
              where: { name: { equals: nucleusName } },
              depth: 0,
              limit: 1,
            })
          ).docs[0],
        { timeout: 30_000 },
      )
      .toBeTruthy()
    const created = await campaign.payload.find({
      collection: 'electoralNucleus',
      where: { name: { equals: nucleusName } },
      depth: 0,
      limit: 1,
    })
    expect(created.docs[0]?.coordinators).toContain(general.id)
    expect(created.docs[0]?.tseZones?.map(({ zoneNumber }) => zoneNumber)).toEqual([12, 58])
  })

  test('updates coordinator assignment from the nucleus detail', async ({ campaign, page }) => {
    test.slow()
    const email = `${campaign.fixtures.value('assignment')}@example.com`
    const password = campaign.fixtures.value('AssignmentPassword')
    const setup = await campaign.transaction(async (payload, req) => {
      const general = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação Geral'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const coordinator = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenador designado'),
          email: `${campaign.fixtures.value('assigned')}@example.com`,
          password,
          role: 'coordenador',
        },
        depth: 0,
        req,
      })
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo designação'),
          city: 'Salvador',
          coordinators: [general.id],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      return { coordinator, nucleus }
    })

    await campaign.login(page, email, password)
    await page.goto(`${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}`)
    await page.waitForLoadState('networkidle')
    await page.getByRole('button', { name: 'Alterar coordenadores' }).click()
    const option = page.getByRole('checkbox', { name: setup.coordinator.name })
    await option.click()
    await page.getByRole('button', { name: 'Salvar coordenação' }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 45_000 })
    await expect(page.getByText(setup.coordinator.name, { exact: true })).toBeVisible({
      timeout: 20_000,
    })
    const persisted = await campaign.payload.findByID({
      collection: 'electoralNucleus',
      id: setup.nucleus.id,
      depth: 0,
    })
    expect(persisted.coordinators).toContain(setup.coordinator.id)
  })

  test('reacts to filters, preserves params, and follows real Back and Forward history', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('filters')}@example.com`
    const password = campaign.fixtures.value('FilterPassword')
    const nucleusName = campaign.fixtures.value('Núcleo filtros')
    const nucleus = await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação filtros'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      return payload.create({
        collection: 'electoralNucleus',
        data: {
          name: nucleusName,
          city: 'Salvador',
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    await page.goto(
      `${campaign.baseURL}/campanha/nucleos?q=${encodeURIComponent(nucleusName)}&page=3`,
    )
    await page.waitForLoadState('networkidle')
    await page.getByLabel('Cobertura').selectOption('sem_coordenador')
    await expect
      .poll(() => new URL(page.url()).searchParams.get('coverage'), { timeout: 45_000 })
      .toBe('sem_coordenador')
    expect(new URL(page.url()).searchParams.get('q')).toBe(nucleusName)
    expect(new URL(page.url()).searchParams.get('page')).toBeNull()
    const filteredURL = page.url()

    await page.goto(`${campaign.baseURL}/campanha/nucleos/${nucleus.slug}`)
    await page.goBack()
    await expect(page).toHaveURL(filteredURL)
    await expect(page.getByLabel('Cobertura')).toHaveValue('sem_coordenador')
    await page.goForward()
    await expect(page).toHaveURL(
      `${campaign.baseURL}/campanha/nucleos/${nucleus.slug}?tab=overview`,
    )
  })

  test('keeps every tab trigger unclipped and the campaign shell within each target viewport', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('responsive')}@example.com`
    const password = campaign.fixtures.value('ResponsivePassword')
    const nucleus = await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação responsiva'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      return payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo responsivo'),
          city: 'Salvador',
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    for (const width of [360, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`${campaign.baseURL}/campanha/nucleos/${nucleus.slug}?tab=territory`)
      const nav = page.getByRole('navigation', { name: 'Seções do núcleo' })
      const geometry = await nav.evaluate((element) => {
        const navRect = element.getBoundingClientRect()
        return {
          clientWidth: element.clientWidth,
          scrollWidth: element.scrollWidth,
          links: Array.from(element.querySelectorAll('a')).map((link) => {
            const rect = link.getBoundingClientRect()
            return {
              top: rect.top - navRect.top,
              bottom: navRect.bottom - rect.bottom,
              width: rect.width,
            }
          }),
          documentFits:
            document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        }
      })
      expect(geometry.links).toHaveLength(5)
      expect(geometry.documentFits).toBe(true)
      for (const link of geometry.links) {
        expect(link.top).toBeGreaterThanOrEqual(0)
        expect(link.bottom).toBeGreaterThanOrEqual(0)
        expect(link.width).toBeGreaterThan(0)
      }
      if (width >= 768) expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth)
      else expect(geometry.scrollWidth).toBeGreaterThan(geometry.clientWidth)
    }
  })
})
