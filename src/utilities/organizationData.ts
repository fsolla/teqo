import type { Payload } from 'payload'

import type { OrganizationKind } from '@/lib/schemas/organization'
import { organizationKinds } from '@/lib/schemas/organization'
import type { CampaignUser, Organization } from '@/payload-types'
import { relationshipId } from '@/utilities/relationship'

export const organizationPageSize = 25

export type OrganizationRowViewModel = {
  id: number
  name: string
  slug: string
  kind: OrganizationKind
  municipalityNames: string[]
  leadershipCount: number
}

export type OrganizationListState = {
  page: number
  q?: string
  kind?: OrganizationKind
}

export const parseOrganizationListParams = (
  searchParams: Record<string, string | string[] | undefined>,
): OrganizationListState => {
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)
  const q = first(searchParams.q)?.trim()
  const rawKind = first(searchParams.kind)
  const rawPage = first(searchParams.page)

  return {
    page: rawPage && /^[1-9]\d*$/.test(rawPage) ? Number(rawPage) : 1,
    ...(q ? { q } : {}),
    ...(organizationKinds.includes(rawKind as OrganizationKind)
      ? { kind: rawKind as OrganizationKind }
      : {}),
  }
}

const municipalityNamesByIds = async (payload: Payload, ids: number[]): Promise<Map<number, string>> => {
  if (ids.length === 0) return new Map()
  const result = await payload.find({
    collection: 'municipality',
    where: { id: { in: ids } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { name: true },
    overrideAccess: true,
  })
  return new Map(result.docs.map((municipality) => [municipality.id, municipality.name]))
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
        .map((id) => municipalityNames.get(id) ?? 'Praça'),
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
  actionPlans: Array<{
    id: number
    title: string
    slug: string
    status: string
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

  const [leaderships, actionPlans] = await Promise.all([
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
      collection: 'actionPlan',
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
    municipalityNames: municipalityIDs.map((id) => municipalityNames.get(id) ?? 'Praça'),
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
    actionPlans: actionPlans.docs.map((plan) => ({
      id: plan.id,
      title: plan.title,
      slug: plan.slug,
      status: String(plan.status),
      startAt: plan.startAt ?? null,
      deputyPresent: Boolean(plan.deputyPresent),
    })),
  }
}
