'use server'

import { revalidatePath } from 'next/cache'

import { reorderWithPrimaryPhone } from '@/lib/phone'
import {
  CONTACT_CELL_NOT_IN_SCOPE_MESSAGE,
  CONTACT_CELL_STAFF_MESSAGE,
  CONTACT_CREATE_STAFF_MESSAGE,
  contactCreateSchema,
  contactFieldUpdateSchema,
  type ContactCreateInput,
  type ContactFieldUpdateInput,
} from '@/lib/schemas/contact'
import type { CampaignUser, Contact } from '@/payload-types'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { assertContactNameAvailable } from '@/utilities/contacts/contactNameInvariant'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import type { Payload } from 'payload'

/**
 * C139 — the contacts page writes the ficha itself, so the write gate is the
 * row's own read visibility: "you edit what you see". The `contact` collection
 * access keeps `create`/`update` admin-only (`canManageContacts`), so every
 * campaign write bypasses with `overrideAccess: true` AFTER the staff gate and
 * (for an advisor) a user-threaded scope re-check — the bypass is justified by
 * the gate, never standalone.
 */

const assertContactRowEditable = async (
  payload: Payload,
  actor: CampaignUser,
  contactID: number,
  req: PayloadTransactionRequest,
): Promise<void> => {
  if (isCampaignUnrestricted(actor)) return

  const visible = await payload.find({
    collection: 'contact',
    where: { id: { equals: contactID } },
    depth: 0,
    limit: 1,
    pagination: false,
    user: actor,
    overrideAccess: false,
    req,
  })
  if (visible.docs.length === 0) throw new Error(CONTACT_CELL_NOT_IN_SCOPE_MESSAGE)
}

export const createContactRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ContactCreateInput,
): Promise<{ contactID: number }> => {
  const data = contactCreateSchema.parse(input)

  return withPayloadTransaction(payload, async ({ req }) => {
    await reloadStaffActor(payload, actor, CONTACT_CREATE_STAFF_MESSAGE, req)

    await assertContactNameAvailable(payload, req, data.name)

    const created = await payload.create({
      collection: 'contact',
      data: {
        name: data.name,
        ...(data.email ? { email: data.email } : {}),
        ...(data.phones && data.phones.length > 0
          ? { phones: data.phones.map((value) => ({ value })) }
          : {}),
        ...(data.gender ? { gender: data.gender } : {}),
        state: data.state,
        ...(data.city ? { city: data.city } : {}),
        ...(data.postalCode ? { postalCode: data.postalCode } : {}),
      },
      depth: 0,
      // Intentional bypass: the staff gate above is the authorization; the
      // collection's `create` access is admin-only by design (C139).
      overrideAccess: true,
      req,
    })
    return { contactID: created.id }
  })
}

export const createContact = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  const { contactID } = await createContactRecord(payload, actor, input as ContactCreateInput)
  revalidatePath('/campanha/contatos', 'page')
  return { contactID }
}

const contactFieldData = (
  data: ContactFieldUpdateInput,
): Partial<Pick<Contact, 'name' | 'email' | 'city' | 'postalCode'>> & {
  phones?: { value: string }[]
} => {
  switch (data.field) {
    case 'name':
      return { name: data.name }
    case 'email':
      return { email: data.email ?? null }
    case 'city':
      return { city: data.city }
    case 'postalCode':
      // The schema transforms '' → undefined: clearing the CEP stores null.
      return { postalCode: data.postalCode ?? null }
    case 'phones':
      return { phones: data.phones.map((value) => ({ value })) }
    case 'phone':
      return {
        phones: data.phone === null || data.phone === undefined ? [] : [{ value: data.phone }],
      }
  }
}

export const updateContactFieldRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ContactFieldUpdateInput,
): Promise<void> => {
  const data = contactFieldUpdateSchema.parse(input)

  return withPayloadTransaction(payload, async ({ req }) => {
    const currentActor = await reloadStaffActor(payload, actor, CONTACT_CELL_STAFF_MESSAGE, req)

    await assertContactRowEditable(payload, currentActor, data.id, req)

    let contactData = contactFieldData(data)
    if (data.field === 'name') {
      await assertContactNameAvailable(payload, req, data.name, data.id)
    } else if (data.field === 'phone') {
      // Inline primary-phone edit (C112 shape): the new number goes first and
      // the rest shifts up; clearing drops the primary phone.
      const current = await payload.findByID({
        collection: 'contact',
        id: data.id,
        depth: 0,
        select: { phones: true },
        // Intentional bypass: the scope check above established the actor's
        // right over this row; the read only resolves the list to reorder.
        overrideAccess: true,
        req,
      })
      contactData = {
        phones: reorderWithPrimaryPhone(current.phones, data.phone).map((value) => ({ value })),
      }
    }

    // Intentional bypass: same gate as the reads above.
    await payload.update({
      collection: 'contact',
      id: data.id,
      data: contactData,
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}

export const updateContactField = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  await updateContactFieldRecord(payload, actor, input as ContactFieldUpdateInput)
  revalidatePath('/campanha/contatos', 'page')
}
