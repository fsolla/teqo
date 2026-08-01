import 'server-only'

import type { Payload } from 'payload'

import {
  createEmptyOpsSnapshot,
  type OpsActivity,
  type OpsDemand,
  type OpsGoals,
  type OpsLeadership,
  type OpsLeadershipContact,
  type OpsMunicipality,
  type OpsMunicipalityUpdate,
  type OpsOrganization,
  type OpsSnapshot,
  type OpsStateDeputy,
  type OpsVoteEstimateScenarioFields,
  type OpsVotePledge,
} from '@/lib/campaignOps/opsContract'
import { OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY } from '@/lib/campaignOps/opsSnapshotPolicy'
import { relationshipId, uniqueRelationshipIds } from '@/lib/relationship'
import type { CampaignUser } from '@/payload-types'
import { isCampaignStaff } from '@/utilities/access/shared'

type OpsActor = CampaignUser

const toIso = (value: unknown): string | null => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

const requireIso = (value: unknown): string => toIso(value) ?? new Date(0).toISOString()

const requireId = (value: unknown, label: string): number => {
  const id = relationshipId(value)
  if (id === null) throw new Error(`Ops snapshot: missing ${label}`)
  return id
}

const asEstimateFields = (value: unknown): OpsVoteEstimateScenarioFields | null => {
  if (typeof value !== 'object' || value === null) return null
  return value as OpsVoteEstimateScenarioFields
}

const mapMunicipality = (doc: Record<string, unknown>): OpsMunicipality => ({
  id: requireId(doc.id, 'municipality.id'),
  name: String(doc.name ?? ''),
  slug: String(doc.slug ?? ''),
  kind: doc.kind === 'zona' ? 'zona' : 'municipio',
  city: String(doc.city ?? ''),
  region: String(doc.region ?? ''),
  ibgeCode: String(doc.ibgeCode ?? ''),
  zoneNumber: typeof doc.zoneNumber === 'number' ? doc.zoneNumber : null,
  advisors: uniqueRelationshipIds(doc.advisors as readonly unknown[] | null | undefined),
  priority: doc.priority === 'alta' || doc.priority === 'normal' ? doc.priority : null,
  engagementLevel:
    doc.engagementLevel === 'n0' ||
    doc.engagementLevel === 'n1' ||
    doc.engagementLevel === 'n2' ||
    doc.engagementLevel === 'n3' ||
    doc.engagementLevel === 'n4'
      ? doc.engagementLevel
      : null,
  levelNote: typeof doc.levelNote === 'string' ? doc.levelNote : null,
  levelChangedAt: toIso(doc.levelChangedAt),
  expectedVotes: asEstimateFields(doc.expectedVotes),
  politicalTrend:
    typeof doc.politicalTrend === 'object' && doc.politicalTrend !== null
      ? (() => {
          const trend = doc.politicalTrend as Record<string, unknown>
          return {
            status:
              trend.status === 'favoravel' ||
              trend.status === 'neutra' ||
              trend.status === 'desfavoravel'
                ? trend.status
                : null,
            note: typeof trend.note === 'string' ? trend.note : null,
            recordedBy: relationshipId(trend.recordedBy),
            recordedAt: toIso(trend.recordedAt),
          }
        })()
      : null,
  stateDeputies: uniqueRelationshipIds(doc.stateDeputies as readonly unknown[] | null | undefined),
  lastUpdateAt: toIso(doc.lastUpdateAt),
  updatedAt: requireIso(doc.updatedAt),
})

const mapLeadershipContact = (contact: unknown): OpsLeadershipContact => {
  if (typeof contact !== 'object' || contact === null) {
    return { id: relationshipId(contact) ?? 0, name: 'Contato' }
  }
  const doc = contact as Record<string, unknown>
  return {
    id: requireId(doc.id, 'leadership.contact.id'),
    name: typeof doc.name === 'string' && doc.name.length > 0 ? doc.name : 'Contato',
    phone: typeof doc.phone === 'string' ? doc.phone : null,
  }
}

