/**
 * Snapshot composer for the city report (C163).
 *
 * Runs on the homeserver against production, read-only: composes the same
 * loaders the `/campanha` detail/dossier use (no parallel source of truth),
 * projects out PII and fields the report does not need, and returns plain
 * JSON. The render step never touches the database again.
 *
 * Integration layer, not a pure lib: it imports Payload-coupled utilities and
 * is exercised by `tests/int/cityReportSnapshot.int.spec.ts`.
 */

import { FEDERAL_DEPUTY_OFFICE, HISTORICAL_SERIES_YEARS } from '../src/lib/electionResults.ts'
import { getMunicipalityCatalogEntry, municipalityCatalog } from '../src/lib/municipalityCatalog.ts'
import { getMunicipalityVoteRank } from '../src/lib/municipalityVoteRank.ts'
import { normalizeForSearch } from '../src/lib/speechSearch.ts'
import { excerptOffsetSeconds } from '../src/lib/speechVod.ts'
import { campaignRoleLabels } from '../src/utilities/campaignUserProfile.ts'
import { loadMunicipalityDossierData } from '../src/utilities/municipality/municipalityDossierData.ts'
import {
  municipalityElectionGeography,
  municipalityGeographyWhere,
} from '../src/utilities/municipality/municipalityElectionGeography.ts'
import {
  getMunicipalityDetailViewModel,
  resolveAccessibleMunicipalityContext,
} from '../src/utilities/municipality/municipalityPageData.ts'
import { loadAdvisorSummaries } from '../src/utilities/municipality/municipalityViewModels.ts'
import { buildSpeechListWhere } from '../src/utilities/speech/speechListFilters.ts'
import { loadSegmentsForSpeeches } from '../src/utilities/speech/speechPageData.ts'

const SPEECH_LIMIT = 10
const DEMAND_LIMIT = 20
const COMPETITOR_LIMIT = 5
/**
 * Region-relevant speech themes: the acervo search for a small município is
 * nearly always empty, so the report also shows what the deputy said about the
 * REGION and about the themes that matter there. These are the enum values from
 * `SPEECH_TOPICS` (src/lib/speechFacets.ts).
 */
const SPEECH_REGION_TOPICS = [
  'saude',
  'educacao',
  'agricultura',
  'infraestrutura',
  'meio-ambiente',
  'cultura',
  'economia-trabalho',
  'habitacao-cidades',
]
/** Data value of the office enum (only the federal constant is exported today). */
const STATE_DEPUTY_OFFICE = 'deputado_estadual'
const REFERENCE_YEAR = 2022

const projectActivity = (activity) => ({
  id: activity.id,
  title: activity.title,
  status: activity.status,
  startAt: activity.startAt,
  locality: activity.locality,
})

const SPEECH_SELECT = {
  speechAt: true,
  type: true,
  phase: true,
  summary: true,
  officialTextUrl: true,
  youtubeUrl: true,
  vodPlaybackUrl: true,
  excerptTMs: true,
  eventStartAt: true,
  mentionedMunicipalities: true,
  topics: true,
}

/**
 * Projects one speech for the report: the official summary says what the
 * speech is; `mentionExcerpt` is the passage that literally names the matched
 * município (null when the acervo tag has no literal mention in the ASR
 * segments); `matchedMunicipality` is which name matched; the count gives the
 * "tagged among dozens" context; `topics` carries the facet themes.
 */
const projectSpeechRow = (doc, segments, matchNames) => {
  const candidates = matchNames
    .map((name) => ({ name, key: normalizeForSearch(name) }))
    .filter((candidate) => candidate.key)
  const matched = candidates.find(({ key }) =>
    segments.some((segment) => normalizeForSearch(segment.text).includes(key)),
  )
  const mentionSegment = matched
    ? segments.find((segment) => normalizeForSearch(segment.text).includes(matched.key))
    : undefined
  return {
    id: doc.id,
    speechAt: doc.speechAt ?? null,
    type: doc.type ?? null,
    phase: doc.phase ?? null,
    summary: doc.summary ?? null,
    officialTextUrl: doc.officialTextUrl ?? null,
    youtubeUrl: doc.youtubeUrl ?? null,
    vodPlaybackUrl: doc.vodPlaybackUrl ?? null,
    /** Offset of the excerpt inside the session video (YouTube start). */
    youtubeExcerptStartSeconds: excerptOffsetSeconds(doc.excerptTMs, doc.eventStartAt),
    mentionExcerpt: mentionSegment?.text ?? null,
    matchedMunicipality: matched?.name ?? null,
    mentionedMunicipalityCount: Array.isArray(doc.mentionedMunicipalities)
      ? doc.mentionedMunicipalities.length
      : 0,
    topics: Array.isArray(doc.topics) ? doc.topics : [],
  }
}

/**
 * Speeches for the report, in three non-overlapping groups: the município, the
 * rest of its Território de Identidade (mantido separado — região não é a
 * cidade) and the region-relevant themes. A speech already shown in a more
 * specific group is never repeated in the next one.
 */
