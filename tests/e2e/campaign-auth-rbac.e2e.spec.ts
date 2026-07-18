/* eslint-disable check-file/filename-naming-convention */
import { test, expect } from './fixtures/campaignE2EFixtures'

test.describe('Campaign authentication and role scope', () => {
  test.describe.configure({ mode: 'parallel' })

  test('supports keyboard login and declares native autofill semantics', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('auth')}@example.com`
    const password = campaign.fixtures.value('AuthPassword')
    await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação auth'),
          email,
          password,
          role: 'geral',
        },
        depth: 0,
        req,
      })
    })

    await page.goto(`${campaign.baseURL}/campanha/login`)
    const identifier = page.getByLabel('E-mail ou celular')
    const passwordInput = page.getByLabel('Senha')
    const submit = page.getByRole('button', { name: 'Entrar' })

    await expect(identifier).toHaveAttribute('autocomplete', 'username')
    await expect(passwordInput).toHaveAttribute('autocomplete', 'current-password')
    await identifier.fill(email)
    await identifier.press('Tab')
    await expect(passwordInput).toBeFocused()
    await passwordInput.fill(password)
    await passwordInput.press('Tab')
    await expect(submit).toBeFocused()
    await submit.press('Enter')
    await page.waitForURL(`${campaign.baseURL}/campanha`)
    const campaignCookie = (await page.context().cookies()).find(
      ({ name }) => name === 'campaign-token',
    )
    expect(campaignCookie).toMatchObject({
      httpOnly: true,
      path: '/campanha',
      sameSite: 'Lax',
    })
    expect(campaignCookie?.value).toBeTruthy()
  })

  test('returns not found instead of disclosing a foreign nucleus to a coordinator', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const email = `${campaign.fixtures.value('coordinator')}@example.com`
    const password = campaign.fixtures.value('CoordinatorPassword')
    const foreignName = campaign.fixtures.value('Núcleo restrito')
    const foreign = await campaign.transaction(async (payload, req) => {
      await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação restrita'),
          email,
          password,
          role: 'coordenador',
        },
        depth: 0,
        req,
      })
      return payload.create({
        collection: 'electoralNucleus',
        data: {
          name: foreignName,
          cities: ['Salvador'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
    })

    await campaign.login(page, email, password)
    await page.goto(`${campaign.baseURL}/campanha/nucleos/${foreign.slug}`)
    await expect(page.getByText('Núcleo não encontrado', { exact: true })).toBeVisible()
    await expect(page.getByText(foreignName, { exact: true })).toHaveCount(0)
  })

  test('lets an engaged leadership use phone login without receiving internal evaluation', async ({
    campaign,
    page,
  }) => {
    test.slow()
    const phone = campaign.fixtures.phone()
    const ownEmail = `${campaign.fixtures.value('leader-contact')}@example.com`
    const password = campaign.fixtures.value('LeadershipPassword')
    const nucleusName = campaign.fixtures.value('Núcleo da liderança')
    const privateNote = campaign.fixtures.value('AVALIAÇÃO INTERNA NÃO SERIALIZAR')
    const privateConsentNote = campaign.fixtures.value('CONSENT NOTE PRÓPRIO NÃO SERIALIZAR')
    const privateConsentHash = campaign.fixtures.value('CONSENT HASH PRÓPRIO NÃO SERIALIZAR')
    const foreignEmail = `${campaign.fixtures.value('foreign-contact')}@example.com`
    const foreignPhone = campaign.fixtures.phone()
    const foreignNote = campaign.fixtures.value('PII FORA DO ESCOPO NÃO SERIALIZAR')
    const foreignConsentHash = campaign.fixtures.value('HASH FORA DO ESCOPO NÃO SERIALIZAR')
    const setup = await campaign.transaction(async (payload, req) => {
      const staff = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Coordenação'),
          email: `${campaign.fixtures.value('staff')}@example.com`,
          password: campaign.fixtures.value('StaffPassword'),
          role: 'geral',
        },
        depth: 0,
        req,
      })
      const leader = await payload.create({
        collection: 'campaignUser',
        data: {
          name: campaign.fixtures.value('Liderança'),
          username: phone,
          phone,
          password,
          role: 'lideranca',
        },
        depth: 0,
        req,
      })
      const nucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: nucleusName,
          cities: ['Salvador'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      const foreignNucleus = await payload.create({
        collection: 'electoralNucleus',
        data: {
          name: campaign.fixtures.value('Núcleo fora do escopo'),
          cities: ['Salvador'],
          organizationKind: 'territorial',
        } as never,
        depth: 0,
        req,
      })
      const contact = await payload.create({
        collection: 'contact',
        data: {
          name: leader.name,
          email: ownEmail,
          phone,
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        req,
      })
      await payload.create({
        collection: 'leadership',
        data: {
          contact: contact.id,
          nucleus: nucleus.id,
          supportStatus: 'engajado',
          notes: privateNote,
          consentNote: privateConsentNote,
          consentContentHash: privateConsentHash,
          user: leader.id,
          createdBy: staff.id,
        },
        depth: 0,
        req,
      })
      const foreignContact = await payload.create({
        collection: 'contact',
        data: {
          name: campaign.fixtures.value('Contato fora do escopo'),
          email: foreignEmail,
          phone: foreignPhone,
          state: 'BA',
          city: 'Salvador',
        },
        depth: 0,
        req,
      })
      await payload.create({
        collection: 'leadership',
        data: {
          contact: foreignContact.id,
          nucleus: foreignNucleus.id,
          supportStatus: 'engajado',
          notes: foreignNote,
          consentNote: foreignNote,
          consentContentHash: foreignConsentHash,
          createdBy: staff.id,
        },
        depth: 0,
        req,
      })
      return { leader, nucleus }
    })

    await campaign.login(page, `+55 (${phone.slice(0, 2)}) ${phone.slice(2)}`, password)
    const leadershipURL = `${campaign.baseURL}/campanha/nucleos/${setup.nucleus.slug}?tab=leaderships`
    await page.goto(leadershipURL)
    await expect(page.getByRole('heading', { name: nucleusName })).toBeVisible()
    await expect(page.getByText(ownEmail, { exact: true })).toBeVisible()
    await expect(page.getByText(privateNote)).toHaveCount(0)
    await expect(page.getByText('Observações internas')).toHaveCount(0)
    const htmlResponse = await page.request.get(leadershipURL)
    const flightResponse = await page.request.get(`${leadershipURL}&_rsc=leader-privacy`, {
      headers: { RSC: '1' },
    })
    expect(htmlResponse.ok()).toBe(true)
    expect(flightResponse.ok()).toBe(true)
    for (const body of await Promise.all([htmlResponse.text(), flightResponse.text()])) {
      expect(body).toContain(ownEmail)
      expect(body.replace(/\D/g, '')).toContain(phone)
      for (const privateValue of [
        privateNote,
        privateConsentNote,
        privateConsentHash,
        setup.leader.hash,
        setup.leader.salt,
        foreignEmail,
        foreignPhone,
        foreignNote,
        foreignConsentHash,
      ].filter((value): value is string => Boolean(value))) {
        expect(body).not.toContain(privateValue)
      }
    }
  })
})
