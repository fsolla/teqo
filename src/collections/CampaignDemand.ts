import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  campaignDemandKindLabels,
  campaignDemandKinds,
  campaignDemandStatusLabels,
  campaignDemandStatuses,
  campaignDemandTransitions,
  type CampaignDemandStatus,
} from '@/lib/schemas/campaignDemand'
import {
  canCreateCampaignDemand,
  canDeleteCampaignDemand,
  canManageCampaignStaffField,
  canReadCampaignDemand,
  canReadCampaignStaffField,
  canSetCampaignSystemField,
  canUpdateCampaignDemand,
  isCampaignUnrestricted,
} from '@/utilities/campaignAccess'
import { slugify } from '@/utilities/slug'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const DEMAND_KIND_OPTIONS = campaignDemandKinds.map((value) => ({
  value,
  label: campaignDemandKindLabels[value],
}))

const DEMAND_STATUS_OPTIONS = campaignDemandStatuses.map((value) => ({
  value,
  label: campaignDemandStatusLabels[value],
}))

const setCanonicalDemandSlug: CollectionBeforeValidateHook = ({ data, operation, originalDoc }) => {
  if (!data) return data
  const title = trimmedText(data.title ?? originalDoc?.title)
  const slug = slugify(title)
  if (!slug) {
    throw new APIError('Informe um título com letras ou números.', 400)
  }
  data.title = title
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

const isDemandStatus = (value: unknown): value is CampaignDemandStatus =>
  typeof value === 'string' && (campaignDemandStatuses as readonly string[]).includes(value)

/**
 * Workflow + authorship rules (staff-only creation):
 * - status moves follow campaignDemandTransitions; decisions on "escalada"
 *   demands are coordinator/candidate-only;
 * - every status move appends a server-derived statusHistory entry.
 */
const enforceDemandWorkflow: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  const actor = req.user?.collection === 'campaignUser' ? req.user : null

  if (operation === 'create') {
    if (actor) data.createdBy = actor.id

    const initialStatus = isDemandStatus(data.status) ? data.status : 'aberta'
    data.status = initialStatus
    data.statusHistory = [
      {
        status: initialStatus,
        note: trimmedText(data.decisionNote) || null,
        author: actor?.id ?? null,
        createdAt: new Date().toISOString(),
      },
    ]

    return data
  }

  const previousStatus: CampaignDemandStatus = isDemandStatus(originalDoc?.status)
    ? originalDoc.status
    : 'aberta'
  const rawNextStatus: unknown = data.status === undefined ? previousStatus : data.status

  if (!isDemandStatus(rawNextStatus)) {
    throw new APIError('Status de demanda inválido.', 400)
  }
  const nextStatus: CampaignDemandStatus = rawNextStatus

  if (nextStatus !== previousStatus) {
    const allowed = campaignDemandTransitions[previousStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      throw new APIError(
        `Transição de status inválida: ${campaignDemandStatusLabels[previousStatus]} → ${campaignDemandStatusLabels[nextStatus]}.`,
        409,
      )
    }

    if (
      previousStatus === 'escalada' &&
      (nextStatus === 'aprovada' || nextStatus === 'rejeitada') &&
      actor &&
      !isCampaignUnrestricted(actor)
    ) {
      throw new APIError(
        'Demandas escaladas são decididas pelo Coordenador Geral ou Candidato.',
        403,
      )
    }

    const history = Array.isArray(originalDoc?.statusHistory) ? [...originalDoc.statusHistory] : []
    history.push({
      status: nextStatus,
      note: trimmedText(data.decisionNote ?? originalDoc?.decisionNote) || null,
      author: actor?.id ?? null,
      createdAt: new Date().toISOString(),
    })
    data.statusHistory = history

    if (nextStatus === 'aprovada' || nextStatus === 'rejeitada') {
      data.decidedBy = actor?.id ?? null
      data.decidedAt = new Date().toISOString()
    }
  } else if (data.statusHistory !== undefined) {
    // History is append-only and server-derived.
    data.statusHistory = originalDoc?.statusHistory ?? []
  }

  return data
}

export const CampaignDemand: CollectionConfig = {
  slug: 'campaignDemand',
  labels: {
    singular: 'Demanda',
    plural: 'Demandas',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'title',
    defaultColumns: ['title', 'kind', 'municipality', 'status', 'updatedAt'],
    description:
      'Necessidades operacionais da campanha. Custo e comprovantes são controle interno — não substituem a prestação de contas oficial (SPCE/TSE).',
  },
  access: {
    create: canCreateCampaignDemand,
    read: canReadCampaignDemand,
    update: canUpdateCampaignDemand,
    delete: canDeleteCampaignDemand,
  },
  hooks: {
    beforeValidate: [setCanonicalDemandSlug],
    beforeChange: [enforceDemandWorkflow],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      minLength: 2,
      maxLength: 160,
      index: true,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Slug',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: [...DEMAND_KIND_OPTIONS],
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      maxLength: 4000,
    },
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Município',
      required: true,
      index: true,
    },
    {
      name: 'actionPlan',
      type: 'relationship',
      relationTo: 'actionPlan',
      label: 'Plano de ação',
      index: true,
    },
    {
      name: 'leadership',
      type: 'relationship',
      relationTo: 'leadership',
      label: 'Liderança solicitante',
      index: true,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'aberta',
      index: true,
      access: {
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      options: [...DEMAND_STATUS_OPTIONS],
    },
    {
      name: 'decisionNote',
      type: 'textarea',
      label: 'Nota da decisão',
      maxLength: 2000,
      access: {
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
    },
    {
      name: 'decidedBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Decidida por',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'decidedAt',
      type: 'date',
      label: 'Decidida em',
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'cost',
      type: 'number',
      label: 'Custo estimado (R$)',
      min: 0,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      admin: {
        description: 'Controle interno de gastos. Não substitui a prestação de contas oficial.',
      },
    },
    {
      name: 'receipts',
      type: 'upload',
      relationTo: 'media',
      label: 'Comprovantes',
      hasMany: true,
      access: {
        create: canManageCampaignStaffField,
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      admin: {
        description:
          'Documentos fiscais podem conter CPF/CNPJ — acesso restrito ao staff. Não substitui o SPCE.',
      },
    },
    {
      name: 'statusHistory',
      type: 'array',
      label: 'Histórico de status',
      access: {
        read: canReadCampaignStaffField,
        update: canSetCampaignSystemField,
      },
      admin: {
        readOnly: true,
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          label: 'Status',
          required: true,
          options: [...DEMAND_STATUS_OPTIONS],
        },
        {
          name: 'note',
          type: 'textarea',
          label: 'Nota',
          maxLength: 2000,
        },
        {
          name: 'author',
          type: 'relationship',
          relationTo: 'campaignUser',
          label: 'Autor',
        },
        {
          name: 'createdAt',
          type: 'date',
          label: 'Registrado em',
        },
      ],
    },
    {
      name: 'createdBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Criado por',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
  ],
}