const loadSpeeches = async (payload, actor, { municipalityID, municipalityName, region }) => {
  const find = (state) =>
    payload.find({
      collection: 'speech',
      where: buildSpeechListWhere({ page: 1, ...state }),
      depth: 0,
      limit: SPEECH_LIMIT,
      sort: '-speechAt',
      select: SPEECH_SELECT,
      user: actor,
      overrideAccess: false,
    })

  const cityResult = await find({ municipalities: [municipalityID] })
  const cityIDs = new Set(cityResult.docs.map((doc) => doc.id))

  const regionIDs = region?.ids ?? []
  const regionResult = regionIDs.length
    ? await find({ municipalities: regionIDs })
    : { docs: [], totalDocs: 0 }
  const regionDocs = regionResult.docs.filter((doc) => !cityIDs.has(doc.id))

  const seen = new Set([...cityIDs, ...regionDocs.map((doc) => doc.id)])
  const topicResult = await find({ topics: SPEECH_REGION_TOPICS })
  const topicDocs = topicResult.docs.filter((doc) => !seen.has(doc.id))

  const allDocs = [...cityResult.docs, ...regionDocs, ...topicDocs]
  const segmentsBySpeech = await loadSegmentsForSpeeches(
    payload,
    actor,
    allDocs.map((doc) => doc.id),
  )
  const segmentsOf = (doc) => segmentsBySpeech.get(doc.id) ?? []
  const cityNames = municipalityName ? [municipalityName] : []
  const regionNames = region?.names ?? []

  return {
    totalCount: cityResult.totalDocs,
    rows: cityResult.docs.map((doc) => projectSpeechRow(doc, segmentsOf(doc), cityNames)),
    region: {
      label: region?.label ?? null,
      totalCount: regionDocs.length,
      rows: regionDocs.map((doc) => projectSpeechRow(doc, segmentsOf(doc), regionNames)),
    },
    topics: {
      themes: SPEECH_REGION_TOPICS,
      totalCount: topicDocs.length,
      rows: topicDocs.map((doc) => projectSpeechRow(doc, segmentsOf(doc), cityNames)),
    },
  }
}

const loadDemands = async (payload, actor, municipalityID) => {
  const result = await payload.find({
    collection: 'campaignDemand',
    where: { municipality: { equals: municipalityID } },
    depth: 0,
    limit: DEMAND_LIMIT,
    sort: '-updatedAt',
    select: { title: true, kind: true, status: true, updatedAt: true },
    user: actor,
    overrideAccess: false,
  })
  return {
    totalCount: result.totalDocs,
    rows: result.docs.map((doc) => ({
      id: doc.id,
      title: doc.title,
      kind: doc.kind,
      status: doc.status,
      updatedAt: doc.updatedAt,
    })),
  }
}

/**
 * Top federal/state deputy candidates by votes inside the município (reference
 * year), with the 2014/2018/2022 series — the report's "main competitors"
 * table. Same TSE collection the app's comparison card reads.
 */
const loadCompetitors = async (payload, actor, slug, office) => {
  const entry = getMunicipalityCatalogEntry(slug)
  if (!entry) return { office, rows: [] }
  const result = await payload.find({
    collection: 'electionCandidateVote',
    where: {
      and: [
        { year: { in: [...HISTORICAL_SERIES_YEARS] } },
        { office: { equals: office } },
        { turn: { equals: '1' } },
        { voteType: { equals: 'nominal' } },
        municipalityGeographyWhere(municipalityElectionGeography(entry)),
      ],
    },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { year: true, candidateNumber: true, candidateName: true, party: true, votes: true },
    user: actor,
    overrideAccess: false,
  })

  const byCandidate = new Map()
  for (const row of result.docs) {
    const current = byCandidate.get(row.candidateNumber) ?? {
      candidateNumber: row.candidateNumber,
      name: row.candidateName,
      party: row.party ?? null,
      votesByYear: {},
    }
    current.votesByYear[String(row.year)] =
      (current.votesByYear[String(row.year)] ?? 0) + (row.votes ?? 0)
    byCandidate.set(row.candidateNumber, current)
  }

  const rows = [...byCandidate.values()]
    .sort(
      (left, right) =>
        (right.votesByYear[String(REFERENCE_YEAR)] ?? 0) -
          (left.votesByYear[String(REFERENCE_YEAR)] ?? 0) ||
        left.candidateNumber - right.candidateNumber,
    )
    .slice(0, COMPETITOR_LIMIT)
  return { office, year: REFERENCE_YEAR, rows }
}

/**
 * Composes the snapshot. `actor` must be a real `campaignUser` doc (the CLI
 * resolves and fails closed); loaders run with `overrideAccess: false` so the
 * snapshot is exactly what that role may read.
 *
 * @param {object} params
 * @param {import('payload').Payload} params.payload
 * @param {import('../src/payload-types.ts').CampaignUser} params.actor
 * @param {string} params.slug
 * @param {string} [params.readAt]
 * @param {string | null} [params.codeSha]
 * @param {string | null} [params.database]
 */
