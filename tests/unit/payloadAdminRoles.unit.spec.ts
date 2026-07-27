// @vitest-environment node

import type { PayloadRequest } from 'payload'
import { describe, expect, it } from 'vitest'

import type { CampaignUser, User } from '@/payload-types'
import {
  canManagePublishedContent,
  hasPayloadPanelAccess,
  isPayloadAdmin,
  isPayloadEditor,
} from '@/utilities/access/shared'
import { stub } from '../helpers/stub'

const adminUser = stub<User>({
  id: 1,
  collection: 'users',
  email: 'admin@example.com',
  roles: ['admin'],
})

const editorUser = stub<User>({
  id: 2,
  collection: 'users',
  email: 'editor@example.com',
  roles: ['editor'],
})

const dualRoleUser = stub<User>({
  id: 3,
  collection: 'users',
  email: 'both@example.com',
  roles: ['admin', 'editor'],
})

/** Runtime-missing roles — Partial stub omits the field. */
const usersMissingRoles = stub<User>({
  id: 4,
  collection: 'users',
  email: 'legacy@example.com',
})

const usersEmptyRoles = stub<User>({
  id: 5,
  collection: 'users',
  email: 'empty@example.com',
  roles: [],
})

const campaignCoordinator = stub<CampaignUser>({
  id: 10,
  collection: 'campaignUser',
  role: 'coordinator',
  name: 'Coord',
})

const accessArgs = (user: User | CampaignUser | null) =>
  stub<Parameters<typeof canManagePublishedContent>[0]>({
    req: stub<PayloadRequest>({ user }),
  })

describe('payload admin role predicates', () => {
  it('isPayloadAdmin requires the users collection and the admin role', () => {
    expect(isPayloadAdmin(adminUser)).toBe(true)
    expect(isPayloadAdmin(dualRoleUser)).toBe(true)
    expect(isPayloadAdmin(editorUser)).toBe(false)
    expect(isPayloadAdmin(usersMissingRoles)).toBe(false)
    expect(isPayloadAdmin(usersEmptyRoles)).toBe(false)
    expect(isPayloadAdmin(campaignCoordinator)).toBe(false)
    expect(isPayloadAdmin(null)).toBe(false)
    expect(isPayloadAdmin(undefined)).toBe(false)
  })

  it('isPayloadEditor requires the editor role', () => {
    expect(isPayloadEditor(editorUser)).toBe(true)
    expect(isPayloadEditor(dualRoleUser)).toBe(true)
    expect(isPayloadEditor(adminUser)).toBe(false)
    expect(isPayloadEditor(usersMissingRoles)).toBe(false)
    expect(isPayloadEditor(usersEmptyRoles)).toBe(false)
    expect(isPayloadEditor(campaignCoordinator)).toBe(false)
  })

  it('hasPayloadPanelAccess allows admin or editor', () => {
    expect(hasPayloadPanelAccess(adminUser)).toBe(true)
    expect(hasPayloadPanelAccess(editorUser)).toBe(true)
    expect(hasPayloadPanelAccess(dualRoleUser)).toBe(true)
    expect(hasPayloadPanelAccess(usersMissingRoles)).toBe(false)
    expect(hasPayloadPanelAccess(usersEmptyRoles)).toBe(false)
    expect(hasPayloadPanelAccess(campaignCoordinator)).toBe(false)
  })

  it('canManagePublishedContent mirrors panel access', () => {
    expect(canManagePublishedContent(accessArgs(adminUser))).toBe(true)
    expect(canManagePublishedContent(accessArgs(editorUser))).toBe(true)
    expect(canManagePublishedContent(accessArgs(usersEmptyRoles))).toBe(false)
    expect(canManagePublishedContent(accessArgs(campaignCoordinator))).toBe(false)
    expect(canManagePublishedContent(accessArgs(null))).toBe(false)
  })
})
