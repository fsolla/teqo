import {
  createCampaignOwnership,
  expect,
  mintCampaignSession,
  seedCampaignSession,
  test,
  type CampaignE2EOwnership,
  type CampaignSessionUser,
} from './fixtures/campaignE2EFixtures.js'

test.use({ viewport: { width: 390, height: 844 } })

/**
 * OPS36 — one shared staff session per worker (see the sibling comment in
 * campaignHomeActions.e2e.spec.ts): coordinator + leader are created once,
 * each test's fresh context receives the matching `campaign-token` cookie,
 * and the group rows are cleaned up in `afterAll`.
 */
let sharedFixtures: CampaignE2EOwnership
let sharedCoordinator: CampaignSessionUser
let coordinatorToken: string
let sharedLeader: CampaignSessionUser
let leaderToken: string

test.beforeAll(async () => {
  sharedFixtures = await createCampaignOwnership()
  sharedCoordinator = await sharedFixtures.createCampaignUser('coordinator', {
    name: sharedFixtures.value('Coordenadora Compartilhada'),
  })
  coordinatorToken = await mintCampaignSession(sharedFixtures.payload, sharedCoordinator)
  sharedLeader = await sharedFixtures.createCampaignUser('leader', {
    name: sharedFixtures.value('Liderança Compartilhada'),
  })
  leaderToken = await mintCampaignSession(sharedFixtures.payload, sharedLeader)
})

test.beforeEach(async ({ campaign, context }) => {
  await seedCampaignSession(context, campaign.baseURL, coordinatorToken)
})

test.afterAll(async () => {
  if (!sharedFixtures) return
  await sharedFixtures.cleanup()
  await sharedFixtures.expectNoOwnedRows()
})

