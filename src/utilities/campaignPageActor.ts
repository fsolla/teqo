import 'server-only'

import { redirect } from 'next/navigation'

import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import { getCampaignUser } from '@/utilities/campaignAuth'

/** Exactly the non-null actor `getCampaignUser` proves (keeps its `email` refinement). */
export type CampaignPageActor = NonNullable<Awaited<ReturnType<typeof getCampaignUser>>>

export type CampaignPageGate = 'staff' | 'unrestricted' | 'noLeader'

/**
 * THE staff page prologue (Pass 3 P3-I — was ~110 hand-spelled lines across 30
 * pages, with a real divergence: 5 pages answered a missing session with
 * `return null` — a blank screen — instead of redirecting to login). Gates:
 *
 * - (none)         → any authenticated campaign user;
 * - 'staff'        → non-staff (leader) goes to `/campanha`;
 * - 'unrestricted' → non-coordinator/candidate goes to `/campanha`;
 * - 'noLeader'     → leader goes to `/campanha` (their home is the contact tool).
 *
 * A custom `redirectTo` overrides the gate's default target. The convention
 * guard in `codebaseConventions.unit.spec.ts` fails the build on a
 * `getCampaignUser()` call in a `(app)` route page outside this helper.
 */
export const requireCampaignPageActor = async (
  options: { gate?: CampaignPageGate; redirectTo?: string } = {},
): Promise<CampaignPageActor> => {
  const user = await getCampaignUser()
  if (!user) redirect('/campanha/login')

  const { gate, redirectTo = '/campanha' } = options
  if (gate === 'staff' && !isStaffCampaignRole(user.role)) redirect(redirectTo)
  if (gate === 'unrestricted' && !isUnrestrictedCampaignRole(user.role)) redirect(redirectTo)
  if (gate === 'noLeader' && user.role === 'leader') redirect(redirectTo)

  return user
}
