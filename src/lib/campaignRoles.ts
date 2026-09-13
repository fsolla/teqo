import type { CampaignUser } from '@/payload-types'

/**
 * Client-safe campaign ROLE predicates — the single source for what each role
 * label means. Server-side actor checks (`isCampaignStaff(user)` etc.) derive
 * from these in `src/utilities/access/shared.ts`; client components (sidebar,
 * nav) use the role-level predicates directly instead of importing the access
 * barrel.
 */
export type CampaignRole = CampaignUser['role']

/** Staff = coordinator, advisor, or candidate. Leaders are not staff. */
export const isStaffCampaignRole = (role: CampaignRole): boolean =>
  role === 'coordinator' || role === 'advisor' || role === 'candidate'

/** Coordinator or candidate — unrestricted scope (all municipalities, decisions). */
export const isUnrestrictedCampaignRole = (role: CampaignRole): boolean =>
  role === 'coordinator' || role === 'candidate'

/**
 * Speech catalog readers (C153): the communication assessor plus the
 * unrestricted roles. Deliberately NOT part of `isStaffCampaignRole` — the
 * communicator does not inherit any staff area, only the catalog vertical.
 */
export const canReadSpeechCatalog = (role: CampaignRole): boolean =>
  role === 'communicator' || isUnrestrictedCampaignRole(role)

/**
 * Sollinha (AI assistant) surfaces. The communication assessor does not use
 * the campaign assistant — its tools are campaign-scoped and the vertical is
 * her whole job (C153 debt, resolved by C154). Leaders keep the safe
 * link/meta chips.
 */
export const canUseCampaignAssistant = (role: CampaignRole): boolean => role !== 'communicator'
