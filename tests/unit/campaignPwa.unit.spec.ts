// @vitest-environment node

import { describe, expect, it } from 'vitest'

import { GET as getManifest } from '@/app/(campaign)/campanha/manifest.webmanifest/route'
import { GET as getServiceWorker } from '@/app/(campaign)/campanha/sw.js/route'
import {
  buildCampaignServiceWorkerScript,
  CAMPAIGN_CACHE_PREFIX,
  CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE,
  CAMPAIGN_PWA_SCOPE,
  CAMPAIGN_PWA_THEME_COLOR,
  CAMPAIGN_WEB_MANIFEST,
  resolveCampaignPwaBuildId,
} from '@/utilities/campaignPwa'

describe('campaign PWA helpers', () => {
  it('builds a manifest scoped to /campanha without a trailing slash', () => {
    expect(CAMPAIGN_WEB_MANIFEST.start_url).toBe(CAMPAIGN_PWA_SCOPE)
    expect(CAMPAIGN_WEB_MANIFEST.scope).toBe(CAMPAIGN_PWA_SCOPE)
    expect(CAMPAIGN_WEB_MANIFEST.start_url.endsWith('/')).toBe(false)
    expect(CAMPAIGN_WEB_MANIFEST.scope.endsWith('/')).toBe(false)
    expect(CAMPAIGN_WEB_MANIFEST.display).toBe('standalone')
    expect(CAMPAIGN_WEB_MANIFEST.theme_color).toBe(CAMPAIGN_PWA_THEME_COLOR)
    expect(CAMPAIGN_WEB_MANIFEST.icons.some((icon) => icon.purpose === 'maskable')).toBe(true)
  })

  it('resolves a stable build id from Vercel env with a local fallback', () => {
    expect(resolveCampaignPwaBuildId({ VERCEL_GIT_COMMIT_SHA: 'abc123' })).toBe('abc123')
    expect(resolveCampaignPwaBuildId({ VERCEL_DEPLOYMENT_ID: 'dpl_1' })).toBe('dpl_1')
    expect(resolveCampaignPwaBuildId({})).toBe('dev')
  })

  it('embeds invite exclusion, RSC skip, cache prefix, and logout message in the SW script', () => {
    const script = buildCampaignServiceWorkerScript('sha-test')

    expect(script).toContain(`${CAMPAIGN_CACHE_PREFIX}sha-test`)
    expect(script).toContain(`SCOPE + '/convite'`)
    expect(script).toContain(CAMPAIGN_PWA_CLEAR_CACHES_MESSAGE)
    expect(script).toContain(`${CAMPAIGN_PWA_SCOPE}/offline`)
    expect(script).toContain('isRscRequest')
    expect(script).toContain('skipWaiting')
    expect(script).toContain('clients.claim')
  })

  it('serves /_next/static with cache-first and never caches RSC or invite paths', () => {
    const script = buildCampaignServiceWorkerScript('sha-test')

    expect(script).toContain('isNextStaticPath')
    expect(script).toContain("pathname.startsWith('/_next/static/')")

    const staticBranch = script.indexOf('isNextStaticPath(url.pathname)')
    const rscGuard = script.indexOf('if (isRscRequest(request)) return')
    const inviteGuard = script.indexOf('if (isInvitePath(url.pathname)) return')

    expect(staticBranch).toBeGreaterThan(-1)
    expect(rscGuard).toBeGreaterThan(staticBranch)
    expect(inviteGuard).toBeGreaterThan(-1)
    expect(inviteGuard).toBeLessThan(staticBranch)
  })
})

describe('campaign PWA route handlers', () => {
  it('serves the web manifest with the expected headers and body', async () => {
    const response = getManifest()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/manifest+json')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(body.scope).toBe('/campanha')
    expect(body.start_url).toBe('/campanha')
  })

  it('serves the service worker with Service-Worker-Allowed scoped to /campanha', async () => {
    const response = getServiceWorker()
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('text/javascript')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
    expect(response.headers.get('Service-Worker-Allowed')).toBe('/campanha')
    expect(body).toContain('campanha-')
    expect(body).toContain(`SCOPE + '/convite'`)
    expect(body).toContain('isRscRequest')
    expect(body).toContain('isNextStaticPath')
  })
})
