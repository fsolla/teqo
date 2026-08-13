'use server'

import {
  createContact,
  updateContactField,
  updateContactFull,
} from '@/app/(campaign)/campanha/actions/contact'
import {
  nullableFormText,
  repeatedPhoneFormValues,
  requiredFormText,
  requiredRelationshipFormValue,
} from '@/lib/formData'
import { BRAZILIAN_PHONE_DUPLICATE_MESSAGE } from '@/lib/phone'
import {
  CONTACT_CELL_NOT_IN_SCOPE_MESSAGE,
  CONTACT_CELL_STAFF_MESSAGE,
  CONTACT_CREATED_MESSAGE,
  CONTACT_NAME_CONFLICT_MESSAGE,
} from '@/lib/schemas/contact'
import {
  runCampaignFormAction,
  type CampaignFormActionState,
} from '@/utilities/campaignFormActionError'

const contactCellSafeMessages = [
  CONTACT_CELL_STAFF_MESSAGE,
  CONTACT_CELL_NOT_IN_SCOPE_MESSAGE,
  CONTACT_NAME_CONFLICT_MESSAGE,
  BRAZILIAN_PHONE_DUPLICATE_MESSAGE,
] as const

/** Per-field ficha edit for the contacts page cells (C139, C116 shape). */
export const updateContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      const id = requiredRelationshipFormValue(formData, 'id')
      const field = requiredFormText(formData, 'field')

      if (field === 'name') {
        await updateContactField({ id, field: 'name', name: requiredFormText(formData, 'name') })
      } else if (field === 'email') {
        await updateContactField({
          id,
          field: 'email',
          email: nullableFormText(formData, 'email') ?? undefined,
        })
      } else if (field === 'phone') {
        await updateContactField({
          id,
          field: 'phone',
          phone: nullableFormText(formData, 'phone') ?? null,
        })
      } else if (field === 'phones') {
        await updateContactField({
          id,
          field: 'phones',
          phones: repeatedPhoneFormValues(formData, 'phones'),
        })
      } else if (field === 'gender') {
        await updateContactField({
          id,
          field: 'gender',
          gender: requiredFormText(formData, 'gender'),
        })
      } else if (field === 'state') {
        await updateContactField({ id, field: 'state', state: requiredFormText(formData, 'state') })
      } else if (field === 'city') {
        await updateContactField({ id, field: 'city', city: requiredFormText(formData, 'city') })
      } else if (field === 'postalCode') {
        await updateContactField({
          id,
          field: 'postalCode',
          postalCode: nullableFormText(formData, 'postalCode') ?? undefined,
        })
      } else {
        throw new Error(CONTACT_CELL_NOT_IN_SCOPE_MESSAGE)
      }

      return { message: 'Salvo.' }
    },
    safeMessages: contactCellSafeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })

/** The contacts page create ladder (desktop row / mobile sheet — C139). */
export const createContactFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      // The desktop row sends one `phone`; the mobile sheet sends the
      // repeatable `phones` list (PhonesFieldEditor) — the row wins when both
      // are present, but the two forms never send both.
      const singlePhone = nullableFormText(formData, 'phone')
      const phonesList = repeatedPhoneFormValues(formData, 'phones')
      const phones = phonesList.length > 0 ? phonesList : singlePhone ? [singlePhone] : []
      const result = await createContact({
        name: requiredFormText(formData, 'name'),
        email: nullableFormText(formData, 'email') ?? undefined,
        phones,
        gender: nullableFormText(formData, 'gender') ?? undefined,
        state: requiredFormText(formData, 'state'),
        city: nullableFormText(formData, 'city') ?? undefined,
        postalCode: nullableFormText(formData, 'postalCode') ?? undefined,
      })
      return { message: CONTACT_CREATED_MESSAGE, contactID: result.contactID }
    },
    safeMessages: [CONTACT_NAME_CONFLICT_MESSAGE],
    genericMessage: 'Não foi possível criar o contato. Verifique os dados e tente novamente.',
  })

/** The mobile edit sheet's single atomic ficha write (plan decision F). */
export const updateContactFullFormAction = async (
  _state: CampaignFormActionState,
  formData: FormData,
): Promise<CampaignFormActionState> =>
  runCampaignFormAction({
    execute: async () => {
      await updateContactFull({
        id: requiredRelationshipFormValue(formData, 'id'),
        name: requiredFormText(formData, 'name'),
        email: nullableFormText(formData, 'email') ?? undefined,
        phones: repeatedPhoneFormValues(formData, 'phones'),
        gender: nullableFormText(formData, 'gender') ?? undefined,
        state: requiredFormText(formData, 'state'),
        city: nullableFormText(formData, 'city') ?? undefined,
        postalCode: nullableFormText(formData, 'postalCode') ?? undefined,
      })
      return { message: 'Salvo.' }
    },
    safeMessages: contactCellSafeMessages,
    genericMessage: 'Não foi possível salvar. Verifique os dados e tente novamente.',
  })
