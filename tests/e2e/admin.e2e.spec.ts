import { adminHeaders } from '../helpers/adminApi'
import { login } from '../helpers/login'
import { seedTestUser, testUser } from '../helpers/seedUser'
import { instagramStubUrlFor } from '../helpers/socialStub'
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
    const headers = await adminHeaders(request, baseURL)

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
            instagramSyncStatus: null,
          },
        })
        .catch(() => undefined)
    }
  })

  test('shows the Instagram sync status and retries the sync from the panel', async ({
    page,
    request,
  }) => {
    // The seed POST fires the global's afterChange hook, whose sync hits the
    // stub — put it in a known state first and let the hook persist the
    // status so the panel has a real one to render.
    const stubUrl = instagramStubUrlFor(baseURL)
    const setStub = async (state: 'ok' | 'fail' | 'invalid-token') => {
      const response = await request.post(`${stubUrl}/__stub/state`, { data: { state } })
      expect(response.ok()).toBeTruthy()
    }
    await setStub('ok')

    const headers = await adminHeaders(request, baseURL)

    const seed = await request.post(`${baseURL}/api/globals/social-feed-settings`, {
      headers,
      data: {
        enabled: true,
        instagramEnabled: true,
        instagramAccessToken: 'e2e-ig-token',
        instagramUserId: '17841400000000000',
        instagramMaxItems: 3,
        excludedItems: [],
        instagramFeedSnapshot: null,
      },
    })
    expect(seed.ok()).toBeTruthy()

    const seedToken = async (accessToken: string) => {
      const response = await request.post(`${baseURL}/api/globals/social-feed-settings`, {
        headers,
        data: {
          enabled: true,
          instagramEnabled: true,
          instagramAccessToken: accessToken,
          instagramUserId: '17841400000000000',
          instagramMaxItems: 3,
          excludedItems: [],
          instagramFeedSnapshot: null,
        },
      })
      expect(response.ok()).toBeTruthy()
    }

    try {
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText(/Sincronizado · .* · 5 posts/)).toBeVisible()

      // Credential change + save triggers the hook sync — with the API now
      // rejecting the token (OAuthException), the save persists a failure
      // status and the reload shows it with the retry button.
      await setStub('invalid-token')
      await seedToken('e2e-ig-token-2')
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText('Falha na última sincronização')).toBeVisible()
      await expect(page.getByText(/token do Instagram foi recusado/)).toBeVisible()

      // Retry after fixing: the button runs the sync route → synchronized.
      await setStub('ok')
      await page.getByRole('button', { name: 'Tentar sincronizar de novo' }).click()
      await expect(page.getByText(/Sincronizado · .* · 5 posts/)).toBeVisible()

      const read = await request.get(`${baseURL}/api/globals/social-feed-settings`, { headers })
      expect(read.ok()).toBeTruthy()
      const { instagramSyncStatus } = await read.json()
      expect(instagramSyncStatus).toEqual(
        expect.objectContaining({
          lastSyncAt: expect.any(String),
          postCount: 5,
        }),
      )
      expect(instagramSyncStatus.error).toBeUndefined()

      // Fail-500 scene: a server-side API failure maps to the generic notice.
      await setStub('fail')
      await seedToken('e2e-ig-token-3')
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText('Falha na última sincronização')).toBeVisible()
      await expect(page.getByText(/indisponível/)).toBeVisible()

      // Disabled scene: the master kill switch off renders the disabled box.
      await setStub('ok')
      await request.post(`${baseURL}/api/globals/social-feed-settings`, {
        headers,
        data: {
          enabled: false,
          instagramEnabled: true,
          instagramAccessToken: 'e2e-ig-token',
          instagramUserId: '17841400000000000',
          instagramMaxItems: 3,
          excludedItems: [],
          instagramFeedSnapshot: null,
        },
      })
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText('Instagram desativado')).toBeVisible()

      // Unconfigured state: no credentials (feed enabled) → the panel says so.
      await seedToken('')
      await page.goto(`${baseURL}/admin/globals/social-feed-settings`)
      await expect(page.getByText('Instagram ainda não configurado')).toBeVisible()
    } finally {
      await setStub('ok').catch(() => undefined)
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
            instagramSyncStatus: null,
          },
        })
        .catch(() => undefined)
    }
  })
})