test.describe('Mobile bottom nav (B164)', () => {
  test('staff sees five-item bottom nav', async ({ page }) => {
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')
    await expect(bottomNav).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Início' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Municípios' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Atualizações' })).toBeVisible()
    await expect(bottomNav.getByRole('link', { name: 'Agenda' })).toBeVisible()
    await expect(bottomNav.getByRole('button', { name: 'Mais' })).toBeVisible()
  })

  test('highlights active item and navigates on tap', async ({ page }) => {
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')

    // Início is active on /campanha
    await expect(bottomNav.getByRole('link', { name: 'Início' })).toHaveAttribute(
      'aria-current',
      'page',
    )

    // Navigate to Municípios — active state moves
    await bottomNav.getByRole('link', { name: 'Municípios' }).click()
    await expect(page).toHaveURL(/\/campanha\/municipios\/?$/)
    await expect(bottomNav.getByRole('link', { name: 'Municípios' })).toHaveAttribute(
      'aria-current',
      'page',
    )
    await expect(bottomNav.getByRole('link', { name: 'Início' })).not.toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  test('Mais opens overflow drawer with secondary destinations', async ({ page }) => {
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')
    // Client-side drawer state — a click that lands before hydration is a
    // silent no-op (the B13/B17 flake class; with the shared-session seed the
    // page is often the worker's first load, so guard the transition).
    await expect(async () => {
      await bottomNav.getByRole('button', { name: 'Mais' }).click({ timeout: 1_000 })
      await expect(page.locator('[data-slot="drawer-content"]')).toBeVisible({ timeout: 5_000 })
    }).toPass({ timeout: 15_000 })

    const drawer = page.locator('[data-slot="drawer-content"]')
    await expect(drawer.getByRole('link', { name: 'Quadro', exact: true })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Conceitos' })).toBeVisible()
    await expect(drawer.getByRole('link', { name: 'Perfil' })).toBeVisible()
    await expect(drawer.getByRole('button', { name: 'Sair' })).toBeVisible()
  })

  test('leader does not see the bottom nav', async ({ campaign, context, page }) => {
    await seedCampaignSession(context, campaign.baseURL, leaderToken)
    await page.goto('/campanha/contatos')

    await expect(page.locator('[aria-label="Navegação principal"]')).toHaveCount(0)
  })

  test('staff mobile has no sidebar trigger and no nav sheet (C102)', async ({ page }) => {
    await page.goto('/campanha')

    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"]')
    await expect(topBar).toBeVisible()
    await expect(topBar.locator('[data-slot="sidebar-trigger"]')).toHaveCount(0)
    // The sheet itself is unmounted for staff — no "Sidebar" dialog exists.
    await expect(page.getByRole('dialog', { name: 'Sidebar' })).toHaveCount(0)
    // Every destination still arrives from below.
    await expect(page.locator('[aria-label="Navegação principal"]')).toBeVisible()
  })

  test('leader keeps the sidebar sheet on mobile (C102)', async ({ campaign, context, page }) => {
    await seedCampaignSession(context, campaign.baseURL, leaderToken)
    await page.goto('/campanha/contatos')

    const topBar = page.locator('[data-slot="campaign-mobile-top-bar"]')
    const trigger = topBar.locator('[data-slot="sidebar-trigger"]')
    await expect(trigger).toBeVisible()

    await trigger.click()
    const sheet = page.getByRole('dialog', { name: 'Sidebar' })
    await expect(sheet).toBeVisible()
    await expect(sheet.getByRole('link', { name: 'Meus contatos' })).toBeVisible()
  })

  test('hidden on desktop viewport', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/campanha')

    // CSS-hidden, but still in DOM
    await expect(page.locator('[aria-label="Navegação principal"]')).toBeHidden()
    // Sidebar trigger is visible on desktop
    await expect(page.getByRole('button', { name: /abrir ou fechar/i })).toBeVisible()
  })

  test('FAB sits above the bottom nav on mobile', async ({ page }) => {
    await page.goto('/campanha/municipios')

    const fab = page.getByRole('button', { name: 'Ações rápidas' })
    await expect(fab).toBeVisible()
    await expect(page.locator('[aria-label="Navegação principal"]')).toBeVisible()

    const fabBox = await fab.boundingBox()
    const navBox = await (await page.locator('[aria-label="Navegação principal"]')).boundingBox()
    if (fabBox && navBox) {
      expect(fabBox.y).toBeLessThan(navBox.y)
    }
  })

  test('items breathe below the top edge and labels never overlap (B171)', async ({ page }) => {
    await page.goto('/campanha')

    const bottomNav = page.locator('[aria-label="Navegação principal"]')

    const expectLabelsLegible = async () => {
      await expect(bottomNav).toBeVisible()

      // A small breathing gap between the item content and the bar's top edge
      // (pt-2.5 computes to 10px).
      const paddingTop = await bottomNav.evaluate((el) =>
        parseFloat(getComputedStyle(el).paddingTop),
      )
      expect(paddingTop).toBeGreaterThanOrEqual(10)

      // Labels render smaller than the original text-xs (12px).
      const labels = bottomNav.locator('a > span, button > span')
      await expect(labels).toHaveCount(5)
      const sizes = await labels.evaluateAll((els) =>
        els.map((el) => parseFloat(getComputedStyle(el).fontSize)),
      )
      for (const fontSize of sizes) expect(fontSize).toBeLessThan(12)

      // Adjacent labels must not overlap horizontally on a mobile viewport.
      const boxes = await labels.evaluateAll((els) =>
        els.map((el) => {
          const rect = el.getBoundingClientRect()
          return { left: rect.left, right: rect.right }
        }),
      )
      for (let i = 1; i < boxes.length; i++) {
        expect(boxes[i].left).toBeGreaterThanOrEqual(boxes[i - 1].right - 0.5)
      }
    }

    // Default narrow phone (390px) and an extra-narrow one — the acceptance
    // promises readable labels on "any mobile viewport", so cover both.
    await expectLabelsLegible()
    await page.setViewportSize({ width: 320, height: 640 })
    await expectLabelsLegible()
  })
})
