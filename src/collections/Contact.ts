import { CitiesByState } from '@/lib/cities'
import { BRAZILIAN_PHONE_INVALID_MESSAGE, normalizeBrazilianPhone } from '@/lib/phone'
import { trimmedText } from '@/lib/text'
import { canManageContacts, canReadContacts } from '@/utilities/campaignAccess'
import { assertStateDeputyNameAvailable } from '@/utilities/stateDeputy/nameInvariant'
import type { CollectionBeforeChangeHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

const enforceStateDeputyName: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !data || data.name === undefined || !originalDoc) return data

  const currentName = trimmedText(originalDoc.name)
  const nextName = trimmedText(data.name)
  if (nextName === currentName) return data

  const linkedDeputy = await req.payload.find({
    collection: 'stateDeputy',
    where: { contact: { equals: originalDoc.id } },
    depth: 0,
    limit: 1,
    pagination: false,
    // Intentional bypass: Contact access is broader than the deputy's scope; this
    // lookup only determines whether the name invariant applies.
    overrideAccess: true,
    req,
  })

  const stateDeputyID = linkedDeputy.docs[0]?.id
  if (stateDeputyID !== undefined) {
    await assertStateDeputyNameAvailable(req.payload, req, nextName, stateDeputyID)
  }

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

        if (data.phone === null || data.phone === '') {
          data.phone = null
          return data
        }

        const input = String(data.phone)
        if (/^\d{11}$/.test(input)) {
          if (!/^[1-9]{2}9\d{8}$/.test(input)) {
            throw new APIError(BRAZILIAN_PHONE_INVALID_MESSAGE, 400)
          }
          return data
        }

        const phone = normalizeBrazilianPhone(input)
        if (!phone) {
          throw new APIError(BRAZILIAN_PHONE_INVALID_MESSAGE, 400)
        }

        data.phone = phone
        return data
      },
    ],
    beforeChange: [enforceStateDeputyName],
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
      // Optional at the collection level so name-only records (e.g. leaderships imported
      // from the projection sheet) can exist; UI flows still require it via zod schemas.
      required: false,
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
