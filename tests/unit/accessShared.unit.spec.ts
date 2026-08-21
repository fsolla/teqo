// @vitest-environment node

import type { Payload, PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import type { CampaignUser, User } from '@/payload-types'
import {
  advisorEditingAccess,
  advisorMunicipalityScopeWhere,
  resolveAccessibleIds,
  resolveActorScopedRead,
  resolveProfileScopedRead,
} from '@/utilities/access/shared'

import { stub } from '../helpers/stub'

const advisorUser = stub<CampaignUser>({
  collection: 'campaignUser',
  id: 7,
  role: 'advisor',
})

/**
 * P3-D pin: one spec per consolidated predicate form — the scope fragment, the
 * scoped-read prologue, and the memoized accessible-ids engine. The int access
 * matrix pins behavior end-to-end; these pin the single spellings the guard in
 * `codebaseConventions.unit.spec.ts` makes the only writable ones.
 */
describe('access shared policies (P3-D)', () => {
  it('spells the advisor scope fragment exactly once per field', () => {
    expect(advisorMunicipalityScopeWhere('municipality', [1, 2])).toEqual({
      municipality: { in: [1, 2] },
    })
    expect(advisorMunicipalityScopeWhere('municipalities', null)).toEqual({
      municipalities: { in: [] },
    })
  })

  it('resolveActorScopedRead: admin → all, anon → nothing, advisor → scope', async () => {
    const adminReq = stub<PayloadRequest>({
      user: stub<User>({ collection: 'users', roles: ['admin'] }),
    })
    await expect(resolveActorScopedRead(adminReq, 'municipality', vi.fn())).resolves.toBe(true)

    const anonReq = stub<PayloadRequest>({ user: null })
    await expect(resolveActorScopedRead(anonReq, 'municipality', vi.fn())).resolves.toBe(false)

    const loadAccessibleIds = vi.fn().mockResolvedValue([42])
    // The prologue reloads the actor fresh (getFreshCampaignUser), so the stub
    // request needs a payload answering findByID with the same advisor.
    const advisorReq = stub<PayloadRequest>({
      user: advisorUser,
      payload: stub<Payload>({ findByID: vi.fn().mockResolvedValue(advisorUser) }),
    })
    await expect(
      resolveActorScopedRead(advisorReq, 'municipality', loadAccessibleIds),
    ).resolves.toEqual({ municipality: { in: [42] } })
  })

  it('resolveAccessibleIds: unrestricted → null, non-campaign → [], memoizes per request', async () => {
    const coordinator = stub<CampaignUser>({
      collection: 'campaignUser',
      id: 1,
      role: 'coordinator',
    })
    const unrestrictedReq = stub<PayloadRequest>({
      user: coordinator,
      payload: stub<Payload>({ findByID: vi.fn().mockResolvedValue(coordinator) }),
    })
    await expect(resolveAccessibleIds(unrestrictedReq, undefined, 'k', vi.fn())).resolves.toBeNull()

    const foreignReq = stub<PayloadRequest>({
      user: stub<User>({ collection: 'users', roles: ['editor'] }),
    })
    await expect(resolveAccessibleIds(foreignReq, undefined, 'k', vi.fn())).resolves.toEqual([])

    const compute = vi.fn().mockResolvedValue([5])
    const req = stub<PayloadRequest>({
      user: advisorUser,
      payload: stub<Payload>({ findByID: vi.fn().mockResolvedValue(advisorUser) }),
    })
    await expect(resolveAccessibleIds(req, undefined, 'k', compute)).resolves.toEqual([5])
    await expect(resolveAccessibleIds(req, undefined, 'k', compute)).resolves.toEqual([5])
    expect(compute).toHaveBeenCalledTimes(1)
  })

  it('C141 advisorEditingAccess maps the Edição axis to a scope decision', () => {
    // Coherent stored profiles only: `editing: 'tudo'` requires `visibility: 'tudo'`
    // (the collection hook rejects the incoherent combination at write).
    const withEditing = (editing: CampaignUser['editing']) =>
      stub<CampaignUser>({
        collection: 'campaignUser',
        id: 9,
        role: 'advisor',
        visibility: 'tudo',
        editing,
      })
    expect(advisorEditingAccess(withEditing('somente_leitura'))).toBe('none')
    expect(advisorEditingAccess(withEditing('tudo'))).toBe('tudo')
    expect(advisorEditingAccess(withEditing('carteira'))).toBe('carteira')
    expect(
      advisorEditingAccess(
        stub<CampaignUser>({ collection: 'campaignUser', id: 9, role: 'leader' }),
      ),
    ).toBe('none')
    expect(advisorEditingAccess(stub<User>({ collection: 'users', roles: ['admin'] }))).toBe('none')
    expect(advisorEditingAccess(null)).toBe('none')
  })

  it('C141 resolveProfileScopedRead widens the advisor scope with Visão "Tudo"', async () => {
    const loadAccessibleIds = vi.fn().mockResolvedValue([42])

    const wideAdvisor = stub<CampaignUser>({
      collection: 'campaignUser',
      id: 7,
      role: 'advisor',
      visibility: 'tudo',
    })
    const wideReq = stub<PayloadRequest>({
      user: wideAdvisor,
      payload: stub<Payload>({ findByID: vi.fn().mockResolvedValue(wideAdvisor) }),
    })
    await expect(
      resolveProfileScopedRead(wideReq, 'municipality', loadAccessibleIds),
    ).resolves.toBe(true)
    // The carteira branch keeps the fragment — and never calls the ids loader
    // for a visão-tudo advisor.
    expect(loadAccessibleIds).not.toHaveBeenCalled()

    const carteiraReq = stub<PayloadRequest>({
      user: advisorUser,
      payload: stub<Payload>({ findByID: vi.fn().mockResolvedValue(advisorUser) }),
    })
    await expect(
      resolveProfileScopedRead(carteiraReq, 'municipality', loadAccessibleIds),
    ).resolves.toEqual({ municipality: { in: [42] } })
  })
})
