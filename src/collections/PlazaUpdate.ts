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

import {
  canCreatePlazaUpdate,
  canMutatePlazaUpdate,
  canReadPlazaUpdate,
  canSetPlazaUpdateAuthor,
} from '@/utilities/campaignAccess'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { relationshipId } from '@/utilities/relationship'

const DERIVED_PLAZA_UPDATE_CONTEXT = 'plazaUpdateDerivedField'

const nonEmptyText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0

const validatePlazaUpdateKind: CollectionBeforeValidateHook = ({
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
  } else if (!nonEmptyText(nextData.body)) {
    throw new APIError('Informe o texto da atualização.', 400)
  }

  return data
}

const uniqueSortedPlazaIDs = (values: Array<number | null>): number[] =>
  [...new Set(values.filter((value): value is number => value !== null))].sort(
    (left, right) => left - right,
  )

const acquirePlazaUpdateLocks = (req: PayloadRequest, plazaIDs: number[]) =>
  acquireTextAdvisoryLocks(
    req.payload,
    req,
    plazaIDs.map((plazaID) => `plaza-updates:${plazaID}`),
  )

const recomputePlazaLastUpdateAt = async (req: PayloadRequest, plazaIDs: number[]) => {
  for (const plazaID of plazaIDs) {
    const latest = await req.payload.find({
      collection: 'plazaUpdate',
      where: { plaza: { equals: plazaID } },
      depth: 0,
      limit: 1,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    })

    await req.payload.update({
      collection: 'plaza',
      id: plazaID,
      data: { lastUpdateAt: latest.docs[0]?.createdAt ?? null },
      depth: 0,
      overrideAccess: true,
      context: {
        [DERIVED_PLAZA_UPDATE_CONTEXT]: true,
      },
      req,
    })
  }
}

const lockPlazasBeforeChange: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (context[DERIVED_PLAZA_UPDATE_CONTEXT]) return data

  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.author = req.user.id
  }

  const plazaIDs = uniqueSortedPlazaIDs([
    relationshipId(originalDoc?.plaza),
    relationshipId(data.plaza ?? originalDoc?.plaza),
  ])
  if (plazaIDs.length === 0) throw new APIError('Praça da atualização inválida.', 500)

  await acquirePlazaUpdateLocks(req, plazaIDs)
  return data
}

const lockPlazaBeforeDelete: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context[DERIVED_PLAZA_UPDATE_CONTEXT]) return

  const doc = await req.payload.findByID({
    collection: 'plazaUpdate',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const plazaIDs = uniqueSortedPlazaIDs([relationshipId(doc.plaza)])
  if (plazaIDs.length === 0) throw new APIError('Praça da atualização inválida.', 500)

  await acquirePlazaUpdateLocks(req, plazaIDs)
}

const recomputeChangedPlazas: CollectionAfterChangeHook = async ({
  context,
  doc,
  previousDoc,
  req,
}) => {
  if (context[DERIVED_PLAZA_UPDATE_CONTEXT]) return doc

  const plazaIDs = uniqueSortedPlazaIDs([
    relationshipId(previousDoc?.plaza),
    relationshipId(doc.plaza),
  ])
  if (plazaIDs.length === 0) throw new APIError('Praça da atualização inválida.', 500)

  await acquirePlazaUpdateLocks(req, plazaIDs)
  await recomputePlazaLastUpdateAt(req, plazaIDs)
  return doc
}

const recomputeDeletedPlaza: CollectionAfterDeleteHook = async ({ context, doc, req }) => {
  if (context[DERIVED_PLAZA_UPDATE_CONTEXT]) return doc

  const plazaIDs = uniqueSortedPlazaIDs([relationshipId(doc.plaza)])
  if (plazaIDs.length === 0) throw new APIError('Praça da atualização inválida.', 500)

  await acquirePlazaUpdateLocks(req, plazaIDs)
  await recomputePlazaLastUpdateAt(req, plazaIDs)
  return doc
}

export const PlazaUpdate: CollectionConfig = {
  slug: 'plazaUpdate',
  labels: {
    singular: 'Atualização da Praça',
    plural: 'Atualizações das Praças',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'kind',
    defaultColumns: ['plaza', 'author', 'kind', 'createdAt'],
  },
  access: {
    create: canCreatePlazaUpdate,
    read: canReadPlazaUpdate,
    update: canMutatePlazaUpdate,
    delete: canMutatePlazaUpdate,
  },
  hooks: {
    beforeValidate: [validatePlazaUpdateKind],
    beforeChange: [lockPlazasBeforeChange],
    beforeDelete: [lockPlazaBeforeDelete],
    afterChange: [recomputeChangedPlazas],
    afterDelete: [recomputeDeletedPlaza],
  },
  fields: [
    {
      name: 'plaza',
      type: 'relationship',
      relationTo: 'plaza',
      label: 'Praça',
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
        create: canSetPlazaUpdateAuthor,
        update: canSetPlazaUpdateAuthor,
      },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      defaultValue: 'semanal',
      index: true,
      options: [
        { label: 'Semanal', value: 'semanal' },
        { label: 'Urgente', value: 'urgente' },
        { label: 'Nota', value: 'nota' },
      ],
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
  ],
}