const mapLeadership = (doc: Record<string, unknown>): OpsLeadership => ({
  id: requireId(doc.id, 'leadership.id'),
  contact: mapLeadershipContact(doc.contact),
  municipalities: uniqueRelationshipIds(
    doc.municipalities as readonly unknown[] | null | undefined,
  ),
  organizations: uniqueRelationshipIds(doc.organizations as readonly unknown[] | null | undefined),
  stateDeputies: uniqueRelationshipIds(doc.stateDeputies as readonly unknown[] | null | undefined),
  exclusive: typeof doc.exclusive === 'boolean' ? doc.exclusive : null,
  supportStatus:
    doc.supportStatus === 'engajado' ||
    doc.supportStatus === 'a_abordar' ||
    doc.supportStatus === 'em_disputa' ||
    doc.supportStatus === 'negativo'
      ? doc.supportStatus
      : 'a_abordar',
  notes: typeof doc.notes === 'string' ? doc.notes : null,
  updatedAt: requireIso(doc.updatedAt),
})

const mapVotePledge = (
  doc: Record<string, unknown>,
  includeEstimates: boolean,
): OpsVotePledge => {
  const base = {
    id: requireId(doc.id, 'votePledge.id'),
    leadership: requireId(doc.leadership, 'votePledge.leadership'),
    municipality: requireId(doc.municipality, 'votePledge.municipality'),
    declaredVotes: typeof doc.declaredVotes === 'number' ? doc.declaredVotes : 0,
    declaredAt: toIso(doc.declaredAt),
    declaredBy: relationshipId(doc.declaredBy),
    updatedAt: requireIso(doc.updatedAt),
  }

  if (!includeEstimates) return base

  return {
    ...base,
    estimatedVotes: asEstimateFields(doc.estimatedVotes),
    estimateNote: typeof doc.estimateNote === 'string' ? doc.estimateNote : null,
    estimatedBy: relationshipId(doc.estimatedBy),
    estimatedAt: toIso(doc.estimatedAt),
  }
}

const mapActivity = (doc: Record<string, unknown>): OpsActivity => ({
  id: requireId(doc.id, 'activity.id'),
  title: String(doc.title ?? ''),
  slug: String(doc.slug ?? ''),
  kind: doc.kind as OpsActivity['kind'],
  status: doc.status as OpsActivity['status'],
  deputyPresent: typeof doc.deputyPresent === 'boolean' ? doc.deputyPresent : null,
  startAt: toIso(doc.startAt),
  endAt: toIso(doc.endAt),
  municipality: requireId(doc.municipality, 'activity.municipality'),
  locality: typeof doc.locality === 'string' ? doc.locality : null,
  organizations: uniqueRelationshipIds(doc.organizations as readonly unknown[] | null | undefined),
  advisors: uniqueRelationshipIds(doc.advisors as readonly unknown[] | null | undefined),
  leadership: relationshipId(doc.leadership),
  taskTotal: typeof doc.taskTotal === 'number' ? doc.taskTotal : null,
  taskDoneCount: typeof doc.taskDoneCount === 'number' ? doc.taskDoneCount : null,
  updatedAt: requireIso(doc.updatedAt),
})

const mapStateDeputy = (doc: Record<string, unknown>): OpsStateDeputy => ({
  id: requireId(doc.id, 'stateDeputy.id'),
  name: String(doc.name ?? ''),
  slug: String(doc.slug ?? ''),
  party: typeof doc.party === 'string' ? doc.party : null,
  notes: typeof doc.notes === 'string' ? doc.notes : null,
  updatedAt: requireIso(doc.updatedAt),
})

const mapOrganization = (doc: Record<string, unknown>): OpsOrganization => ({
  id: requireId(doc.id, 'organization.id'),
  name: String(doc.name ?? ''),
  slug: String(doc.slug ?? ''),
  kind: doc.kind as OpsOrganization['kind'],
  municipalities: uniqueRelationshipIds(
    doc.municipalities as readonly unknown[] | null | undefined,
  ),
  notes: typeof doc.notes === 'string' ? doc.notes : null,
  updatedAt: requireIso(doc.updatedAt),
})

