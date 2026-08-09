import type { BrowserContext, Page } from '@playwright/test'

import { CAMPAIGN_SESSION_TTL_LONG } from '../../src/lib/campaignSessionTtl.js'
import { CAMPAIGN_BIOMETRICS_PROMPT_DISMISSED_KEY } from '../../src/utilities/campaignBiometricsPrompt.js'
import { expect, expectCampaignBiometricsReady, test } from './fixtures/campaignE2EFixtures.js'

/**
 * Biometric login (B40) end to end, against a **virtual authenticator** driven
 * over CDP: `WebAuthn.addVirtualAuthenticator` with `transport: 'internal'` +
 * `hasUserVerification` is what makes
 * `isUserVerifyingPlatformAuthenticatorAvailable()` answer `true` and lets the
 * ceremonies complete headlessly. Without it neither island even mounts, so
 * this is the only way to cover the flow at all.
 */
const addVirtualAuthenticator = async (context: BrowserContext, page: Page): Promise<void> => {
  const cdp = await context.newCDPSession(page)
  await cdp.send('WebAuthn.enable')
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      // Pre-verified: the virtual authenticator cannot show a fingerprint
      // sheet, and every ceremony here requires user verification.
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  })
}

/**
 * The first ceremony of the run pays for compiling two route handlers in the dev
 * server, which under load is well past the 5 s default. Generous only where the
 * wait is a compile, never as a blanket setting.
 */
const CEREMONY_TIMEOUT = 60_000

/**
 * The enrollment toast would cover the profile card it is advertising. The key
 * travels as an argument rather than as a literal inside the init script, so a
 * rename cannot silently stop silencing it.
 */
const silenceEnrollmentToast = (context: BrowserContext) =>
  context.addInitScript((key: string) => {
    window.localStorage.setItem(key, '1')
  }, CAMPAIGN_BIOMETRICS_PROMPT_DISMISSED_KEY)

// Step 3 signs in with a revoked passkey, and the refusal is a handled 400 that
// the browser still logs as a failed request — declared here so the shared
// failure guard does not read it as a bug.
test.use({ expectedRequestFailurePaths: ['/campanha/webauthn/login'] })

test('enrolls a passkey, signs in with it, then revokes it', async ({
  campaign,
  context,
  page,
}) => {
  test.slow()
  const { fixtures } = campaign
  const biometricUser = await fixtures.createCampaignUser('advisor', {
    name: fixtures.value('Assessora com biometria'),
  })
  const email = biometricUser.email!
  const password = biometricUser.password

  await silenceEnrollmentToast(context)
  await addVirtualAuthenticator(context, page)

  // 1. Enrollment is authenticated: the passkey card only exists behind a
  //    password login. The platform answer is gated BEFORE the profile island
  //    runs its one-shot probe (miss #53).
  await campaign.login(page, email, password)
  await expectCampaignBiometricsReady(page)
  await page.goto('/campanha/perfil')

  // `.nth(0)`: during hydration the server-composed slot can briefly coexist
  // with its re-rendered copy (same transient duplicate the municipios spec
  // pins for "Otimista: 5.000") — the copy settles to one element.
  await expect(page.getByText('Nenhum aparelho cadastrado ainda.').nth(0)).toBeVisible()

  const deviceLabel = page.getByLabel('Nome deste aparelho')
  await expect(deviceLabel).toBeVisible()
  await deviceLabel.fill('Celular da assessora')
  await page.getByRole('button', { name: 'Ativar neste aparelho' }).click()

  await expect(page.getByText('Celular da assessora')).toBeVisible({ timeout: CEREMONY_TIMEOUT })
  await expect(page.getByText('Nenhum aparelho cadastrado ainda.')).toBeHidden()

  // 2. Password-less sign-in issues the 14-day cookie — enrolling the device IS
  //    the "remember me" opt-in, so there is no checkbox in this path.
  await context.clearCookies()
  await page.goto('/campanha/login')
  await expectCampaignBiometricsReady(page)
  const biometricButton = page.getByRole('button', { name: 'Entrar com digital ou Face ID' })
  await expect(biometricButton).toBeVisible()

  const signedInAt = Math.floor(Date.now() / 1000)
  await biometricButton.click()
  await page.waitForURL(/\/campanha$/)

  const tokenCookie = (await context.cookies()).find((cookie) => cookie.name === 'campaign-token')
  expect(tokenCookie?.expires).toBeGreaterThan(signedInAt + CAMPAIGN_SESSION_TTL_LONG - 120)

  // 3. Revocation is the answer to "my phone is gone", so it has to work from
  //    the profile and it has to actually stop the credential.
  await page.goto('/campanha/perfil')
  await page.getByRole('button', { name: 'Remover Celular da assessora' }).click()
  await expect(page.getByText('Nenhum aparelho cadastrado ainda.')).toBeVisible()

  await context.clearCookies()
  await page.goto('/campanha/login')
  await page.getByRole('button', { name: 'Entrar com digital ou Face ID' }).click()
  // The device still holds its private key, so the ceremony itself succeeds and
  // the refusal must come from the server not knowing the credential anymore.
  await expect(
    page.getByRole('alert').filter({ hasText: /não está mais autorizado/i }),
  ).toBeVisible({ timeout: CEREMONY_TIMEOUT })
  await expect(page).toHaveURL(/\/campanha\/login/)
})
