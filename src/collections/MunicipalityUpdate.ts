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
import { trimmedText } from '@/lib/text'
import {
  canAssignUpdateResponsible,
  canCommentOnMunicipalityUpdate,
  canCreateMunicipalityUpdate,
  canDeleteMunicipalityUpdate,
  canReadMunicipalityUpdate,
  canResolveMunicipalityUpdate,
  canSetMunicipalityUpdateAuthor,
  canSetMunicipalityUpdateSystemField,
  canUpdateMunicipalityUpdate,
  eligibleCampaignStaffWhere,
  MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS,
} from '@/utilities/campaignAccess'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

const DERIVED_MUNICIPALITY_UPDATE_CONTEXT = 'municipalityUpdateDerivedField'

/** C88 — fields the deliberative writes may touch; everything else is a 403. */
const MUNICIPALITY_UPDATE_DELIBERATION_ALLOWLIST = [
  'responsible',
  'resolvedBy',
  'resolvedAt',
  'comments',
]
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

/**
 * C88 — the deliberative write path (`assignResponsible`/`appendComment`/
 * `resolve`/`reopen`). Fail-closed on three fronts: only the allowlisted
 * fields may CHANGE (Payload's beforeChange `data` is the merged doc, so the
 * gate is the diff against `originalDoc`), comment items are stamped
 * (author/createdAt) exactly like `Activity.updates`, and the resolve/reopen
 * transitions stamp or clear the audit fields from the acting user — never
 * from the request body. The raw update path (admin) is untouched:
 * non-deliberative updates return here without any change.
 */
const deriveMunicipalityUpdateDeliberation: CollectionBeforeChangeHook = ({
  context,
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (operation !== 'update' || !data) return data

  const mutationKind = context?.mutationKind
  if (
    typeof mutationKind !== 'string' ||
    !MUNICIPALITY_UPDATE_DELIBERATION_MUTATIONS.has(mutationKind)
  ) {
    return data
  }

  const previous = (originalDoc ?? {}) as Record<string, unknown>
  const changedKeys = Object.keys(data).filter((key) => {
    const next = data[key]
    const before = previous[key]
    if (
      (typeof next === 'object' && next !== null) ||
      (typeof before === 'object' && before !== null)
    ) {
      return JSON.stringify(next) !== JSON.stringify(before)
    }
    return next !== before
  })
  const forbiddenKeys = changedKeys.filter(
    (key) => !MUNICIPALITY_UPDATE_DELIBERATION_ALLOWLIST.includes(key),
  )
  if (forbiddenKeys.length > 0) {
    throw new APIError('Esta atualização não pode ser alterada por deliberação.', 403)
  }

  if (mutationKind === 'appendComment') {
    const previousComments = Array.isArray(originalDoc?.comments) ? originalDoc.comments : []
    const nextComments = Array.isArray(data.comments) ? data.comments : []
    data.comments = nextComments.map((comment: Record<string, unknown>, index: number) => {
      if (index < previousComments.length) return previousComments[index]
      return {
        body: trimmedText(comment.body),
        author: req.user?.collection === 'campaignUser' ? req.user.id : null,
        createdAt: new Date().toISOString(),
      }
    })
  } else if (mutationKind === 'resolve') {
    data.resolvedAt = new Date().toISOString()
    if (req.user?.collection === 'campaignUser') data.resolvedBy = req.user.id
  } else if (mutationKind === 'reopen') {
    data.resolvedBy = null
    data.resolvedAt = null
  }

  return data
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
    defaultColumns: ['municipality', 'author', 'responsible', 'polarity', 'urgent', 'createdAt'],
  },
  access: {
    create: canCreateMunicipalityUpdate,
    read: canReadMunicipalityUpdate,
    update: canUpdateMunicipalityUpdate,
    delete: canDeleteMunicipalityUpdate,
  },
  hooks: {
    beforeValidate: [validateMunicipalityUpdatePolarity],
    beforeChange: [deriveMunicipalityUpdateDeliberation, lockMunicipalitiesBeforeChange],
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
    {
      name: 'responsible',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Responsável',
      index: true,
      filterOptions: eligibleCampaignStaffWhere,
      admin: {
        description: 'Staff do município ou coordenação que acompanha este fato.',
      },
      access: {
        create: canAssignUpdateResponsible,
        update: canAssignUpdateResponsible,
      },
    },
    {
      name: 'resolvedBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Resolvido por',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canResolveMunicipalityUpdate,
        update: canResolveMunicipalityUpdate,
      },
    },
    {
      name: 'resolvedAt',
      type: 'date',
      label: 'Resolvido em',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canResolveMunicipalityUpdate,
        update: canResolveMunicipalityUpdate,
      },
    },
    {
      name: 'comments',
      type: 'array',
      label: 'Comentários',
      admin: {
        description: 'Fio de deliberação sobre esta atualização.',
      },
      // C88 — write gated by the comment rule; READ follows the collection
      // gate (`canReadMunicipalityUpdate`): anyone who can read the update
      // reads its thread, even a somente_leitura advisor.
      access: {
        create: canCommentOnMunicipalityUpdate,
        update: canCommentOnMunicipalityUpdate,
      },
      fields: [
        {
          name: 'body',
          type: 'textarea',
          label: 'Comentário',
          maxLength: 4000,
          required: true,
        },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'campaignUser',
          label: 'Autor',
          index: true,
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetMunicipalityUpdateSystemField,
            update: canSetMunicipalityUpdateSystemField,
          },
        },
        {
          name: 'createdAt',
          type: 'date',
          label: 'Criado em',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetMunicipalityUpdateSystemField,
            update: canSetMunicipalityUpdateSystemField,
          },
        },
      ],
    },
  ],
}
