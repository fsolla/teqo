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
  municipalitySignalTypeLabels,
  municipalitySignalTypes,
  municipalityUpdateKindLabels,
  municipalityUpdateKinds,
} from '@/lib/schemas/municipalityUpdate'
import {
  canCreateMunicipalityUpdate,
  canMutateMunicipalityUpdate,
  canReadMunicipalityUpdate,
  canSetMunicipalityUpdateAuthor,
} from '@/utilities/campaignAccess'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const DERIVED_MUNICIPALITY_UPDATE_CONTEXT = 'municipalityUpdateDerivedField'
const MUNICIPALITY_UPDATE_KIND_OPTIONS = municipalityUpdateKinds.map((value) => ({
  label: municipalityUpdateKindLabels[value],
  value,
}))
const MUNICIPALITY_SIGNAL_TYPE_OPTIONS = municipalitySignalTypes.map((value) => ({
  label: municipalitySignalTypeLabels[value],
  value,
}))

const nonEmptyText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0

const validateMunicipalityUpdateKind: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const kind = nextData.kind ?? 'semanal'

  if (kind === 'semanal') {
    if (!nonEmptyText(nextData.worked)) throw new APIError('Informe o que funcionou.', 400)
    if (!nonEmptyText(nextData.failed)) throw new APIError('Informe o que não funcionou.', 400)
    if (!nonEmptyText(nextData.needs)) throw new APIError('Informe o que você precisa.', 400)
  } else if (kind === 'sinal') {
    // Motivo/body is optional (B147/B134); type is the required discriminator.
    if (typeof nextData.signalType !== 'string') {
      throw new APIError('Informe o tipo do sinal.', 400)
    }
  } else if (!nonEmptyText(nextData.body)) {
    throw new APIError('Informe o texto da atualização.', 400)
  }

  if (kind !== 'sinal') {
    data.signalType = null
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
    useAsTitle: 'kind',
    defaultColumns: ['municipality', 'author', 'kind', 'createdAt'],
  },
  access: {
    create: canCreateMunicipalityUpdate,
    read: canReadMunicipalityUpdate,
    update: canMutateMunicipalityUpdate,
    delete: canMutateMunicipalityUpdate,
  },
  hooks: {
    beforeValidate: [validateMunicipalityUpdateKind],
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
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      defaultValue: 'semanal',
      index: true,
      options: MUNICIPALITY_UPDATE_KIND_OPTIONS,
    },
    {
      name: 'worked',
      type: 'textarea',
      label: 'O que funcionou',
      maxLength: 3000,
      admin: {
        condition: (_, siblingData) => siblingData.kind === 'semanal',
      },
    },
    {
      name: 'failed',
      type: 'textarea',
      label: 'O que não funcionou',
      maxLength: 3000,
      admin: {
        condition: (_, siblingData) => siblingData.kind === 'semanal',
      },
    },
    {
      name: 'needs',
      type: 'textarea',
      label: 'O que preciso',
      maxLength: 3000,
      admin: {
        condition: (_, siblingData) => siblingData.kind === 'semanal',
      },
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
    {
      name: 'body',
      type: 'textarea',
      label: 'Texto',
      maxLength: 5000,
      admin: {
        condition: (_, siblingData) => siblingData.kind !== 'semanal',
      },
    },
    {
      name: 'signalType',
      type: 'select',
      label: 'Tipo de sinal',
      options: MUNICIPALITY_SIGNAL_TYPE_OPTIONS,
      admin: {
        condition: (_, siblingData) => siblingData.kind === 'sinal',
      },
    },
  ],
}
