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

  test('can exclude an Instagram post through the content board picker', async ({
    page,
    request,
  }) => {
    // Seed the social-feed global with an Instagram snapshot so the exclusion
    // picker (S3) has posts to show. The snapshot is plain data — the picker
    // lists it and writes `excludedItems` (the same mechanism YouTube uses).
    const login = await request.post(`${baseURL}/api/users/login`, {
      data: { email: testUser.email, password: testUser.password },
    })
    expect(login.ok()).toBeTruthy()
    const { token } = await login.json()
    const headers = { cookie: `payload-token=${token}` }

    const snapshot = {
      username: 'depjorgesolla',
      posts: [
        {
          id: 'e2e-ig-muro-1',
          caption: 'E2e Post do muro',
          mediaType: 'IMAGE',
          permalink: 'https://www.instagram.com/p/e2e-ig-muro-1/',
          thumbnailUrl: null,
          timestamp: '2026-08-18T10:00:00+00:00',
        },
        {
          id: 'e2e-ig-reel-2',
          caption: 'E2e Reel da caravana',
          mediaType: 'REEL',
          permalink: 'https://www.instagram.com/p/e2e-ig-reel-2/',
          thumbnailUrl: null,
          timestamp: '2026-08-18T09:00:00+00:00',
        },
      ],
    }
    const seed = await request.post(`${baseURL}/api/globals/social-feed-settings`, {
      headers,
      data: {
        instagramEnabled: true,
        instagramAccessToken: 'e2e-ig-token',
        instagramUserId: '17841400000000000',
        instagramMaxItems: 3,
        excludedItems: [],
        instagramFeedSnapshot: snapshot,
      },
    })
    expect(seed.ok()).toBeTruthy()

    try {
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText('E2e Post do muro')).toBeVisible()

      const hideButton = page.getByRole('button', { name: 'Não exibir' }).first()
      await expect(hideButton).toBeVisible()
      await hideButton.click()
      await expect(page.getByRole('button', { name: 'Reexibir' })).toBeVisible()

      const saveResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/globals/social-feed-settings') &&
          response.request().method() === 'POST',
      )
      await page.getByRole('button', { name: 'Salvar' }).click()
      await saveResponse

      const read = await request.get(`${baseURL}/api/globals/social-feed-settings`, { headers })
      expect(read.ok()).toBeTruthy()
      const { excludedItems } = await read.json()
      expect(excludedItems).toEqual([
        expect.objectContaining({ platform: 'instagram', itemId: 'e2e-ig-muro-1' }),
      ])
    } finally {
      await request
        .post(`${baseURL}/api/globals/social-feed-settings`, {
          headers,
          data: {
            enabled: true,
            youtubeEnabled: true,
            youtubeApiKey: '',
            youtubeChannelId: '',
            youtubeMaxItems: 3,
            instagramEnabled: true,
            instagramAccessToken: '',
            instagramUserId: '',
            instagramMaxItems: 3,
            excludedItems: [],
            youtubeFeedSnapshot: null,
            instagramFeedSnapshot: null,
          },
        })
        .catch(() => undefined)
    }
  })
})