const mapDemand = (doc: Record<string, unknown>): OpsDemand => ({
  id: requireId(doc.id, 'campaignDemand.id'),
  title: String(doc.title ?? ''),
  slug: String(doc.slug ?? ''),
  kind: doc.kind as OpsDemand['kind'],
  municipality: requireId(doc.municipality, 'campaignDemand.municipality'),
  activity: relationshipId(doc.activity),
  leadership: relationshipId(doc.leadership),
  status: doc.status as OpsDemand['status'],
  updatedAt: requireIso(doc.updatedAt),
})

const mapMunicipalityUpdate = (doc: Record<string, unknown>): OpsMunicipalityUpdate => ({
  id: requireId(doc.id, 'municipalityUpdate.id'),
  municipality: requireId(doc.municipality, 'municipalityUpdate.municipality'),
  author: requireId(doc.author, 'municipalityUpdate.author'),
  kind: doc.kind as OpsMunicipalityUpdate['kind'],
  body: typeof doc.body === 'string' ? doc.body : null,
  signalType:
    doc.signalType === 'invasao' ||
    doc.signalType === 'esfriamento' ||
    doc.signalType === 'visita_adversario' ||
    doc.signalType === 'proposta_broker' ||
    doc.signalType === 'outro'
      ? doc.signalType
      : null,
  updatedAt: requireIso(doc.updatedAt),
  createdAt: requireIso(doc.createdAt),
})

const mapGoals = (doc: Record<string, unknown> | null | undefined): OpsGoals | null => {
  if (!doc) return null
  return {
    stateGoal: typeof doc.stateGoal === 'number' ? doc.stateGoal : 0,
    margin: typeof doc.margin === 'number' ? doc.margin : null,
    baseYear: typeof doc.baseYear === 'number' ? doc.baseYear : null,
    note: typeof doc.note === 'string' ? doc.note : null,
    updatedAt: toIso(doc.updatedAt),
  }
}

/** Keep the latest N municipality_update rows per municipality (updatedAt desc). */
export const truncateMunicipalityUpdates = (
  updates: OpsMunicipalityUpdate[],
  limitPerMunicipality: number = OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY,
): OpsMunicipalityUpdate[] => {
  if (limitPerMunicipality <= 0) return []

  const byMunicipality = new Map<number, OpsMunicipalityUpdate[]>()

  for (const update of updates) {
    const bucket = byMunicipality.get(update.municipality) ?? []
    bucket.push(update)
    byMunicipality.set(update.municipality, bucket)
  }

  const kept: OpsMunicipalityUpdate[] = []
  for (const bucket of byMunicipality.values()) {
    bucket.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    kept.push(...bucket.slice(0, limitPerMunicipality))
  }

  return kept
}

const findAllDocs = async (
  payload: Payload,
  actor: OpsActor,
  collection:
    | 'municipality'
    | 'leadership'
    | 'votePledge'
    | 'activity'
    | 'stateDeputy'
    | 'organization'
    | 'campaignDemand'
    | 'municipalityUpdate',
  options: {
    depth?: 0 | 1
    select: Record<string, true>
    sort?: string
  },
): Promise<Array<Record<string, unknown>>> => {
  const result = await payload.find({
    collection,
    depth: options.depth ?? 0,
    pagination: false,
    user: actor,
    overrideAccess: false,
    select: options.select,
    ...(options.sort ? { sort: options.sort } : {}),
  })

  return result.docs as unknown as Array<Record<string, unknown>>
}

/**
 * Staff ops snapshot for the hybrid mirror (OH4). Every query runs with
 * `user: actor` + `overrideAccess: false` so collection access (advisor
 * portfolio, leader deny) is the scoping authority — never bypassed.
 */
