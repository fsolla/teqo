import { login } from '../helpers/login'
import { cleanupTestUser, seedTestUser, testUser } from '../helpers/seedUser'
import { expect, test } from './fixtures/e2eTest'

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'

test.describe('Admin Panel', () => {
  test.beforeAll(async ({}, testInfo) => {
    testInfo.setTimeout(90_000)
    await seedTestUser()
  })

  test.beforeEach(async ({ page }) => {
    await login({ page, serverURL: baseURL, user: testUser })
  })

  test.afterAll(async () => {
    await cleanupTestUser()
  })

  test('can navigate to dashboard', async ({ page }) => {
    await page.goto(`${baseURL}/admin`)
    await expect(page).toHaveURL(`${baseURL}/admin`)
    const dashboardArtifact = page.getByRole('heading', { name: 'Coleções', exact: true })
    await expect(dashboardArtifact).toBeVisible()
  })

  test('can navigate to list view', async ({ page }) => {
    await page.goto(`${baseURL}/admin/collections/users`)
    await expect(page).toHaveURL(new RegExp(`^${baseURL}/admin/collections/users(?:\\?|$)`))
    const listViewArtifact = page.getByRole('heading', { name: 'Usuários', exact: true })
    await expect(listViewArtifact).toBeVisible()
  })

  test('can navigate to edit view', async ({ page }) => {
    await page.goto(`${baseURL}/admin/collections/users/create`)
    await expect(page).toHaveURL(/\/admin\/collections\/users\/[a-zA-Z0-9-_]+/)
    const editViewArtifact = page.locator('input[name="email"]')
    await expect(editViewArtifact).toBeVisible()
  })
})
