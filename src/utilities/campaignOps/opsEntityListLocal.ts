/**
 * OH12 — pure filter / sort / page helpers for mirror-backed ops lists
 * (leadership, state deputy, organization, demand).
 */
import type {
  OpsDemand,
  OpsLeadership,
  OpsOrganization,
  OpsStateDeputy,
} from '@/lib/campaignOps/opsContract'
import { demandPageSize, type DemandListState } from '@/utilities/demand/demandListUrl'
import {
  leadershipPageSize,
  resolveLeadershipListSort,
  type LeadershipListState,
} from '@/utilities/leadership/leadershipListUrl'
import {
  organizationPageSize,
  type OrganizationListState,
} from '@/utilities/organization/organizationListUrl'
import {
  NO_PARTY_FILTER_VALUE,
  resolveStateDeputyListSort,
  stateDeputyPageSize,
  type StateDeputyListState,
} from '@/utilities/stateDeputyListUrl'

type OpsPagedResult<T> = {
  rows: T[]
  totalDocs: number
  totalPages: number
  page: number
}

const paginate = <T>(rows: T[], page: number, pageSize: number): OpsPagedResult<T> => {
  const totalDocs = rows.length
  const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize))
  const safePage = Math.min(Math.max(1, page), totalPages)
  const start = (safePage - 1) * pageSize
  return {
    rows: rows.slice(start, start + pageSize),
    totalDocs,
    totalPages,
    page: safePage,
  }
}

export const filterSortPageOpsLeaderships = (
  rows: ReadonlyArray<OpsLeadership>,
  state: LeadershipListState,
): OpsPagedResult<OpsLeadership> => {
  let filtered = [...rows]
  if (state.q) {
    const needle = state.q.toLocaleLowerCase('pt-BR')
    filtered = filtered.filter((row) =>
      row.contact.name.toLocaleLowerCase('pt-BR').includes(needle),
    )
  }
  if (state.statuses?.length) {
    filtered = filtered.filter((row) => state.statuses!.includes(row.supportStatus))
  }
  if (state.municipalities?.length) {
    filtered = filtered.filter((row) =>
      state.municipalities!.some((id) => row.municipalities.includes(id)),
    )
  }
  // `access` (com/sem app) needs campaignUser join — not in mirror; ignore offline.

  const { sort, dir } = resolveLeadershipListSort(state)
  const factor = dir === 'asc' ? 1 : -1
  filtered.sort((left, right) => {
    let cmp = 0
    if (sort === 'name') {
      cmp = left.contact.name.localeCompare(right.contact.name, 'pt-BR')
    } else if (sort === 'supportStatus') {
      cmp = left.supportStatus.localeCompare(right.supportStatus, 'pt-BR')
    } else {
      cmp = left.updatedAt.localeCompare(right.updatedAt)
    }
    if (cmp !== 0) return cmp * factor
    return left.contact.name.localeCompare(right.contact.name, 'pt-BR')
  })

  return paginate(filtered, state.page, leadershipPageSize)
}

export const filterSortPageOpsStateDeputies = (
  rows: ReadonlyArray<OpsStateDeputy>,
  state: StateDeputyListState,
): OpsPagedResult<OpsStateDeputy> => {
  let filtered = [...rows]
  if (state.q) {
    const needle = state.q.toLocaleLowerCase('pt-BR')
    filtered = filtered.filter((row) => row.name.toLocaleLowerCase('pt-BR').includes(needle))
  }
  if (state.parties?.length) {
    filtered = filtered.filter((row) => {
      const party = row.party?.trim() ? row.party : null
      return state.parties!.some((value) =>
        value === NO_PARTY_FILTER_VALUE ? party === null : party === value,
      )
    })
  }

  const { sort, dir } = resolveStateDeputyListSort(state)
  const factor = dir === 'asc' ? 1 : -1
  filtered.sort((left, right) => {
    let cmp = 0
    if (sort === 'party') {
      cmp = (left.party ?? '').localeCompare(right.party ?? '', 'pt-BR')
    } else {
      cmp = left.name.localeCompare(right.name, 'pt-BR')
    }
    if (cmp !== 0) return cmp * factor
    return left.name.localeCompare(right.name, 'pt-BR')
  })

  return paginate(filtered, state.page, stateDeputyPageSize)
}

export const filterSortPageOpsOrganizations = (
  rows: ReadonlyArray<OpsOrganization>,
  state: OrganizationListState,
): OpsPagedResult<OpsOrganization> => {
  let filtered = [...rows]
  if (state.q) {
    const needle = state.q.toLocaleLowerCase('pt-BR')
    filtered = filtered.filter((row) => row.name.toLocaleLowerCase('pt-BR').includes(needle))
  }
  if (state.kind) {
    filtered = filtered.filter((row) => row.kind === state.kind)
  }
  filtered.sort((left, right) => left.name.localeCompare(right.name, 'pt-BR'))
  return paginate(filtered, state.page, organizationPageSize)
}

export const filterSortPageOpsDemands = (
  rows: ReadonlyArray<OpsDemand>,
  state: DemandListState,
): OpsPagedResult<OpsDemand> => {
  let filtered = [...rows]
  if (state.status) {
    filtered = filtered.filter((row) => row.status === state.status)
  }
  if (state.kind) {
    filtered = filtered.filter((row) => row.kind === state.kind)
  }
  if (state.activityId) {
    filtered = filtered.filter((row) => row.activity === state.activityId)
  }
  filtered.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return paginate(filtered, state.page, demandPageSize)
}
