/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign leadership and invite journeys', () => {
  test.describe.configure({ mode: 'parallel' })

  test('creates a leadership with native contact autofill fields', async ({ campaign, page }) => {
    test.slow()
    const email = `${campaign.fixtures.value('leadership-form')}@example.com`
    const password = campaign.fixtures.value('LeadershipFormPassword')
    const createdName = campaign.fixtures.value('Liderança cadastrada')
    const createdPhone = campaign.fixtures.phone()
    const nucleus = await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação liderança'),
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
          name: campaign.fixtures.value('Núcleo liderança'),
          regions: ['Irecê'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    await page.goto(
      `${campaign.baseURL}/campanha/nucleos/${nucleus.slug}?tab=leaderships&newLeadership=1`,
    )
    await page.waitForLoadState('networkidle')
    const name = page.getByLabel('Nome *')
    const phone = page.getByLabel('Celular (WhatsApp) *')
    const contactEmail = page.getByLabel('E-mail')
    await expect(name).toHaveAttribute('autocomplete', 'name')
    await expect(phone).toHaveAttribute('autocomplete', 'tel')
    await expect(contactEmail).toHaveAttribute('autocomplete', 'email')
    await name.fill(createdName)
    await phone.fill(createdPhone)
    await page.getByRole('radio', { name: 'Engajado', exact: true }).click()
    await page.getByRole('button', { name: 'Cadastrar liderança' }).click()

    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 })
    await expect(page.getByRole('link', { name: `Abrir ficha de ${createdName}` })).toBeVisible({
      timeout: 20_000,
    })
    const contacts = await campaign.payload.find({
      collection: 'contact',
      where: { phone: { equals: createdPhone } },
      depth: 0,
      limit: 2,
    })
    expect(contacts.totalDocs).toBe(1)
  })

  test('preserves panel history and focus without serializing unselected private data', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('panel')}@example.com`
    const password = campaign.fixtures.value('PanelPassword')
    const targetName = campaign.fixtures.value('Liderança alvo')
    const unselectedEmail = `${campaign.fixtures.value('private-contact')}@example.com`
    const unselectedNotes = campaign.fixtures.value('NOTAS INTERNAS NÃO SERIALIZAR')
    const unselectedConsentNote = campaign.fixtures.value('CONSENT NOTE NÃO SERIALIZAR')
    const unselectedConsentHash = campaign.fixtures.value('CONSENT HASH NÃO SERIALIZAR')
    const unselectedAuthEmail = `${campaign.fixtures.value('private-auth')}@example.com`
    const unselectedUsername = campaign.fixtures.phone()
    const unselectedPhone = campaign.fixtures.phone()
    const inviteTokenHash = campaign.fixtures.value('TOKEN HASH NÃO SERIALIZAR')
    const setup = await campaign.transaction(async (payload, req) => {
      const staff = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação painel'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo painel'),
          cities: ['Salvador'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      const target = await payload.create({
        collection: 'contact',
        data: {
          name: targetName,
          phone: campaign.fixtures.phone(),
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        req,
      })
      const targetLeadership = await payload.create({
        collection: 'leadership',
        data: {
          contact: target.id,
          nucleus: nucleus.id,
          supportStatus: 'engajado',
          createdBy: staff.id,
        },
        depth: 0,
        req,
      })
      const unselected = await payload.create({
        collection: 'contact',
        data: {
          name: campaign.fixtures.value('Liderança não selecionada'),
          email: unselectedEmail,
          phone: unselectedPhone,
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        req,
      })
      const unselectedUser = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Conta privada não selecionada'),
          email: unselectedAuthEmail,
          username: unselectedUsername,
          password: campaign.fixtures.value('PrivateAuthPassword'),
          role: 'lideranca',
        },
        depth: 0,
        req,
      })
      const unselectedLeadership = await payload.create({
        collection: 'leadership',
        data: {
          contact: unselected.id,
          nucleus: nucleus.id,
          supportStatus: 'engajado',
          notes: unselectedNotes,
          consentNote: unselectedConsentNote,
          consentContentHash: unselectedConsentHash,
          user: unselectedUser.id,
          createdBy: staff.id,
        },
        depth: 0,
        req,
      })
      await payload.create({
        collection: 'campaignInvite',
        data: {
          tokenHash: inviteTokenHash,
          leadership: unselectedLeadership.id,
          kind: 'login',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          createdBy: staff.id,
        },
        depth: 0,
        req,
      })
      return { nucleus, targetLeadership, unselectedUser }
    })

    await page.setViewportSize({ width: 1440, height: 900 })
    await campaign.login(page, email, password)
    const listURL = `${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}?tab=leaderships`
    await page.goto(listURL)
    await page.waitForLoadState('networkidle')
    const origin = page.getByRole('link', { name: `Abrir ficha de ${targetName}` })
    await origin.click()
    await expect(page.getByRole('heading', { name: targetName, exact: true })).toBeVisible({
      timeout: 20_000,
    })
    expect(new URL(page.url()).searchParams.get('leadership')).toBe(
      String(setup.targetLeadership.id),
    )
    await page.getByRole('link', { name: 'Editar avaliação' }).click()
    await page.goBack()
    await expect(page).toHaveURL(listURL)
    await origin.click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(listURL)
    await expect(origin).toBeFocused()

    const htmlResponse = await page.request.get(
      `${listURL}&leadership=${setup.targetLeadership.id}`,
    )
    const flightResponse = await page.request.get(
      `${listURL}&leadership=${setup.targetLeadership.id}&_rsc=privacy`,
      { headers: { RSC: '1' } },
    )
    expect(htmlResponse.ok()).toBe(true)
    expect(flightResponse.ok()).toBe(true)
    const transports = await Promise.all([htmlResponse.text(), flightResponse.text()])
    for (const body of transports) {
      expect(body.replace(/\D/g, '')).toContain(unselectedPhone)
      for (const privateValue of [
        unselectedEmail,
        unselectedNotes,
        unselectedConsentNote,
        unselectedConsentHash,
        unselectedAuthEmail,
        unselectedUsername,
        setup.unselectedUser.hash,
        setup.unselectedUser.salt,
        inviteTokenHash,
      ].filter((value): value is string => Boolean(value))) {
        expect(body).not.toContain(privateValue)
      }
    }
  })

  test('creates a secure WhatsApp invite URL and serves its public page privately', async ({
    campaign,
    page,
  }) => {
    test.slow()
    await campaign.withInviteConsent(campaign.payload, async () => {
      const email = `${campaign.fixtures.value('invite')}@example.com`
      const password = campaign.fixtures.value('InvitePassword')
      const leaderName = campaign.fixtures.value('Liderança convidada')
      const phone = campaign.fixtures.phone()
      const setup = await campaign.transaction(async (payload, req) => {
        const staff = await payload.create({
          collection: 'campaignUser',
          data: {
            name: campaign.fixtures.value('Coordenação convite'),
            email,
            password,
            role: 'geral',
          },
          depth: 0,
          req,
        })
        const nucleus = await payload.create({
          collection: 'electoralNucleus',
          data: {
            name: campaign.fixtures.value('Núcleo convite'),
            cities: ['Salvador'],
            organizationKind: 'territorial',
          } as never,
          depth: 0,
          req,
        })
        const contact = await payload.create({
          collection: 'contact',
          data: { name: leaderName, phone, state: 'BA', city: 'Salvador' },
          depth: 0,
          req,
        })
        const leadership = await payload.create({
          collection: 'leadership',
          data: {
            contact: contact.id,
            nucleus: nucleus.id,
            supportStatus: 'engajado',
            createdBy: staff.id,
          },
          depth: 0,
          req,
        })
        return { nucleus, leadership }
      })

      await page.addInitScript(() => {
        const browserWindow = window as typeof window & { __openedWhatsApp?: string }
        browserWindow.open = ((url?: string | URL) => {
          browserWindow.__openedWhatsApp = String(url)
          return null
        }) as typeof window.open
      })
      await campaign.login(page, email, password)
      await page.goto(
        `${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}?tab=leaderships&leadership=${setup.leadership.id}`,
      )
      await page.getByRole('button', { name: 'Convidar pelo WhatsApp' }).click()
      await page.getByRole('button', { name: 'Criar convite' }).click()
      await page.getByRole('button', { name: 'Abrir WhatsApp' }).click()
      const openedURL = await page.evaluate(
        () => (window as typeof window & { __openedWhatsApp?: string }).__openedWhatsApp,
      )
      expect(openedURL).toMatch(/^https:\/\/wa\.me\/5571\d{9}\?text=/)
      const inviteURL = new URL(openedURL!).searchParams.get('text')?.match(/https?:\/\/\S+$/)?.[0]
      expect(inviteURL).toMatch(new RegExp(`^${campaign.baseURL}/campanha/convite/`))

      const outbound: string[] = []
      page.on('request', (request) => {
        if (new URL(request.url()).origin !== campaign.baseURL) outbound.push(request.url())
      })
      const response = await page.goto(inviteURL!)
      expect(response?.headers()['cache-control']).toContain('no-store')
      await expect(page.getByText(`Oi, ${leaderName}!`, { exact: true })).toBeVisible()
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
      await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')
      expect(outbound).toEqual([])
    })
  })
})
