import 'server-only'

import { stubCampaignUserEmailFor } from '@/lib/schemas/advisor'
import { MUNICIPALITY_ADVISOR_STUB_EMAIL_MESSAGE } from '@/lib/schemas/municipality'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'
import type { Payload } from 'payload'

/**
 * C128 — the next free `<slug>@criado.invalid` stub for an account created
 * without usable credentials (the "login is provisioned later" contract). Was
 * private to `actions/municipality.ts` (B154); the person lifecycle
 * (`setPersonAssessoraMembershipRecord`) creates staff accounts too, and the
 * unique-email probe must never diverge between the two surfaces.
 *
 * Bounded exact-match probes on the unique `email` index (no LIKE semantics).
 * Collisions only happen when two names slugify identically, so the first
 * probe usually succeeds. The read bypasses access control on purpose: the
 * caller's gate (unrestricted role) already ran in its transaction, and the
 * probe only looks at placeholder e-mails.
 */
export const nextFreeStubCampaignEmail = async (
  payload: Pick<Payload, 'find'>,
  req: PayloadTransactionRequest,
  name: string,
): Promise<string> => {
  for (let occurrence = 1; occurrence <= 50; occurrence += 1) {
    const candidate = stubCampaignUserEmailFor(name, occurrence)
    const existing = await payload.find({
      collection: 'campaignUser',
      where: { email: { equals: candidate } },
      depth: 0,
      limit: 1,
      select: { email: true },
      overrideAccess: true,
      req,
    })
    if (existing.totalDocs === 0) return candidate
  }
  throw new Error(MUNICIPALITY_ADVISOR_STUB_EMAIL_MESSAGE)
}