export const buildOpsSnapshot = async (
  payload: Payload,
  actor: OpsActor,
  options: { municipalityUpdateLimit?: number } = {},
): Promise<OpsSnapshot> => {
  const includeEstimates = isCampaignStaff(actor)
  const updateLimit =
    options.municipalityUpdateLimit ?? OPS_MUNICIPALITY_UPDATE_LIMIT_PER_MUNICIPALITY

  const municipalities = (
    await findAllDocs(payload, actor, 'municipality', {
      select: {
        name: true,
        slug: true,
        kind: true,
        city: true,
        region: true,
        ibgeCode: true,
        zoneNumber: true,
        advisors: true,
        priority: true,
        engagementLevel: true,
        levelNote: true,
        levelChangedAt: true,
        expectedVotes: true,
        politicalTrend: true,
        stateDeputies: true,
        lastUpdateAt: true,
        updatedAt: true,
      },
    })
  ).map(mapMunicipality)

  const leaderships = (
    await findAllDocs(payload, actor, 'leadership', {
      // Contact name/phone are part of OpsLeadership — single depth:1 exception.
      depth: 1,
      select: {
        contact: true,
        municipalities: true,
        organizations: true,
        stateDeputies: true,
        exclusive: true,
        supportStatus: true,
        notes: true,
        updatedAt: true,
      },
    })
  ).map(mapLeadership)

  const votePledgeSelect: Record<string, true> = {
    leadership: true,
    municipality: true,
    declaredVotes: true,
    declaredAt: true,
    declaredBy: true,
    updatedAt: true,
  }
  // Defense in depth: never select staff-only estimate fields for non-staff.
  if (includeEstimates) {
    votePledgeSelect.estimatedVotes = true
    votePledgeSelect.estimateNote = true
    votePledgeSelect.estimatedBy = true
    votePledgeSelect.estimatedAt = true
  }

  const votePledges = (
    await findAllDocs(payload, actor, 'votePledge', { select: votePledgeSelect })
  ).map((doc) => mapVotePledge(doc, includeEstimates))

  const activities = (
    await findAllDocs(payload, actor, 'activity', {
      select: {
        title: true,
        slug: true,
        kind: true,
        status: true,
        deputyPresent: true,
        startAt: true,
        endAt: true,
        municipality: true,
        locality: true,
        organizations: true,
        advisors: true,
        leadership: true,
        taskTotal: true,
        taskDoneCount: true,
        updatedAt: true,
      },
    })
  ).map(mapActivity)

  const stateDeputies = (
    await findAllDocs(payload, actor, 'stateDeputy', {
      select: {
        name: true,
        slug: true,
        party: true,
        notes: true,
        updatedAt: true,
      },
    })
  ).map(mapStateDeputy)

  const organizations = (
    await findAllDocs(payload, actor, 'organization', {
      select: {
        name: true,
        slug: true,
        kind: true,
        municipalities: true,
        notes: true,
        updatedAt: true,
      },
    })
  ).map(mapOrganization)

  const demands = (
    await findAllDocs(payload, actor, 'campaignDemand', {
      select: {
        title: true,
        slug: true,
        kind: true,
        municipality: true,
        activity: true,
        leadership: true,
        status: true,
        updatedAt: true,
      },
    })
  ).map(mapDemand)

  const allUpdates = (
    await findAllDocs(payload, actor, 'municipalityUpdate', {
      select: {
        municipality: true,
        author: true,
        kind: true,
        body: true,
        signalType: true,
        updatedAt: true,
        createdAt: true,
      },
      sort: '-updatedAt',
    })
  ).map(mapMunicipalityUpdate)
  const municipalityUpdates = truncateMunicipalityUpdates(allUpdates, updateLimit)

  const goalsDoc = await payload.findGlobal({
    slug: 'campaignGoals',
    depth: 0,
    user: actor,
    overrideAccess: false,
  })
  const goals = mapGoals(goalsDoc as unknown as Record<string, unknown>)

  const snapshot = createEmptyOpsSnapshot(new Date().toISOString())
  return {
    ...snapshot,
    municipalities,
    leaderships,
    votePledges,
    activities,
    stateDeputies,
    organizations,
    demands,
    municipalityUpdates,
    goals,
  }
}
