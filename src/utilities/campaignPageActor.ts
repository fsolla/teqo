import 'server-only'

import { redirect } from 'next/navigation'

import { LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import { isStaffCampaignRole, isUnrestrictedCampaignRole } from '@/lib/campaignRoles'
import { advisorEditingAccess } from '@/utilities/access/shared'
import { getCampaignUser } from '@/utilities/campaignAuth'

/** Exactly the non-null actor `getCampaignUser` proves (keeps its `email` refinement). */
export type CampaignPageActor = NonNullable<Awaited<ReturnType<typeof getCampaignUser>>>

export type CampaignPageGate = 'staff' | 'unrestricted' | 'noLeader' | 'writable'

export { LEADER_CONTACTS_HOME }

/** Staff dashboard (B43 — moved off blank `/campanha`). */
export const CAMPAIGN_STAFF_QUADRO_PATH = '/campanha/quadro'

/**
 * THE staff page prologue (Pass 3 P3-I — was ~110 hand-spelled lines across 30
 * pages, with a real divergence: 5 pages answered a missing session with
 * `return null` — a blank screen — instead of redirecting to login). Gates:
 *
 * - (none)         → any authenticated campaign user;
 * - 'staff'        → non-staff (leader) goes to `/campanha/meus-contatos` (B43, C139);
 * - 'unrestricted' → non-coordinator/candidate goes to `/campanha`;
 * - 'noLeader'     → leader goes to `/campanha/meus-contatos` (B43, C139);
 * - 'writable'     → advisor with Edição `somente_leitura` goes to `/campanha`
 *                    (C142 — write destinations must not be offered to a
 *                    read-only advisor; the server already rejects the write).
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

  const { gate, redirectTo } = options
  const denyRedirect = redirectTo ?? (user.role === 'leader' ? LEADER_CONTACTS_HOME : '/campanha')

  if (gate === 'staff' && !isStaffCampaignRole(user.role)) redirect(denyRedirect)
  if (gate === 'unrestricted' && !isUnrestrictedCampaignRole(user.role)) redirect(denyRedirect)
  if (gate === 'noLeader' && user.role === 'leader') redirect(denyRedirect)
  if (gate === 'writable' && !isStaffCampaignRole(user.role)) redirect(denyRedirect)
  // C142 — `somente_leitura` applies to advisors only; `advisorEditingAccess`
  // returns 'none' for every non-advisor role, so gate on the role first or
  // coordinators/candidates are wrongly redirected away from write pages.
  if (gate === 'writable' && user.role === 'advisor' && advisorEditingAccess(user) === 'none') {
    redirect(denyRedirect)
  }

  return user
}
