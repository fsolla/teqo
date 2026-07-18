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
  canCreateNucleusUpdate,
  canMutateNucleusUpdate,
  canReadNucleusUpdate,
  canSetNucleusUpdateAuthor,
} from '@/utilities/campaignAccess'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'
import { relationshipId } from '@/utilities/relationship'

const DERIVED_NUCLEUS_UPDATE_CONTEXT = 'nucleusUpdateDerivedField'

const nonEmptyText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim().length > 0

const validateNucleusUpdateKind: CollectionBeforeValidateHook = ({
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

const uniqueSortedNucleusIDs = (values: Array<number | null>): number[] =>
  [...new Set(values.filter((value): value is number => value !== null))].sort(
    (left, right) => left - right,
  )

const acquireNucleusUpdateLocks = (req: PayloadRequest, nucleusIDs: number[]) =>
  acquireTextAdvisoryLocks(
    req.payload,
    req,
    nucleusIDs.map((nucleusID) => `nucleus-updates:${nucleusID}`),
  )

const recomputeNucleusLastUpdateAt = async (req: PayloadRequest, nucleusIDs: number[]) => {
  for (const nucleusID of nucleusIDs) {
    const latest = await req.payload.find({
      collection: 'nucleusUpdate',
      where: { nucleus: { equals: nucleusID } },
      depth: 0,
      limit: 1,
      sort: '-createdAt',
      overrideAccess: true,
      req,
    })

    await req.payload.update({
      collection: 'electoralNucleus',
      id: nucleusID,
      data: { lastUpdateAt: latest.docs[0]?.createdAt ?? null },
      depth: 0,
      overrideAccess: true,
      context: {
        [DERIVED_NUCLEUS_UPDATE_CONTEXT]: true,
      },
      req,
    })
  }
}

const lockNucleiBeforeChange: CollectionBeforeChangeHook = async ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (context[DERIVED_NUCLEUS_UPDATE_CONTEXT]) return data

  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.author = req.user.id
  }

  const nucleusIDs = uniqueSortedNucleusIDs([
    relationshipId(originalDoc?.nucleus),
    relationshipId(data.nucleus ?? originalDoc?.nucleus),
  ])
  if (nucleusIDs.length === 0) throw new APIError('Núcleo da atualização inválido.', 500)

  await acquireNucleusUpdateLocks(req, nucleusIDs)
  return data
}

const lockNucleusBeforeDelete: CollectionBeforeDeleteHook = async ({ context, id, req }) => {
  if (context[DERIVED_NUCLEUS_UPDATE_CONTEXT]) return

  const doc = await req.payload.findByID({
    collection: 'nucleusUpdate',
    id,
    depth: 0,
    overrideAccess: true,
    req,
  })
  const nucleusIDs = uniqueSortedNucleusIDs([relationshipId(doc.nucleus)])
  if (nucleusIDs.length === 0) throw new APIError('Núcleo da atualização inválido.', 500)

  await acquireNucleusUpdateLocks(req, nucleusIDs)
}

const recomputeChangedNuclei: CollectionAfterChangeHook = async ({
  context,
  doc,
  previousDoc,
  req,
}) => {
  if (context[DERIVED_NUCLEUS_UPDATE_CONTEXT]) return doc

  const nucleusIDs = uniqueSortedNucleusIDs([
    relationshipId(previousDoc?.nucleus),
    relationshipId(doc.nucleus),
  ])
  if (nucleusIDs.length === 0) throw new APIError('Núcleo da atualização inválido.', 500)

  await acquireNucleusUpdateLocks(req, nucleusIDs)
  await recomputeNucleusLastUpdateAt(req, nucleusIDs)
  return doc
}

const recomputeDeletedNucleus: CollectionAfterDeleteHook = async ({ context, doc, req }) => {
  if (context[DERIVED_NUCLEUS_UPDATE_CONTEXT]) return doc

  const nucleusIDs = uniqueSortedNucleusIDs([relationshipId(doc.nucleus)])
  if (nucleusIDs.length === 0) throw new APIError('Núcleo da atualização inválido.', 500)

  await acquireNucleusUpdateLocks(req, nucleusIDs)
  await recomputeNucleusLastUpdateAt(req, nucleusIDs)
  return doc
}

export const NucleusUpdate: CollectionConfig = {
  slug: 'nucleusUpdate',
  labels: {
    singular: 'Atualização do núcleo',
    plural: 'Atualizações dos núcleos',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'kind',
    defaultColumns: ['nucleus', 'author', 'kind', 'createdAt'],
  },
  access: {
    create: canCreateNucleusUpdate,
    read: canReadNucleusUpdate,
    update: canMutateNucleusUpdate,
    delete: canMutateNucleusUpdate,
  },
  hooks: {
    beforeValidate: [validateNucleusUpdateKind],
    beforeChange: [lockNucleiBeforeChange],
    beforeDelete: [lockNucleusBeforeDelete],
    afterChange: [recomputeChangedNuclei],
    afterDelete: [recomputeDeletedNucleus],
  },
  fields: [
    {
      name: 'nucleus',
      type: 'relationship',
      relationTo: 'electoralNucleus',
      label: 'Núcleo eleitoral',
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
        create: canSetNucleusUpdateAuthor,
        update: canSetNucleusUpdateAuthor,
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
