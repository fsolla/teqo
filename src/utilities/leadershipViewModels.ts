import type { CampaignUser, Contact, Leadership } from '@/payload-types'
import type { SupportStatus } from '@/components/campaign/SupportStatusBadge'
import { isPopulatedRelationship, relationshipId } from '@/utilities/relationship'

export const leadershipLeaderSelect = {
  contact: true,
  sector: true,
  consent: true,
  consentContentHash: true,
} as const

export const leadershipStaffListSelect = {
  contact: true,
  sector: true,
  supportStatus: true,
} as const

export const leadershipStaffSelect = {
  ...leadershipLeaderSelect,
  supportStatus: true,
  notes: true,
  consentNote: true,
  user: true,
} as const

export type LeadershipContactViewModel = {
  contactId: number
  name: string
  phone: string
  email: string | null
  gender: Contact['gender'] | null
  sector: Leadership['sector'] | null
  sectorNotes: string | null
  confirmedByPerson: boolean
}

export type LeadershipStaffViewModel = LeadershipContactViewModel & {
  id: number
  supportStatus: SupportStatus
  notes: string | null
  consentNote: string | null
  hasAppAccess: boolean
}

export type LeadershipStaffListItemViewModel = Pick<
  LeadershipStaffViewModel,
  'id' | 'contactId' | 'name' | 'phone' | 'sector' | 'supportStatus'
>

export type LeadershipEditViewModel = Pick<
  LeadershipStaffViewModel,
  'id' | 'sector' | 'sectorNotes' | 'supportStatus' | 'notes' | 'consentNote'
>

export const toLeadershipEditViewModel = (
  leadership: LeadershipStaffViewModel,
): LeadershipEditViewModel => ({
  id: leadership.id,
  sector: leadership.sector,
  sectorNotes: leadership.sectorNotes,
  supportStatus: leadership.supportStatus,
  notes: leadership.notes,
  consentNote: leadership.consentNote,
})

export type LeadershipSelfViewModel = {
  name: string
  phone: string
  email: string | null
  sector: Leadership['sector'] | null
  confirmedByPerson: boolean
}

export type StaffLeadershipPageData = {
  kind: 'staff'
  leaderships: LeadershipStaffListItemViewModel[]
  page: number
  totalDocs: number
  totalPages: number
}

export type SelfLeadershipPageData = {
  kind: 'self'
  leaderships: LeadershipSelfViewModel[]
  page: 1
  totalDocs: number
  totalPages: number
}

const populatedContact = (relationship: Leadership['contact']): Contact | null =>
  isPopulatedRelationship<Contact>(relationship) ? relationship : null

const hasRelationship = (relationship: number | object | null | undefined): boolean =>
  relationship !== null && relationship !== undefined

type CurrentConsent = { id: number; contentHash: string }

const hasCurrentConsent = (leadership: Leadership, currentConsent?: CurrentConsent): boolean =>
  Boolean(
    currentConsent &&
    relationshipId(leadership.consent) === currentConsent.id &&
    leadership.consentContentHash === currentConsent.contentHash,
  )

const toContactViewModel = (
  leadership: Leadership,
  currentConsent?: CurrentConsent,
): LeadershipContactViewModel | null => {
  const contact = populatedContact(leadership.contact)
  if (!contact) return null

  return {
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    email: contact.email ?? null,
    gender: contact.gender ?? null,
    sector: leadership.sector ?? null,
    sectorNotes: leadership.sectorNotes ?? null,
    confirmedByPerson: hasCurrentConsent(leadership, currentConsent),
  }
}

const toStaffViewModel = (
  leadership: Leadership,
  currentConsent?: CurrentConsent,
): LeadershipStaffViewModel | null => {
  const contact = toContactViewModel(leadership, currentConsent)
  if (!contact || !leadership.supportStatus) return null

  return {
    id: leadership.id,
    ...contact,
    supportStatus: leadership.supportStatus,
    notes: leadership.notes ?? null,
    consentNote: leadership.consentNote ?? null,
    hasAppAccess: hasRelationship(leadership.user),
  }
}

const toStaffListViewModel = (leadership: Leadership): LeadershipStaffListItemViewModel | null => {
  const contact = populatedContact(leadership.contact)
  if (!contact || !leadership.supportStatus) return null

  return {
    id: leadership.id,
    contactId: contact.id,
    name: contact.name,
    phone: contact.phone,
    sector: leadership.sector ?? null,
    supportStatus: leadership.supportStatus,
  }
}

export const toSelectedLeadershipViewModel = (
  leadership: Leadership,
  currentConsent?: CurrentConsent,
): LeadershipStaffViewModel | null => toStaffViewModel(leadership, currentConsent)

const toSelfViewModel = (
  leadership: Leadership,
  currentConsent?: CurrentConsent,
): LeadershipSelfViewModel | null => {
  const contact = populatedContact(leadership.contact)
  if (!contact) return null

  return {
    name: contact.name,
    phone: contact.phone,
    email: contact.email ?? null,
    sector: leadership.sector ?? null,
    confirmedByPerson: hasCurrentConsent(leadership, currentConsent),
  }
}

type ToLeadershipPageData = {
  (
    leaderships: Leadership[],
    role: 'lideranca',
    pagination?: { page: number; totalDocs: number; totalPages: number },
    currentConsent?: CurrentConsent,
  ): SelfLeadershipPageData
  (
    leaderships: Leadership[],
    role: Exclude<CampaignUser['role'], 'lideranca'>,
    pagination?: { page: number; totalDocs: number; totalPages: number },
    currentConsent?: CurrentConsent,
  ): StaffLeadershipPageData
  (
    leaderships: Leadership[],
    role: CampaignUser['role'],
    pagination?: { page: number; totalDocs: number; totalPages: number },
    currentConsent?: CurrentConsent,
  ): StaffLeadershipPageData | SelfLeadershipPageData
}

export const toLeadershipPageData = ((
  leaderships: Leadership[],
  role: CampaignUser['role'],
  pagination = {
    page: 1,
    totalDocs: leaderships.length,
    totalPages: leaderships.length > 0 ? 1 : 0,
  },
  currentConsent?: CurrentConsent,
): StaffLeadershipPageData | SelfLeadershipPageData => {
  if (role === 'lideranca') {
    return {
      kind: 'self',
      leaderships: leaderships.flatMap((leadership) => {
        const view = toSelfViewModel(leadership, currentConsent)
        return view ? [view] : []
      }),
      page: 1,
      totalDocs: pagination.totalDocs,
      totalPages: pagination.totalPages,
    }
  }

  return {
    kind: 'staff',
    leaderships: leaderships.flatMap((leadership) => {
      const view = toStaffListViewModel(leadership)
      return view ? [view] : []
    }),
    ...pagination,
  }
}) as ToLeadershipPageData
