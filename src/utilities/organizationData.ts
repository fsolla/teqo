import 'server-only'

import type { Payload } from 'payload'

import { relationshipId } from '@/lib/relationship'
import type { OrganizationKind } from '@/lib/schemas/organization'
import type { CampaignUser, Organization } from '@/payload-types'
import type { ActivityStatus } from '@/utilities/activityUi'
import { loadMunicipalityLabelsByIds } from '@/utilities/loadNamesByIds'
import {
  organizationPageSize,
  type OrganizationListState,
} from '@/utilities/organization/organizationListUrl'

export {
  buildOrganizationListHref,
  parseOrganizationListParams,
  resolveOrganizationListUrl,
} from '@/utilities/organization/organizationListUrl'
export type {
  OrganizationListSearchParams,
  OrganizationListState,
} from '@/utilities/organization/organizationListUrl'

export type OrganizationRowViewModel = {
  id: number
  name: string
  slug: string
  kind: OrganizationKind
  municipalityNames: string[]
  leadershipCount: number
}

const municipalityNamesByIds = async (
  payload: Payload,
  ids: number[],
): Promise<Map<number, string>> => {
  const labels = await loadMunicipalityLabelsByIds(payload, ids)
  return new Map([...labels].map(([id, label]) => [id, label.name]))
}

export const loadOrganizationListPageData = async (
  payload: Payload,
  user: CampaignUser,
  state: OrganizationListState,
): Promise<{ rows: OrganizationRowViewModel[]; totalDocs: number; totalPages: number }> => {
  const result = await payload.find({
    collection: 'organization',
    where: {
      and: [
        ...(state.q ? [{ name: { contains: state.q } }] : []),
        ...(state.kind ? [{ kind: { equals: state.kind } }] : []),
      ],
    },
    depth: 0,
    limit: organizationPageSize,
    page: state.page,
    sort: 'name',
    user,
    overrideAccess: false,
  })

  const municipalityIDs = new Set<number>()
  for (const doc of result.docs) {
    for (const municipality of doc.municipalities ?? []) {
      const id = relationshipId(municipality)
      if (id !== null) municipalityIDs.add(id)
    }
  }
  const municipalityNames = await municipalityNamesByIds(payload, [...municipalityIDs])

  const organizationIDs = result.docs.map((doc) => doc.id)
  const leadershipCounts = new Map<number, number>()
  if (organizationIDs.length) {
    // Intentional admin bypass: counts only, over rows already access-checked.
    const leaderships = await payload.find({
      collection: 'leadership',
      where: { organizations: { in: organizationIDs } },
      depth: 0,
      limit: 0,
      pagination: false,
      select: { organizations: true },
      overrideAccess: true,
    })
    for (const leadership of leaderships.docs) {
      for (const organization of leadership.organizations ?? []) {
        const id = relationshipId(organization)
        if (id !== null && organizationIDs.includes(id)) {
          leadershipCounts.set(id, (leadershipCounts.get(id) ?? 0) + 1)
        }
      }
    }
  }

  return {
    rows: result.docs.map((doc) => ({
      id: doc.id,
      name: doc.name,
      slug: doc.slug,
      kind: doc.kind as OrganizationKind,
      municipalityNames: (doc.municipalities ?? [])
        .map(relationshipId)
        .filter((id): id is number => id !== null)
        .map((id) => municipalityNames.get(id) ?? 'Município'),
      leadershipCount: leadershipCounts.get(doc.id) ?? 0,
    })),
    totalDocs: result.totalDocs,
    totalPages: result.totalPages,
  }
}

export type OrganizationDetailViewModel = {
  id: number
  name: string
  slug: string
  kind: OrganizationKind
  notes: string | null
  municipalityIDs: number[]
  municipalityNames: string[]
  leaderships: Array<{ id: number; name: string }>
  activities: Array<{
    id: number
    title: string
    slug: string
    status: ActivityStatus
    startAt: string | null
    deputyPresent: boolean
  }>
}

export const loadOrganizationDetail = async (
  payload: Payload,
  user: CampaignUser,
  slug: string,
): Promise<OrganizationDetailViewModel | null> => {
  const result = await payload.find({
    collection: 'organization',
    where: { slug: { equals: slug } },
    depth: 0,
    limit: 1,
    pagination: false,
    user,
    overrideAccess: false,
  })
  const organization = result.docs[0] as Organization | undefined
  if (!organization) return null

  const municipalityIDs = (organization.municipalities ?? [])
    .map(relationshipId)
    .filter((id): id is number => id !== null)
  const municipalityNames = await municipalityNamesByIds(payload, municipalityIDs)

  const [leaderships, activities] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: { organizations: { in: [organization.id] } },
      depth: 1,
      limit: 0,
      pagination: false,
      user,
      overrideAccess: false,
    }),
    payload.find({
      collection: 'activity',
      where: { organizations: { in: [organization.id] } },
      depth: 0,
      limit: 20,
      pagination: false,
      sort: '-startAt',
      select: {
        title: true,
        slug: true,
        status: true,
        startAt: true,
        deputyPresent: true,
      },
      user,
      overrideAccess: false,
    }),
  ])

  return {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
    kind: organization.kind as OrganizationKind,
    notes: organization.notes ?? null,
    municipalityIDs,
    municipalityNames: municipalityIDs.map((id) => municipalityNames.get(id) ?? 'Município'),
    leaderships: leaderships.docs.map((leadership) => {
      const contact = leadership.contact
      return {
        id: leadership.id,
        name:
          typeof contact === 'object' && contact !== null && 'name' in contact
            ? String(contact.name)
            : 'Contato',
      }
    }),
    activities: activities.docs.map((activity) => ({
      id: activity.id,
      title: activity.title,
      slug: activity.slug,
      status: activity.status,
      startAt: activity.startAt ?? null,
      deputyPresent: Boolean(activity.deputyPresent),
    })),
  }
}
