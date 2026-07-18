import { CitiesByState } from '@/lib/cities'
import {
  acquireContactPhoneLocks,
  assertContactPhoneAvailable,
} from '@/utilities/contactPhoneInvariant'
import {
  canManageContacts,
  canReadContacts,
} from '@/utilities/campaignAccess'
import { normalizeBrazilianPhone } from '@/utilities/phone'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

const enforceUniqueContactPhone: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const phone = String(data.phone ?? originalDoc?.phone ?? '')
  const oldPhone =
    operation === 'update' && typeof originalDoc?.phone === 'string'
      ? originalDoc.phone
      : undefined

  await acquireContactPhoneLocks(
    req.payload,
    req,
    oldPhone === undefined ? [phone] : [oldPhone, phone],
  )
  await assertContactPhoneAvailable(
    req.payload,
    req,
    phone,
    operation === 'update' ? Number(originalDoc?.id) : undefined,
  )
  return data
}

export const Contact: CollectionConfig = {
  slug: 'contact',
  labels: {
    singular: 'Contato',
    plural: 'Contatos',
  },
  admin: {
    group: 'Contatos',
    useAsTitle: 'name',
  },
  access: {
    create: canManageContacts,
    read: canReadContacts,
    update: canManageContacts,
    delete: canManageContacts,
  },
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (!data || data.phone === undefined) return data

        const input = String(data.phone)
        if (/^\d{11}$/.test(input)) {
          if (!/^[1-9]{2}9\d{8}$/.test(input)) {
            throw new APIError('Celular brasileiro inválido.', 400)
          }
          return data
        }

        const phone = normalizeBrazilianPhone(input)
        if (!phone) {
          throw new APIError('Celular brasileiro inválido.', 400)
        }

        data.phone = phone
        return data
      },
    ],
    beforeChange: [enforceUniqueContactPhone],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
      minLength: 2,
      maxLength: 120,
      required: true,
    },
    {
      name: 'email',
      type: 'email',
      label: 'E-mail',
      required: false,
    },
    {
      name: 'phone',
      type: 'text',
      label: 'Celular',
      minLength: 11,
      maxLength: 11,
      required: true,
      index: true,
    },
    {
      name: 'gender',
      type: 'select',
      label: 'Gênero',
      options: [
        { label: 'Feminino', value: 'feminino' },
        { label: 'Masculino', value: 'masculino' },
        { label: 'Outro', value: 'outro' },
        { label: 'Não informado', value: 'nao_informado' },
      ],
    },
    {
      name: 'state',
      type: 'select',
      label: 'Estado',
      options: Object.keys(CitiesByState) as (keyof typeof CitiesByState)[],
      required: true,
    },
    {
      name: 'city',
      type: 'text',
      label: 'Cidade',
      minLength: 2,
      maxLength: 100,
      required: false,
    },
    {
      name: 'postalCode',
      type: 'text',
      label: 'CEP',
      minLength: 8,
      maxLength: 8,
    },
  ],
}
