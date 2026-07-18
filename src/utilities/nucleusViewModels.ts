import type { CampaignUser, ElectoralNucleus } from '@/payload-types'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

const asStringArray = (value: string[] | null | undefined): string[] =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []

export const nucleusFormSelect = {
  name: true,
  slug: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  territoryNotes: true,
  organizationKind: true,
  organizationLabel: true,
  sectorKind: true,
  tseZones: true,
  ticketAlliance: true,
} as const

export const nucleusListSelect = {
  name: true,
  slug: true,
  coordinators: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  organizationKind: true,
  organizationLabel: true,
  tseZones: true,
  confirmedVoteEstimate: true,
  proposedVoteEstimate: true,
  lastUpdateAt: true,
} as const

export type NucleusListViewModel = {
  id: number
  name: string
  slug: string
  coordinators: Array<{ id: number; name: string }>
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  organizationKind: ElectoralNucleus['organizationKind']
  organizationLabel: string | null
  tseZones: number[]
  confirmedVoteEstimate: number | null
  proposedVoteEstimate: number | null
  lastUpdateAt: string | null
}

export const nucleusStaffDetailSelect = {
  name: true,
  slug: true,
  status: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  territoryNotes: true,
  organizationKind: true,
  organizationLabel: true,
  tseZones: { zoneNumber: true },
  voterProfiles: {
    label: true,
    ageRange: true,
    incomeBand: true,
    occupation: true,
    localTraits: true,
    notes: true,
  },
  strengths: { text: true },
  risks: { text: true },
  ticketAlliance: {
    partnerName: true,
    office: true,
    isCampaignPartner: true,
    notes: true,
  },
  confirmedVoteEstimate: true,
  confirmedVoteEstimateAt: true,
  confirmedVoteEstimateBy: true,
  proposedVoteEstimate: true,
  proposedVoteEstimateAt: true,
  proposedVoteEstimateBy: true,
  proposedVoteEstimateVersion: true,
  primaryContact: true,
} as const

export const nucleusLeadershipDetailSelect = {
  name: true,
  slug: true,
  status: true,
  regions: true,
  cities: true,
  neighborhoods: true,
  locality: true,
  organizationKind: true,
  organizationLabel: true,
  tseZones: { zoneNumber: true },
  confirmedVoteEstimate: true,
} as const

export type NucleusFormViewModel = {
  id: number
  name: string
  slug: string
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  territoryNotes: string | null
  organizationKind: ElectoralNucleus['organizationKind']
  organizationLabel: string | null
  sectorKind: ElectoralNucleus['sectorKind']
  tseZones: number[]
  ticketAlliance: {
    partnerName: string | null
    office: string | null
    isCampaignPartner: boolean
    notes: string | null
  } | null
}

export type StaffNucleusTabsViewModel = {
  kind: 'staff'
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  territoryNotes: string | null
  tseZones: number[]
  voterProfiles: Array<{
    label: string
    ageRange: string | null
    incomeBand: string | null
    occupation: string | null
    localTraits: string | null
    notes: string | null
  }>
  strengths: Array<{ text: string }>
  risks: Array<{ text: string }>
  ticketAlliance: {
    partnerName: string | null
    office: string | null
    isCampaignPartner: boolean
    notes: string | null
  } | null
}

export type LeadershipNucleusTabsViewModel = {
  kind: 'leadership'
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  tseZones: number[]
}

export type NucleusTabsViewModel = StaffNucleusTabsViewModel | LeadershipNucleusTabsViewModel

type NucleusDetailBaseViewModel = {
  id: number
  name: string
  slug: string
  status: ElectoralNucleus['status']
  regions: string[]
  cities: string[]
  neighborhoods: string[]
  locality: string | null
  organizationKind: ElectoralNucleus['organizationKind']
  organizationLabel: string | null
  tseZones: number[]
  confirmedVoteEstimate: number | null
}

export type StaffNucleusDetailViewModel = NucleusDetailBaseViewModel & {
  kind: 'staff'
  confirmedVoteEstimateAt: string | null
  confirmedVoteEstimateBy: string | null
  proposedVoteEstimate: number | null
  proposedVoteEstimateAt: string | null
  proposedVoteEstimateBy: string | null
  proposedVoteEstimateVersion: string | null
  primaryContactId: number | null
  tabs: StaffNucleusTabsViewModel
}

export type LeadershipNucleusDetailViewModel = NucleusDetailBaseViewModel & {
  kind: 'leadership'
  tabs: LeadershipNucleusTabsViewModel
}

export type NucleusDetailViewModel = StaffNucleusDetailViewModel | LeadershipNucleusDetailViewModel

const relationshipName = (relationship: number | CampaignUser | null | undefined): string | null =>
  isPopulatedRelationship<CampaignUser>(relationship) ? relationship.name : null

export const toNucleusListViewModel = (nucleus: ElectoralNucleus): NucleusListViewModel => ({
  id: nucleus.id,
  name: nucleus.name,
  slug: nucleus.slug,
  coordinators:
    nucleus.coordinators
      ?.filter((coordinator): coordinator is CampaignUser =>
        isPopulatedRelationship<CampaignUser>(coordinator),
      )
      .map(({ id, name }) => ({ id, name })) ?? [],
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  organizationKind: nucleus.organizationKind,
  organizationLabel: nucleus.organizationLabel ?? null,
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
  confirmedVoteEstimate: nucleus.confirmedVoteEstimate ?? null,
  proposedVoteEstimate: nucleus.proposedVoteEstimate ?? null,
  lastUpdateAt: nucleus.lastUpdateAt ?? null,
})

