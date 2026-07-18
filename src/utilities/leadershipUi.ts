import { leadershipSectors, leadershipSupportStatuses } from '@/lib/schemas/leadership'
import type {
  LeadershipStaffListItemViewModel,
  LeadershipStaffViewModel,
} from '@/utilities/leadershipViewModels'

export const leadershipSectorLabels = {
  religioso: 'Religioso',
  sindical: 'Sindical',
  comunitario: 'Comunitário',
  rural: 'Rural',
  empresarial: 'Empresarial',
  juventude: 'Juventude',
  saude: 'Saúde',
  educacao: 'Educação',
  cultura: 'Cultura',
  outro: 'Outro',
} as const

export const leadershipGenderLabels = {
  feminino: 'Feminino',
  masculino: 'Masculino',
  outro: 'Outro',
  nao_informado: 'Não informado',
} as const

export type LeadershipFilterState = {
  q?: string
  status?: LeadershipStaffViewModel['supportStatus']
  sector?: NonNullable<LeadershipStaffViewModel['sector']>
  page?: number
}

type LeadershipSearchParams = {
  leadershipQ?: string | string[]
  leadershipStatus?: string | string[]
  leadershipSector?: string | string[]
  leadershipPage?: string | string[]
  leadership?: string | string[]
  editLeadership?: string | string[]
  newLeadership?: string | string[]
}

export type LeadershipPanelState =
  | { mode: 'closed' }
  | { mode: 'create' }
  | { mode: 'view' | 'edit'; leadershipId: number }

export const getLeadershipPanelFocusTargetId = (leadershipId: number) =>
  `leadership-row-${leadershipId}`

export const nucleusDetailFocusFallbackId = 'nucleus-detail-heading'

const firstValue = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value

const normalizeSearchText = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')

export const parseLeadershipFilterState = (
  params: LeadershipSearchParams,
): LeadershipFilterState => {
  const q = firstValue(params.leadershipQ)?.trim()
  const status = firstValue(params.leadershipStatus)
  const sector = firstValue(params.leadershipSector)
  const rawPage = Number(firstValue(params.leadershipPage))
  const page = Number.isInteger(rawPage) && rawPage > 0 && rawPage <= 10_000 ? rawPage : 1

  return {
    ...(q ? { q } : {}),
    ...(leadershipSupportStatuses.includes(status as (typeof leadershipSupportStatuses)[number])
      ? { status: status as LeadershipFilterState['status'] }
      : {}),
    ...(leadershipSectors.includes(sector as (typeof leadershipSectors)[number])
      ? { sector: sector as LeadershipFilterState['sector'] }
      : {}),
    ...(page > 1 ? { page } : {}),
  }
}

export const filterLeaderships = (
  leaderships: LeadershipStaffListItemViewModel[],
  state: LeadershipFilterState,
): LeadershipStaffListItemViewModel[] => {
  const query = state.q ? normalizeSearchText(state.q) : null

  return leaderships.filter((leadership) => {
    if (state.status && leadership.supportStatus !== state.status) return false
    if (state.sector && leadership.sector !== state.sector) return false
    if (!query) return true

    return normalizeSearchText(`${leadership.name} ${leadership.phone}`).includes(query)
  })
}

export const buildLeadershipFilterHref = (
  nucleusSlug: string,
  state: LeadershipFilterState,
  leadershipId?: number,
): string => {
  const params = new URLSearchParams({ tab: 'leaderships' })
  if (state.q) params.set('leadershipQ', state.q)
  if (state.status) params.set('leadershipStatus', state.status)
  if (state.sector) params.set('leadershipSector', state.sector)
  if (state.page && state.page > 1) params.set('leadershipPage', String(state.page))
  if (leadershipId) params.set('leadership', String(leadershipId))

  return `/campanha/nucleos/${nucleusSlug}?${params.toString()}`
}

export const parseLeadershipPanelState = (
  params: LeadershipSearchParams,
  role: 'geral' | 'coordenador' | 'lideranca',
): LeadershipPanelState => {
  if (role === 'lideranca') return { mode: 'closed' }
  if (firstValue(params.newLeadership) === '1') return { mode: 'create' }

  const leadershipId = Number(firstValue(params.leadership))
  if (!Number.isInteger(leadershipId) || leadershipId <= 0) return { mode: 'closed' }

  return {
    mode: firstValue(params.editLeadership) === '1' ? 'edit' : 'view',
    leadershipId,
  }
}

export const buildLeadershipPanelHref = (
  nucleusSlug: string,
  state: LeadershipFilterState,
  panel: LeadershipPanelState,
): string => {
  const href = new URL(buildLeadershipFilterHref(nucleusSlug, state), 'https://campaign.local')
  if (panel.mode === 'create') href.searchParams.set('newLeadership', '1')
  if (panel.mode === 'view' || panel.mode === 'edit') {
    href.searchParams.set('leadership', String(panel.leadershipId))
  }
  if (panel.mode === 'edit') href.searchParams.set('editLeadership', '1')

  return `${href.pathname}?${href.searchParams.toString()}`
}

export const formatLeadershipPhone = (phone: string): string =>
  phone.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3')
