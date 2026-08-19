import 'server-only'

import type { Payload } from 'payload'

import type { CampaignUser } from '@/payload-types'
import {
  advisorEditingAccess,
  getWritableMunicipalityIds,
  isCampaignUnrestricted,
} from '@/utilities/campaignAccess'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

/**
 * C141 — the ficha (Contact) write gate shared by the people-cell actions
 * (C116 `person.ts`) and the contacts-page cells (C139 `contact.ts`). Before
 * C141 these asserted "you edit what you see" by probing the entities of the
 * person with the actor's READ access — Visão "Tudo" would have widened the
 * probe and let a carteira-editing advisor rewrite PII fichas statewide.
 *
 * The rule now mirrors the Edição axis: a `somente_leitura` advisor writes no
 * ficha; every probe leg runs against the WRITE scope — leaderships and
 * supporters must sit in writable municipalities, dobradinhas keep their
 * staff-wide status quo. Throws `errorMessage` when no leg matches.
 */
export const assertPersonContactWritable = async ({
  payload,
  actor,
  contactID,
  req,
  errorMessage,
}: {
  payload: Payload
  actor: CampaignUser
  contactID: number
  req: PayloadTransactionRequest
  errorMessage: string
}): Promise<void> => {
  if (isCampaignUnrestricted(actor)) return
  if (advisorEditingAccess(actor) === 'none') throw new Error(errorMessage)

  const writable = await getWritableMunicipalityIds(payload, actor, req)
  const writableFilter = writable === null ? undefined : { in: writable }

  const contactWhere = { contact: { equals: contactID } }
  const [leaderships, deputies, supporters] = await Promise.all([
    payload.find({
      collection: 'leadership',
      where: {
        and: [contactWhere, ...(writableFilter ? [{ municipalities: writableFilter }] : [])],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      user: actor,
      overrideAccess: false,
      req,
    }),
    payload.find({
      collection: 'stateDeputy',
      where: contactWhere,
      depth: 0,
      limit: 1,
      pagination: false,
      user: actor,
      overrideAccess: false,
      req,
    }),
    payload.find({
      collection: 'supporter',
      where: {
        and: [contactWhere, ...(writableFilter ? [{ municipality: writableFilter }] : [])],
      },
      depth: 0,
      limit: 1,
      pagination: false,
      user: actor,
      overrideAccess: false,
      req,
    }),
  ])

  if (leaderships.docs.length === 0 && deputies.docs.length === 0 && supporters.docs.length === 0) {
    throw new Error(errorMessage)
  }
}