export const toNucleusFormViewModel = (nucleus: ElectoralNucleus): NucleusFormViewModel => ({
  id: nucleus.id,
  name: nucleus.name,
  slug: nucleus.slug,
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  territoryNotes: nucleus.territoryNotes ?? null,
  organizationKind: nucleus.organizationKind,
  organizationLabel: nucleus.organizationLabel ?? null,
  sectorKind: nucleus.sectorKind ?? null,
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
  ticketAlliance: nucleus.ticketAlliance
    ? {
        partnerName: nucleus.ticketAlliance.partnerName ?? null,
        office: nucleus.ticketAlliance.office ?? null,
        isCampaignPartner: Boolean(nucleus.ticketAlliance.isCampaignPartner),
        notes: nucleus.ticketAlliance.notes ?? null,
      }
    : null,
})

const toNucleusDetailBaseViewModel = (nucleus: ElectoralNucleus): NucleusDetailBaseViewModel => ({
  id: nucleus.id,
  name: nucleus.name,
  slug: nucleus.slug,
  status: nucleus.status,
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  organizationKind: nucleus.organizationKind,
  organizationLabel: nucleus.organizationLabel ?? null,
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
  confirmedVoteEstimate: nucleus.confirmedVoteEstimate ?? null,
})

const toStaffNucleusDetailViewModel = (nucleus: ElectoralNucleus): StaffNucleusDetailViewModel => ({
  kind: 'staff',
  ...toNucleusDetailBaseViewModel(nucleus),
  confirmedVoteEstimateAt: nucleus.confirmedVoteEstimateAt ?? null,
  confirmedVoteEstimateBy: relationshipName(nucleus.confirmedVoteEstimateBy),
  proposedVoteEstimate: nucleus.proposedVoteEstimate ?? null,
  proposedVoteEstimateAt: nucleus.proposedVoteEstimateAt ?? null,
  proposedVoteEstimateBy: relationshipName(nucleus.proposedVoteEstimateBy),
  proposedVoteEstimateVersion: nucleus.proposedVoteEstimateVersion ?? null,
  primaryContactId: relationshipId(nucleus.primaryContact),
  tabs: toStaffNucleusTabsViewModel(nucleus),
})

const toLeadershipNucleusDetailViewModel = (
  nucleus: ElectoralNucleus,
): LeadershipNucleusDetailViewModel => ({
  kind: 'leadership',
  ...toNucleusDetailBaseViewModel(nucleus),
  tabs: toLeadershipNucleusTabsViewModel(nucleus),
})

type ToNucleusDetailViewModel = {
  (nucleus: ElectoralNucleus, role: 'lideranca'): LeadershipNucleusDetailViewModel
  (nucleus: ElectoralNucleus, role: 'geral' | 'coordenador'): StaffNucleusDetailViewModel
  (nucleus: ElectoralNucleus, role: CampaignUser['role']): NucleusDetailViewModel
}

export const toNucleusDetailViewModel = ((
  nucleus: ElectoralNucleus,
  role: CampaignUser['role'],
): NucleusDetailViewModel =>
  role === 'lideranca'
    ? toLeadershipNucleusDetailViewModel(nucleus)
    : toStaffNucleusDetailViewModel(nucleus)) as ToNucleusDetailViewModel

export const toStaffNucleusTabsViewModel = (
  nucleus: ElectoralNucleus,
): StaffNucleusTabsViewModel => ({
  kind: 'staff',
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  territoryNotes: nucleus.territoryNotes ?? null,
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
  voterProfiles:
    nucleus.voterProfiles?.map(
      ({ label, ageRange, incomeBand, occupation, localTraits, notes }) => ({
        label,
        ageRange: ageRange ?? null,
        incomeBand: incomeBand ?? null,
        occupation: occupation ?? null,
        localTraits: localTraits ?? null,
        notes: notes ?? null,
      }),
    ) ?? [],
  strengths: nucleus.strengths?.map(({ text }) => ({ text })) ?? [],
  risks: nucleus.risks?.map(({ text }) => ({ text })) ?? [],
  ticketAlliance: nucleus.ticketAlliance
    ? {
        partnerName: nucleus.ticketAlliance.partnerName ?? null,
        office: nucleus.ticketAlliance.office ?? null,
        isCampaignPartner: Boolean(nucleus.ticketAlliance.isCampaignPartner),
        notes: nucleus.ticketAlliance.notes ?? null,
      }
    : null,
})

export const toLeadershipNucleusTabsViewModel = (
  nucleus: ElectoralNucleus,
): LeadershipNucleusTabsViewModel => ({
  kind: 'leadership',
  regions: asStringArray(nucleus.regions),
  cities: asStringArray(nucleus.cities),
  neighborhoods: asStringArray(nucleus.neighborhoods),
  locality: nucleus.locality ?? null,
  tseZones: nucleus.tseZones?.map(({ zoneNumber }) => zoneNumber) ?? [],
})
