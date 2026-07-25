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