export const composeCityReportSnapshot = async ({
  payload,
  actor,
  slug,
  readAt = new Date().toISOString(),
  codeSha = null,
  database = null,
}) => {
  const context = await resolveAccessibleMunicipalityContext(payload, actor, slug)
  const detail = await getMunicipalityDetailViewModel(payload, context, actor)
  const dossier = await loadMunicipalityDossierData(payload, actor, detail)

  const catalogEntry = getMunicipalityCatalogEntry(slug)
  const regionSlugs = catalogEntry
    ? municipalityCatalog.filter((row) => row.region === catalogEntry.region).map((row) => row.slug)
    : []
  const regionResult = regionSlugs.length
    ? await payload.find({
        collection: 'municipality',
        where: { slug: { in: regionSlugs } },
        depth: 0,
        limit: 0,
        pagination: false,
        select: { slug: true, name: true },
        user: actor,
        overrideAccess: false,
      })
    : { docs: [] }
  const regionDocs = regionResult.docs.filter((doc) => doc.slug !== slug)
  const region = {
    label: detail.region ?? catalogEntry?.region ?? null,
    ids: regionDocs.map((doc) => doc.id).filter((id) => id !== context.id),
    names: regionDocs.map((doc) => doc.name).filter(Boolean),
  }

  const [advisors, speeches, demands, federalCompetitors, stateCompetitors] = await Promise.all([
    loadAdvisorSummaries(payload, actor, detail.advisorIDs),
    loadSpeeches(payload, actor, {
      municipalityID: context.id,
      municipalityName: detail.city,
      region,
    }),
    loadDemands(payload, actor, context.id),
    loadCompetitors(payload, actor, slug, FEDERAL_DEPUTY_OFFICE),
    loadCompetitors(payload, actor, slug, STATE_DEPUTY_OFFICE),
  ])

  const strategy = detail.strategy
  const rank2022 = getMunicipalityVoteRank(slug)

  return {
    meta: {
      source: 'Base Teqo (produção, leitura read-only)',
      readAt,
      readOnly: true,
      database,
      codeSha,
      actorId: actor.id,
      actorName: actor.name ?? null,
      actorRole: actor.role,
      actorRoleLabel: campaignRoleLabels[actor.role] ?? actor.role,
    },
    municipality: {
      id: context.id,
      slug: context.slug,
      name: detail.name,
      kind: detail.kind,
      region: detail.region,
      ibgeCode: detail.ibgeCode,
    },
    electoral: {
      series: dossier.baseline?.series ?? [],
      rank2022,
    },
    goal: dossier.goalAccount
      ? {
          suggestedGoal: dossier.goalAccount.suggestedGoal,
          goalCoverage: dossier.goalAccount.goalCoverage,
          territorialClass: { class: dossier.goalAccount.territorialClass.class },
        }
      : null,
    pledges: {
      declaredTotal: dossier.pledgeAggregate.declaredTotal,
      lastPledgeAt: dossier.pledgeAggregate.lastPledgeAt,
    },
    leaderships: {
      totalCount: dossier.leaderships.totalCount,
      rows: dossier.leaderships.rows.map((row) => ({
        id: row.id,
        name: row.name,
        supportStatus: row.supportStatus,
        organizationNames: row.organizationNames,
        hasAppAccess: row.hasAppAccess,
        updatedAt: row.updatedAt,
      })),
    },
    advisors: advisors.map((advisor) => ({ id: advisor.id, name: advisor.name })),
    signals: {
      totalCount: dossier.signals.totalCount,
      rows: dossier.signals.rows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt,
        body: row.body,
        polarity: row.polarity,
        urgent: row.urgent,
        adversarySignal: row.adversarySignal,
        responsibleName: row.responsibleName,
      })),
    },
    activities: {
      upcoming: dossier.upcomingActivities.map(projectActivity),
      recent: dossier.recentActivities.map(projectActivity),
    },
    conjuncture: strategy
      ? {
          priority: strategy.priority,
          expectedVotes: strategy.expectedVotes,
          politicalTrend: strategy.politicalTrend,
          engagementLevel: strategy.engagementLevel,
          levelNote: strategy.levelNote,
          strengths: strategy.strengths,
          risks: strategy.risks,
          dobradinhaNotes: strategy.dobradinhaNotes,
          nextSteps: strategy.nextSteps,
          budgetNotes: strategy.budgetNotes,
          stateDeputies: strategy.stateDeputies.map((deputy) => ({
            id: deputy.id,
            name: deputy.name,
            party: deputy.party,
          })),
        }
      : null,
    speeches,
    demands,
    competitors: {
      referenceYear: REFERENCE_YEAR,
      federal: federalCompetitors.rows,
      state: stateCompetitors.rows,
    },
    demographics: dossier.demographics,
  }
}
