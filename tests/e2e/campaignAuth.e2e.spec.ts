import { CAMPAIGN_SESSION_TTL_LONG } from '../../src/lib/campaignSessionTtl.js'
import { expect, test } from './fixtures/campaignE2EFixtures.js'

test('logs in with a remembered fourteen-day campaign session', async ({
  campaign,
  context,
  page,
}) => {
  test.slow()
  const { fixtures } = campaign
  const email = `${fixtures.value('remembered-user')}@example.com`
  const password = fixtures.value('password')
  await campaign.payload.create({
    collection: 'campaignUser',
    data: {
      name: fixtures.value('Usuária lembrada'),
      email,
      password,
      role: 'advisor',
    },
    depth: 0,
  })

  await page.goto('/campanha/login')
  const rememberMe = page.getByRole('checkbox', {
    name: 'Lembrar de mim neste dispositivo',
  })
  await expect(rememberMe).toBeVisible()
  await expect(rememberMe).not.toBeChecked()
  await page.getByLabel('E-mail ou celular').fill(email)
  await page.getByLabel('Senha').fill(password)
  await rememberMe.check()
  const loggedInAt = Math.floor(Date.now() / 1000)
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.waitForURL(/\/campanha$/)

  const tokenCookie = (await context.cookies()).find((cookie) => cookie.name === 'campaign-token')
  expect(tokenCookie?.expires).toBeGreaterThan(loggedInAt + CAMPAIGN_SESSION_TTL_LONG - 60)
})
