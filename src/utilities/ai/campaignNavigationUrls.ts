import type { BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import {
  CAMPAIGN_CONCEPTS_PATH,
  campaignConceptHref,
  campaignIntelligenceConcepts,
  type CampaignConceptId,
} from '@/lib/campaignIntelligenceConcepts'
import {
  CAMPAIGN_AGENDA_HOME,
  CAMPAIGN_HOME,
  CAMPAIGN_PROFILE_HOME,
  LEADER_CONTACTS_HOME,
} from '@/lib/campaignPaths'
import { ACTIVITY_TOUR_COMPOSER_PATH } from '@/lib/campaignQuickActionPaths'
import type { CampaignRole } from '@/lib/campaignRoles'
import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import { isMunicipalitySlug } from '@/lib/municipalityCatalog'
import { activityStatuses } from '@/lib/schemas/activity'
import {
  campaignDemandKinds,
  campaignDemandStatuses,
  type CampaignDemandKind,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import { leadershipSupportStatuses, type SupportStatus } from '@/lib/schemas/leadership'
import { organizationKinds, type OrganizationKind } from '@/lib/schemas/organization'
import {
  isSupporterSource,
  isSupporterVoteIntention,
  resolveBahiaMunicipality,
  type SupporterSource,
  type SupporterVoteIntention,
} from '@/lib/schemas/supporter'
import type { CampaignUser } from '@/payload-types'
import {
  activityTabs,
  buildActivityAgendaHref,
  buildActivityListHref,
  type ActivityTab,
} from '@/utilities/activityUi'
import { advisorListHrefForPage } from '@/utilities/advisor/advisorListUrl'
import { buildDemandListHref } from '@/utilities/demand/demandListUrl'
import { buildLeadershipListHref } from '@/utilities/leadership/leadershipListUrl'
import {
  politicalTrendLabels,
  territorialClassLabels,
  type PoliticalTrendStatus,
} from '@/utilities/municipality/municipalityLabels'
import {
  buildMunicipalityListHref,
  municipalityListLevelFilterValues,
  type MunicipalityListLevelFilterValue,
} from '@/utilities/municipality/municipalityListUrl'
import type { MunicipalityTerritorialClass } from '@/utilities/municipality/municipalityTerritorialClass'
import { buildOrganizationListHref } from '@/utilities/organization/organizationListUrl'
import { buildStateDeputyListHref } from '@/utilities/stateDeputyListUrl'
import { buildSupporterListHref, canAccessSupporterArea } from '@/utilities/supporter/supporterUi'
import type {
  TerritoryCoverage,
  TerritoryListSortKey,
} from '@/utilities/territory/territoryListUrl'
import { buildTerritoryListHref } from '@/utilities/territory/territoryListUrl'

const CAMPAIGN_STAFF_QUADRO_PATH = '/campanha/quadro' as const

const campaignConceptIdSet = new Set<string>(
  campaignIntelligenceConcepts.map((concept) => concept.id),
)

const politicalTrendSet = new Set<string>(Object.keys(politicalTrendLabels))
const territorialClassSet = new Set<string>(Object.keys(territorialClassLabels))
const municipalityLevelFilterSet = new Set<string>(municipalityListLevelFilterValues)

const STAFF_DESTINATIONS = new Set<CampaignNavigationDestination>([
  'quadro',
  'conceitos',
  'giros',
  'municipality',
  'leadership',
  'dobradinha',
  'organization',
  'activity',
  'demand',
  'supporter',
  'municipalityList',
  'leadershipList',
  'dobradinhaList',
  'organizationList',
  'activityList',
  'demandList',
  'supporterList',
  'territoryList',
])

const UNRESTRICTED_DESTINATIONS = new Set<CampaignNavigationDestination>(['advisor', 'advisorList'])

type CampaignNavigationDestination =
  | 'home'
  | 'quadro'
  | 'perfil'
  | 'conceitos'
  | 'giros'
  | 'leaderContacts'
  | 'municipality'
  | 'leadership'
  | 'dobradinha'
  | 'advisor'
  | 'organization'
  | 'activity'
  | 'demand'
  | 'supporter'
  | 'municipalityList'
  | 'leadershipList'
  | 'dobradinhaList'
  | 'advisorList'
  | 'organizationList'
  | 'activityList'
  | 'demandList'
  | 'supporterList'
  | 'territoryList'

type BaseLinkFields = { label?: string }

export type CampaignNavigationLinkRequest =
  | (BaseLinkFields & { destination: 'home' })
  | (BaseLinkFields & { destination: 'quadro' })
  | (BaseLinkFields & { destination: 'perfil' })
  | (BaseLinkFields & { destination: 'giros' })
  | (BaseLinkFields & { destination: 'leaderContacts' })
  | (BaseLinkFields & { destination: 'conceitos'; conceptId?: CampaignConceptId })
  | (BaseLinkFields & { destination: 'municipality'; slug: string })
  | (BaseLinkFields & { destination: 'leadership'; id: number })
  | (BaseLinkFields & { destination: 'dobradinha'; slug: string })
  | (BaseLinkFields & { destination: 'advisor'; id: number })
  | (BaseLinkFields & { destination: 'organization'; slug: string })
  | (BaseLinkFields & { destination: 'activity'; slug: string })
  | (BaseLinkFields & { destination: 'demand'; slug: string })
  | (BaseLinkFields & { destination: 'supporter'; id: number })
  | (BaseLinkFields & {
      destination: 'municipalityList'
      q?: string
      slugs?: string[]
      regions?: BahiaIdentityTerritory[]
      advisors?: number[]
      coverage?: 'com_assessor' | 'sem_assessor'
      priority?: 'alta'
      trends?: PoliticalTrendStatus[]
      classes?: MunicipalityTerritorialClass[]
      levels?: MunicipalityListLevelFilterValue[]
    })
  | (BaseLinkFields & {
      destination: 'leadershipList'
      q?: string
      statuses?: SupportStatus[]
      municipalities?: number[]
      organizations?: number[]
      stateDeputies?: number[]
      access?: 'com' | 'sem'
    })
  | (BaseLinkFields & {
      destination: 'dobradinhaList'
      q?: string
      parties?: string[]
    })
  | (BaseLinkFields & {
      destination: 'advisorList'
      q?: string
      municipalities?: number[]
    })
  | (BaseLinkFields & {
      destination: 'organizationList'
      q?: string
      kind?: OrganizationKind
    })
  | (BaseLinkFields & {
      destination: 'activityList'
      tab?: ActivityTab
      q?: string
      tag?: string
      status?: (typeof activityStatuses)[number]
      municipality?: number
      deputyPresent?: boolean
    })
  | (BaseLinkFields & {
      destination: 'demandList'
      q?: string
      status?: CampaignDemandStatus
      kind?: CampaignDemandKind
      activityId?: number
    })
  | (BaseLinkFields & {
      destination: 'supporterList'
      q?: string
      voteIntention?: SupporterVoteIntention
      source?: SupporterSource
      city?: string
      municipality?: number
    })
  | (BaseLinkFields & {
      destination: 'territoryList'
      q?: string
      regions?: BahiaIdentityTerritory[]
      coverage?: TerritoryCoverage
      sort?: TerritoryListSortKey
      dir?: 'asc' | 'desc'
    })

type CampaignNavigationLinkSuccess = { path: string; label: string }

type CampaignNavigationLinkFailure = {
  error: string
  alternatives?: string[]
}

type CampaignNavigationLinkOutcome =
  | ({ ok: true } & CampaignNavigationLinkSuccess)
  | ({ ok: false } & CampaignNavigationLinkFailure)

type BuildCampaignNavigationLinksResult = {
  links: CampaignNavigationLinkSuccess[]
  errors?: Array<{ index: number } & CampaignNavigationLinkFailure>
}

const defaultLabel = (fallback: string, label?: string): string => label?.trim() || fallback

const positiveInt = (value: number, _field: string): number | null => {
  if (!Number.isSafeInteger(value) || value <= 0) return null
  return value
}

const detailSlug = (value: string, _field: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes('/')) return null
  if (trimmed === 'nova' || trimmed === 'giros') return null
  return trimmed
}

const assertDestinationAccess = (
  role: CampaignRole,
  destination: CampaignNavigationDestination,
): CampaignNavigationLinkFailure | null => {
  if (role === 'leader') {
    if (destination === 'home' || destination === 'perfil' || destination === 'leaderContacts') {
      return null
    }
    return {
      error:
        'Este destino não está disponível para liderança. Use Início, Meus contatos ou Perfil.',
      alternatives: [CAMPAIGN_HOME, LEADER_CONTACTS_HOME, CAMPAIGN_PROFILE_HOME],
    }
  }

  if (UNRESTRICTED_DESTINATIONS.has(destination) && !isUnrestrictedCampaignRole(role)) {
    return {
      error: 'A área de assessores é restrita a coordenador e candidato.',
    }
  }

  if (STAFF_DESTINATIONS.has(destination) && !isStaffCampaignRole(role)) {
    return { error: 'Este destino exige perfil de equipe da campanha.' }
  }

  if (
    (destination === 'supporter' || destination === 'supporterList') &&
    !canAccessSupporterArea(role)
  ) {
    return { error: 'A área de apoiadores não está disponível para este perfil.' }
  }

  return null
}

const buildPathForRequest = (
  request: CampaignNavigationLinkRequest,
): CampaignNavigationLinkOutcome => {
  switch (request.destination) {
    case 'home':
      return { ok: true, path: CAMPAIGN_HOME, label: defaultLabel('Início', request.label) }
    case 'quadro':
      return {
        ok: true,
        path: CAMPAIGN_STAFF_QUADRO_PATH,
        label: defaultLabel('Quadro', request.label),
      }
    case 'perfil':
      return { ok: true, path: CAMPAIGN_PROFILE_HOME, label: defaultLabel('Perfil', request.label) }
    case 'leaderContacts':
      return {
        ok: true,
        path: LEADER_CONTACTS_HOME,
        label: defaultLabel('Meus contatos', request.label),
      }
    case 'giros':
      return {
        ok: true,
        path: ACTIVITY_TOUR_COMPOSER_PATH,
        label: defaultLabel('Compositor de giro', request.label),
      }
    case 'conceitos': {
      const path =
        request.conceptId && campaignConceptIdSet.has(request.conceptId)
          ? campaignConceptHref(request.conceptId)
          : CAMPAIGN_CONCEPTS_PATH
      const label =
        request.label?.trim() ||
        (request.conceptId ? `Conceito: ${request.conceptId}` : 'Conceitos')
      return { ok: true, path, label }
    }
    case 'municipality': {
      if (!isMunicipalitySlug(request.slug)) {
        return {
          ok: false,
          error: `Slug de município inválido: "${request.slug}". Resolva o município com searchEntities antes de montar o link.`,
        }
      }
      return {
        ok: true,
        path: `/campanha/municipios/${request.slug}`,
        label: defaultLabel(`Município`, request.label),
      }
    }
    case 'leadership': {
      const id = positiveInt(request.id, 'id')
      if (id === null) {
        return { ok: false, error: 'ID de liderança inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/liderancas/${id}`,
        label: defaultLabel('Liderança', request.label),
      }
    }
    case 'dobradinha': {
      const slug = detailSlug(request.slug, 'slug')
      if (!slug) {
        return { ok: false, error: 'Slug de dobradinha inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/dobradinhas/${slug}`,
        label: defaultLabel('Dobradinha', request.label),
      }
    }
    case 'advisor': {
      const id = positiveInt(request.id, 'id')
      if (id === null) {
        return { ok: false, error: 'ID de assessor inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/assessores/${id}`,
        label: defaultLabel('Assessor', request.label),
      }
    }
    case 'organization': {
      const slug = detailSlug(request.slug, 'slug')
      if (!slug) {
        return { ok: false, error: 'Slug de organização inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/organizacoes/${slug}`,
        label: defaultLabel('Organização', request.label),
      }
    }
    case 'activity': {
      const slug = detailSlug(request.slug, 'slug')
      if (!slug) {
        return { ok: false, error: 'Slug de atividade inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/atividades/${slug}`,
        label: defaultLabel('Atividade', request.label),
      }
    }
    case 'demand': {
      const slug = detailSlug(request.slug, 'slug')
      if (!slug) {
        return { ok: false, error: 'Slug de demanda inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/demandas/${slug}`,
        label: defaultLabel('Demanda', request.label),
      }
    }
    case 'supporter': {
      const id = positiveInt(request.id, 'id')
      if (id === null) {
        return { ok: false, error: 'ID de apoiador inválido.' }
      }
      return {
        ok: true,
        path: `/campanha/apoiadores/${id}`,
        label: defaultLabel('Apoiador', request.label),
      }
    }
    case 'municipalityList': {
      const slugs = request.slugs?.filter(isMunicipalitySlug)
      const advisors = request.advisors?.filter((id) => positiveInt(id, 'advisor') !== null)
      const trends = request.trends?.filter((t): t is PoliticalTrendStatus =>
        politicalTrendSet.has(t),
      )
      const classes = request.classes?.filter((c): c is MunicipalityTerritorialClass =>
        territorialClassSet.has(c),
      )
      const levels = request.levels?.filter((level): level is MunicipalityListLevelFilterValue =>
        municipalityLevelFilterSet.has(level),
      )
      const path = buildMunicipalityListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(slugs?.length ? { slugs } : {}),
          ...(request.regions?.length ? { regions: request.regions } : {}),
          ...(advisors?.length ? { advisors } : {}),
          ...(request.coverage ? { coverage: request.coverage } : {}),
          ...(request.priority ? { priority: request.priority } : {}),
          ...(trends?.length ? { trends } : {}),
          ...(classes?.length ? { classes } : {}),
          ...(levels?.length ? { levels } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Municípios', request.label) }
    }
    case 'leadershipList': {
      const statuses = request.statuses?.filter((s): s is SupportStatus =>
        leadershipSupportStatuses.includes(s),
      )
      const municipalities = request.municipalities?.filter(
        (id) => positiveInt(id, 'municipality') !== null,
      )
      const organizations = request.organizations?.filter(
        (id) => positiveInt(id, 'organization') !== null,
      )
      const stateDeputies = request.stateDeputies?.filter(
        (id) => positiveInt(id, 'stateDeputy') !== null,
      )
      const path = buildLeadershipListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(statuses?.length ? { statuses } : {}),
          ...(municipalities?.length ? { municipalities } : {}),
          ...(organizations?.length ? { organizations } : {}),
          ...(stateDeputies?.length ? { stateDeputies } : {}),
          ...(request.access ? { access: request.access } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Lideranças', request.label) }
    }
    case 'dobradinhaList': {
      const path = buildStateDeputyListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(request.parties?.length ? { parties: request.parties } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Dobradinhas', request.label) }
    }
    case 'advisorList': {
      const municipalities = request.municipalities?.filter(
        (id) => positiveInt(id, 'municipality') !== null,
      )
      const path = advisorListHrefForPage(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(municipalities?.length ? { municipalities } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Assessores', request.label) }
    }
    case 'organizationList': {
      const kind =
        request.kind && organizationKinds.includes(request.kind) ? request.kind : undefined
      const path = buildOrganizationListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(kind ? { kind } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Organizações', request.label) }
    }
    case 'activityList': {
      const tab = request.tab && activityTabs.includes(request.tab) ? request.tab : undefined
      const tag = request.tag?.trim() ? request.tag.trim() : undefined
      const status =
        request.status && activityStatuses.includes(request.status) ? request.status : undefined
      const municipality =
        request.municipality !== undefined
          ? positiveInt(request.municipality, 'municipality')
          : undefined
      const usesLegacyList = Boolean(request.q?.trim() || tab || status)
      if (usesLegacyList && request.deputyPresent) {
        return {
          ok: false,
          error:
            'O filtro de deputado presente pertence à Agenda e não pode ser combinado com busca, aba ou status da lista antiga.',
          alternatives: [CAMPAIGN_AGENDA_HOME, '/campanha/atividades'],
        }
      }
      const path = usesLegacyList
        ? buildActivityListHref(
            {
              page: 1,
              tab: tab ?? 'proximos',
              ...(request.q?.trim() ? { q: request.q.trim() } : {}),
              ...(tag ? { tag } : {}),
              ...(status ? { status } : {}),
              ...(municipality ? { municipality } : {}),
            },
            1,
          )
        : buildActivityAgendaHref({
            ...(tag ? { tag } : {}),
            ...(municipality ? { municipality } : {}),
            ...(request.deputyPresent ? { deputyPresent: true } : {}),
          })
      return {
        ok: true,
        path,
        label: defaultLabel(usesLegacyList ? 'Atividades' : 'Agenda', request.label),
      }
    }
    case 'demandList': {
      const status =
        request.status && campaignDemandStatuses.includes(request.status)
          ? request.status
          : undefined
      const kind =
        request.kind && campaignDemandKinds.includes(request.kind) ? request.kind : undefined
      const activityId =
        request.activityId !== undefined ? positiveInt(request.activityId, 'activity') : undefined
      const path = buildDemandListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(status ? { status } : {}),
          ...(kind ? { kind } : {}),
          ...(activityId ? { activityId } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Demandas', request.label) }
    }
    case 'supporterList': {
      const voteIntention =
        request.voteIntention && isSupporterVoteIntention(request.voteIntention)
          ? request.voteIntention
          : undefined
      const source =
        request.source && isSupporterSource(request.source) ? request.source : undefined
      const city = request.city ? (resolveBahiaMunicipality(request.city) ?? undefined) : undefined
      const municipality =
        request.municipality !== undefined
          ? positiveInt(request.municipality, 'municipality')
          : undefined
      const path = buildSupporterListHref(
        {
          page: 1,
          ...(request.q?.trim() ? { q: request.q.trim() } : {}),
          ...(voteIntention ? { voteIntention } : {}),
          ...(source ? { source } : {}),
          ...(city ? { city } : {}),
          ...(municipality ? { municipality } : {}),
        },
        1,
      )
      return { ok: true, path, label: defaultLabel('Apoiadores', request.label) }
    }
    case 'territoryList': {
      const path = buildTerritoryListHref({
        ...(request.q?.trim() ? { q: request.q.trim() } : {}),
        ...(request.regions?.length ? { regions: request.regions } : {}),
        ...(request.coverage ? { coverage: request.coverage } : {}),
        ...(request.sort ? { sort: request.sort } : {}),
        ...(request.dir ? { dir: request.dir } : {}),
      })
      return { ok: true, path, label: defaultLabel('Territórios', request.label) }
    }
    default: {
      const _exhaustive: never = request
      return _exhaustive
    }
  }
}

export const buildCampaignNavigationLink = (
  role: CampaignUser['role'],
  request: CampaignNavigationLinkRequest,
): CampaignNavigationLinkOutcome => {
  const accessError = assertDestinationAccess(role, request.destination)
  if (accessError) return { ok: false, ...accessError }

  return buildPathForRequest(request)
}

export const buildCampaignNavigationLinks = (
  role: CampaignUser['role'],
  requests: CampaignNavigationLinkRequest[],
): BuildCampaignNavigationLinksResult => {
  const links: CampaignNavigationLinkSuccess[] = []
  const errors: Array<{ index: number } & CampaignNavigationLinkFailure> = []

  requests.forEach((request, index) => {
    const outcome = buildCampaignNavigationLink(role, request)
    if (outcome.ok) {
      links.push({ path: outcome.path, label: outcome.label })
      return
    }
    errors.push({ index, error: outcome.error, alternatives: outcome.alternatives })
  })

  return errors.length ? { links, errors } : { links }
}
