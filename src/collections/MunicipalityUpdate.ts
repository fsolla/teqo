import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
  PayloadRequest,
} from 'payload'
import { APIError } from 'payload'

import { relationshipId } from '@/lib/relationship'
import {
  MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE,
  municipalityUpdatePolarities,
  municipalityUpdatePolarityLabels,
} from '@/lib/schemas/municipalityUpdate'
import {
  canCreateMunicipalityUpdate,
  canMutateMunicipalityUpdate,
  canReadMunicipalityUpdate,
  canSetMunicipalityUpdateAuthor,
} from '@/utilities/campaignAccess'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const DERIVED_MUNICIPALITY_UPDATE_CONTEXT = 'municipalityUpdateDerivedField'
const MUNICIPALITY_UPDATE_POLARITY_OPTIONS = municipalityUpdatePolarities.map((value) => ({
  label: municipalityUpdatePolarityLabels[value],
  value,
}))

const nonEmptyText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0

const validateMunicipalityUpdatePolarity: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data

  if (!nonEmptyText(nextData.body)) {
    throw new APIError(MUNICIPALITY_UPDATE_BODY_REQUIRED_MESSAGE, 400)
  }

  if (
    nextData.polarity === undefined ||
    !municipalityUpdatePolarities.includes(nextData.polarity)
  ) {
    throw new APIError('Informe a polaridade da atualização.', 400)
  }

  return data
}

const uniqueSortedMunicipalityIDs = (values: Array<number | null>): number[] =>
  [...new Set(values.filter((value): value is number => value !== null))].sort(
    (left, right) => left - right,
  )

const acquireMunicipalityUpdateLocks = (req: PayloadRequest, municipalityIDs: number[]) =>
  acquireTextAdvisoryLocks(
    req.payload,
    req,
    municipalityIDs.map((municipalityID) => `municipality-updates:${municipalityID}`),
  )

const recomputeMunicipalityLastUpdateAt = async (
  req: PayloadRequest,
  municipalityIDs: number[],
) => {
  for (const municipalityID of municipalityIDs) {
    const latest = await req.payload.find({
      collection: 'municipalityUpdate',
      where: { municipality: { equals: municipalityID } },
      depth: 0,
      limit: 1,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    })

    await req.payload.update({
      collection: 'municipality',
      id: municipalityID,
      data: { lastUpdateAt: latest.docs[0]?.createdAt ?? null },
      depth: 0,
      overrideAccess: true,
      context: {
        [DERIVED_MUNICIPALITY_UPDATE_CONTEXT]: true,
      },
      req,
    })
  }
}

const lockMunicipalitiesBeforeChange: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (context[DERIVED_MUNICIPALITY_UPDATE_CONTEXT]) return data

  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.author = req.user.id
  }

  const municipalityIDs = uniqueSortedMunicipalityIDs([
    relationshipId(originalDoc?.municipality),
    relationshipId(data.municipality ?? originalDoc?.municipality),
  ])
  if (municipalityIDs.length === 0) throw new APIError('Município da atualização inválido.', 500)

  await acquireMunicipalityUpdateLocks(req, municipalityIDs)
  return data
}

const lockMunicipalityBeforeDelete: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context[DERIVED_MUNICIPALITY_UPDATE_CONTEXT]) return

  const doc = await req.payload.findByID({
    collection: 'municipalityUpdate',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const municipalityIDs = uniqueSortedMunicipalityIDs([relationshipId(doc.municipality)])
  if (municipalityIDs.length === 0) throw new APIError('Município da atualização inválido.', 500)

  await acquireMunicipalityUpdateLocks(req, municipalityIDs)
}

const recomputeChangedMunicipalities: CollectionAfterChangeHook = async ({
  context,
  doc,
  operation,
  previousDoc,
  req,
}) => {
  if (context[DERIVED_MUNICIPALITY_UPDATE_CONTEXT]) return doc

  const municipalityIDs = uniqueSortedMunicipalityIDs([
    relationshipId(previousDoc?.municipality),
    relationshipId(doc.municipality),
  ])
  if (municipalityIDs.length === 0) throw new APIError('Município da atualização inválido.', 500)

  await acquireMunicipalityUpdateLocks(req, municipalityIDs)
  await recomputeMunicipalityLastUpdateAt(req, municipalityIDs)

  if (operation === 'create') {
    const { notifyMunicipalityUpdateCreated } =
      await import('@/utilities/notification/notificationEvents')
    await notifyMunicipalityUpdateCreated(req, doc)
  }

  return doc
}

const recomputeDeletedMunicipality: CollectionAfterDeleteHook = async ({ context, doc, req }) => {
  if (context[DERIVED_MUNICIPALITY_UPDATE_CONTEXT]) return doc

  const municipalityIDs = uniqueSortedMunicipalityIDs([relationshipId(doc.municipality)])
  if (municipalityIDs.length === 0) throw new APIError('Município da atualização inválido.', 500)

  await acquireMunicipalityUpdateLocks(req, municipalityIDs)
  await recomputeMunicipalityLastUpdateAt(req, municipalityIDs)
  return doc
}

export const MunicipalityUpdate: CollectionConfig = {
  slug: 'municipalityUpdate',
  labels: {
    singular: 'Atualização do Município',
    plural: 'Atualizações dos Municípios',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'body',
    defaultColumns: ['municipality', 'author', 'polarity', 'urgent', 'createdAt'],
  },
  access: {
    create: canCreateMunicipalityUpdate,
    read: canReadMunicipalityUpdate,
    update: canMutateMunicipalityUpdate,
    delete: canMutateMunicipalityUpdate,
  },
  hooks: {
    beforeValidate: [validateMunicipalityUpdatePolarity],
    beforeChange: [lockMunicipalitiesBeforeChange],
    beforeDelete: [lockMunicipalityBeforeDelete],
    afterChange: [recomputeChangedMunicipalities],
    afterDelete: [recomputeDeletedMunicipality],
  },
  fields: [
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
      required: true,
      index: true,
    },
    {
      name: 'author',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Autor',
      required: true,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetMunicipalityUpdateAuthor,
        update: canSetMunicipalityUpdateAuthor,
      },
    },
    {
      name: 'polarity',
      type: 'select',
      label: 'Polaridade',
      required: true,
      defaultValue: 'neutra',
      index: true,
      options: MUNICIPALITY_UPDATE_POLARITY_OPTIONS,
    },
    {
      name: 'urgent',
      type: 'checkbox',
      label: 'Urgente',
      defaultValue: false,
      index: true,
    },
    {
      name: 'adversarySignal',
      type: 'checkbox',
      label: 'Alerta de adversário',
      defaultValue: false,
      index: true,
      admin: {
        condition: (req) => req?.user?.collection === 'users',
      },
    },
    {
      name: 'body',
      type: 'textarea',
      label: 'Texto',
      maxLength: 5000,
      required: true,
    },
    {
      name: 'activeVolunteers',
      type: 'number',
      label: 'Voluntários ativos',
      min: 0,
    },
    {
      name: 'newSupports',
      type: 'number',
      label: 'Novos apoios',
      min: 0,
    },
  ],
}
