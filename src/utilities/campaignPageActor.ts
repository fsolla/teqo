import 'server-only'

import { redirect } from 'next/navigation'

import { CAMPAIGN_COMMUNICATION_HOME, LEADER_CONTACTS_HOME } from '@/lib/campaignPaths'
import {
  canReadCommunicationCatalog,
  isStaffCampaignRole,
  isUnrestrictedCampaignRole,
} from '@/lib/campaignRoles'
import { advisorEditingAccess } from '@/utilities/access/shared'
import { getCampaignUser, getCampaignUserWithAvatar } from '@/utilities/campaignAuth'

/** Exactly the non-null actor `getCampaignUser` proves (keeps its `email` refinement). */
export type CampaignPageActor = NonNullable<Awaited<ReturnType<typeof getCampaignUser>>>

export type CampaignPageGate =
  | 'staff'
  | 'unrestricted'
  | 'noLeader'
  | 'writable'
  | 'communicationCatalog'

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
 *                    read-only advisor; the server already rejects the write);
 * - 'communicationCatalog' → advisor/leader lose the communication vertical
 *                    (C154; C194 generalized the name from `speechCatalog`);
 *                    communicator/coordinator/candidate pass, the same
 *                    predicate the collection access uses.
 *
 * A custom `redirectTo` overrides the gate's default target. `withAvatar`
 * loads the actor through `getCampaignUserWithAvatar` (avatar populated at
 * depth 1) instead of `getCampaignUser` — both return
 * `AuthenticatedCampaignUser | null`; the avatar depth is runtime-only and
 * does not change the gates. The convention guard in
 * `codebaseConventions.unit.spec.ts` fails the build on a `getCampaignUser*()`
 * call in a `(app)` route page outside this helper.
 */
export const requireCampaignPageActor = async (
  /**
   * `withAvatar` loads the actor through `getCampaignUserWithAvatar` (avatar
   * populated at depth 1) instead of `getCampaignUser` — both return
   * `AuthenticatedCampaignUser | null`; the avatar depth is runtime-only and
   * does not change the gates. The perfil shell renders `avatarUrl`, which
   * requires the populated media object — depth 0 resolves to a number id.
   */
  options: { gate?: CampaignPageGate; redirectTo?: string; withAvatar?: boolean } = {},
): Promise<CampaignPageActor> => {
  const getter = options.withAvatar ? getCampaignUserWithAvatar : getCampaignUser
  const user = await getter()
  if (!user) redirect('/campanha/login')

  const { gate, redirectTo } = options
  // C154 — a denied communicator belongs in the vertical, not in the staff
  // home (which itself redirects there, but a direct redirect avoids a hop).
  const roleHome: Partial<Record<typeof user.role, string>> = {
    leader: LEADER_CONTACTS_HOME,
    communicator: CAMPAIGN_COMMUNICATION_HOME,
  }
  const denyRedirect = redirectTo ?? roleHome[user.role] ?? '/campanha'

  if (gate === 'staff' && !isStaffCampaignRole(user.role)) redirect(denyRedirect)
  // C154/C194 — the communication vertical (acervo, cortes and reels):
  // communicator/coordinator/candidate, the same predicate the collection
  // access uses.
  if (gate === 'communicationCatalog' && !canReadCommunicationCatalog(user.role)) {
    redirect(denyRedirect)
  }
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
