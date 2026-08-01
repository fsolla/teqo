import 'server-only'

/**
 * B57 daily statewide vote-total snapshots. All Local API writes use an
 * intentional admin bypass — rows are internal aggregates, not user-facing CRUD.
 */

import type { Payload } from 'payload'

import { HOME_SUMMARY_DELTA_WINDOW_DAYS } from '@/lib/campaignHomeSummaryDelta'
import {
  civilDateToUtcMidnightIso,
  formatBahiaCivilDate,
  subtractBahiaCivilDays,
} from '@/lib/campaignTime'
import type { Municipality } from '@/payload-types'
import { aggregateAllPledgesByMunicipality } from '@/utilities/votePledgeData'
import { rollupMunicipalityStaffVotes } from '@/utilities/votePledgeViews'

const SNAPSHOT_COLLECTION = 'campaignVoteSummarySnapshot' as const
const SNAPSHOT_SCOPE_STATEWIDE = 'statewide'
const SNAPSHOT_RETENTION_DAYS = 30

const STATEWIDE_MUNICIPALITY_SELECT = {
  expectedVotes: true,
} as const

const pruneOldCampaignVoteSummarySnapshots = async (
  payload: Payload,
  today: string,
): Promise<void> => {
  const cutoffDay = subtractBahiaCivilDays(today, SNAPSHOT_RETENTION_DAYS)
  await payload.delete({
    collection: SNAPSHOT_COLLECTION,
    where: {
      day: { less_than: civilDateToUtcMidnightIso(cutoffDay) },
    },
    overrideAccess: true,
  })
}

/**
 * Statewide B56 hero scalar for the daily snapshot series (B57 option A).
 * Intentional admin bypass: internal aggregate not tied to the requesting actor's
 * municipality scope — the snapshot is always statewide.
 */
export const loadStatewideStaffVoteTotalCentral = async (payload: Payload): Promise<number> => {
  const [municipalities, pledgeAggregates] = await Promise.all([
    payload
      .find({
        collection: 'municipality',
        depth: 0,
        limit: 0,
        pagination: false,
        select: STATEWIDE_MUNICIPALITY_SELECT,
        overrideAccess: true,
      })
      .then((result) => result.docs as Pick<Municipality, 'id' | 'expectedVotes'>[]),
    aggregateAllPledgesByMunicipality(payload),
  ])

  const rollup = rollupMunicipalityStaffVotes(municipalities, pledgeAggregates)
  return rollup.staffVoteTotalByScenario.central
}

/** Idempotent daily write — first staff home load of the Bahia civil day wins. */
export const recordCampaignVoteSummarySnapshotIfNeeded = async (
  payload: Payload,
  staffVoteTotalCentral: number,
): Promise<void> => {
  const today = formatBahiaCivilDate(new Date())
  const dayIso = civilDateToUtcMidnightIso(today)

  const existing = await payload.find({
    collection: SNAPSHOT_COLLECTION,
    where: {
      and: [{ day: { equals: dayIso } }, { scopeKey: { equals: SNAPSHOT_SCOPE_STATEWIDE } }],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })

  if (existing.docs.length > 0) return

  try {
    await payload.create({
      collection: SNAPSHOT_COLLECTION,
      data: {
        day: dayIso,
        scopeKey: SNAPSHOT_SCOPE_STATEWIDE,
        staffVoteTotalCentral,
      },
      overrideAccess: true,
    })
    await pruneOldCampaignVoteSummarySnapshots(payload, today)
  } catch {
    const raced = await payload.find({
      collection: SNAPSHOT_COLLECTION,
      where: {
        and: [{ day: { equals: dayIso } }, { scopeKey: { equals: SNAPSHOT_SCOPE_STATEWIDE } }],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      overrideAccess: true,
    })
    if (raced.docs.length === 0) throw new Error('Falha ao gravar snapshot diário de estimativa.')
  }
}

/** Live statewide total minus the snapshot on T−7d Bahia civil days; null when the anchor row is missing. */
export const loadCampaignHomeSummaryDelta = async (
  payload: Payload,
  liveStatewideTotal: number,
): Promise<number | null> => {
  const today = formatBahiaCivilDate(new Date())
  const targetDayIso = civilDateToUtcMidnightIso(
    subtractBahiaCivilDays(today, HOME_SUMMARY_DELTA_WINDOW_DAYS),
  )

  const target = await payload.find({
    collection: SNAPSHOT_COLLECTION,
    where: {
      and: [{ day: { equals: targetDayIso } }, { scopeKey: { equals: SNAPSHOT_SCOPE_STATEWIDE } }],
    },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })

  const snapshot = target.docs[0]
  if (!snapshot) return null

  return liveStatewideTotal - snapshot.staffVoteTotalCentral
}
