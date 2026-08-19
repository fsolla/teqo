'use server'

import { revalidatePath } from 'next/cache'

import { reorderWithPrimaryPhone } from '@/lib/phone'
import {
  CONTACT_CELL_NOT_IN_SCOPE_MESSAGE,
  CONTACT_CELL_STAFF_MESSAGE,
  CONTACT_CREATE_STAFF_MESSAGE,
  contactCreateSchema,
  contactFieldUpdateSchema,
  contactFullUpdateSchema,
  type ContactCreateInput,
  type ContactFieldUpdateInput,
  type ContactFullUpdateInput,
} from '@/lib/schemas/contact'
import type { CampaignUser, Contact } from '@/payload-types'
import { getCampaignActionContext, reloadStaffActor } from '@/utilities/campaignActionContext'
import { assertContactNameAvailable } from '@/utilities/contacts/contactNameInvariant'
import {
  withPayloadTransaction,
  type PayloadTransactionRequest,
} from '@/utilities/payloadTransaction'
import { assertPersonContactWritable } from '@/utilities/person/personContactWriteScope'
import type { Payload } from 'payload'

/**
 * C139 — the contacts page writes the ficha itself, so the write gate is the
 * row's own read visibility: "you edit what you see". The `contact` collection
 * access keeps `create`/`update` admin-only (`canManageContacts`), so every
 * campaign write bypasses with `overrideAccess: true` AFTER the staff gate and
 * (for an advisor) a user-threaded scope re-check — the bypass is justified by
 * the gate, never standalone.
 */

/**
 * C141 — the contacts-page cell write gate: the ficha must sit in the actor's
 * WRITE scope (see `assertPersonContactWritable`). Before C141 this asserted
 * "you edit what you see" via the READ access, which Visão "Tudo" would have
 * widened into a statewide PII write for a carteira-editing advisor.
 */
const assertContactRowEditable = async (
  payload: Payload,
  actor: CampaignUser,
  contactID: number,
  req: PayloadTransactionRequest,
): Promise<void> => {
  await assertPersonContactWritable({
    payload,
    actor,
    contactID,
    req,
    errorMessage: CONTACT_CELL_NOT_IN_SCOPE_MESSAGE,
  })
}

const createContactRecord = async (
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
): Partial<Pick<Contact, 'name' | 'email' | 'city' | 'postalCode' | 'gender' | 'state'>> & {
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
    case 'gender':
      return { gender: data.gender }
    case 'state':
      return { state: data.state }
    case 'phones':
      return { phones: data.phones.map((value) => ({ value })) }
    case 'phone':
      return {
        phones: data.phone === null || data.phone === undefined ? [] : [{ value: data.phone }],
      }
  }
}

const updateContactFieldRecord = async (
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

/**
 * C139 — the mobile sheet's single atomic ficha write (plan decision F): one
 * transaction, same gate ("edita o que vê") and same name invariant as the
 * per-field ladder; every column is written from the form (empties clear).
 */
const updateContactFullRecord = async (
  payload: Payload,
  actor: CampaignUser,
  input: ContactFullUpdateInput,
): Promise<void> => {
  const data = contactFullUpdateSchema.parse(input)

  return withPayloadTransaction(payload, async ({ req }) => {
    const currentActor = await reloadStaffActor(payload, actor, CONTACT_CELL_STAFF_MESSAGE, req)

    await assertContactRowEditable(payload, currentActor, data.id, req)
    await assertContactNameAvailable(payload, req, data.name, data.id)

    // Intentional bypass: same gate as the per-field write above.
    await payload.update({
      collection: 'contact',
      id: data.id,
      data: {
        name: data.name,
        email: data.email ?? null,
        phones: (data.phones ?? []).map((value) => ({ value })),
        gender: data.gender ?? null,
        state: data.state,
        city: data.city ?? null,
        postalCode: data.postalCode ?? null,
      },
      depth: 0,
      overrideAccess: true,
      req,
    })
  })
}

export const updateContactFull = async (input: unknown) => {
  const { payload, actor } = await getCampaignActionContext()
  await updateContactFullRecord(payload, actor, input as ContactFullUpdateInput)
  revalidatePath('/campanha/contatos', 'page')
}
