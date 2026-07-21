import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  canAssignPlazaAdvisors,
  canCreatePlaza,
  canDeletePlaza,
  canManageCampaignStaffField,
  canManagePlazaAdvisors,
  canReadCampaignStaffField,
  canReadPlaza,
  canSetCampaignSystemField,
  canUpdatePlaza,
  eligibleCampaignStaffWhere,
} from '@/utilities/campaignAccess'
import { relationshipId } from '@/utilities/relationship'
import {
  getVoteGoalsOrderViolation,
  VOTE_GOALS_ORDER_ERROR_MESSAGE,
  type VoteGoalsFields,
} from '@/utilities/voteGoals'

const voteGoalNumber = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new APIError('Cada meta de votos deve ser um número inteiro não negativo.', 400)
  }
  return Math.trunc(value)
}

const validateVoteGoals: CollectionBeforeValidateHook = ({ data, originalDoc, operation }) => {
  if (!data) return data

  const mergedGoals =
    data.voteGoals !== undefined
      ? { ...(originalDoc?.voteGoals ?? {}), ...(data.voteGoals as object) }
      : operation === 'update'
        ? originalDoc?.voteGoals
        : undefined

  if (!mergedGoals || typeof mergedGoals !== 'object') return data

  const good = voteGoalNumber((mergedGoals as VoteGoalsFields).good)
  const regular = voteGoalNumber((mergedGoals as VoteGoalsFields).regular)
  const minimum = voteGoalNumber((mergedGoals as VoteGoalsFields).minimum)

  if (getVoteGoalsOrderViolation({ good, regular, minimum })) {
    throw new APIError(VOTE_GOALS_ORDER_ERROR_MESSAGE, 400)
  }

  if (data.voteGoals && typeof data.voteGoals === 'object') {
    data.voteGoals = {
      good:
        (data.voteGoals as { good?: unknown }).good === undefined
          ? (originalDoc?.voteGoals?.good ?? null)
          : good,
      regular:
        (data.voteGoals as { regular?: unknown }).regular === undefined
          ? (originalDoc?.voteGoals?.regular ?? null)
          : regular,
      minimum:
        (data.voteGoals as { minimum?: unknown }).minimum === undefined
          ? (originalDoc?.voteGoals?.minimum ?? null)
          : minimum,
    }
  }

  return data
}

const validatePlazaAdvisors: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data || data.advisors === undefined) return data

  const advisorIDs = Array.isArray(data.advisors)
    ? [...new Set(data.advisors.map(relationshipId).filter((id): id is number => id !== null))]
    : []
  if (advisorIDs.length === 0) return data

  const eligibleAdvisors = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: advisorIDs } }, eligibleCampaignStaffWhere],
    },
    select: { name: true },
    overrideAccess: true,
    req,
  })

  if (eligibleAdvisors.docs.length !== advisorIDs.length) {
    throw new APIError('Cada assessor deve ter papel de Coordenador Geral ou Assessor.', 400)
  }

  return data
}

const trendSnapshot = (value: unknown) => {
  const trend = (value ?? {}) as { status?: unknown; note?: unknown }
  return `${trend.status ?? ''}\u0000${typeof trend.note === 'string' ? trend.note.trim() : ''}`
}

const derivePoliticalTrendAudit: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  if (!data || data.politicalTrend === undefined) return data

  const next = { ...(originalDoc?.politicalTrend ?? {}), ...(data.politicalTrend as object) }
  if (trendSnapshot(next) === trendSnapshot(originalDoc?.politicalTrend)) return data

  data.politicalTrend = {
    ...next,
    recordedBy:
      req.user?.collection === 'campaignUser'
        ? req.user.id
        : (relationshipId((next as { recordedBy?: unknown }).recordedBy) ?? null),
    recordedAt: new Date().toISOString(),
  }

  return data
}

export const Plaza: CollectionConfig = {
  slug: 'plaza',
  labels: {
    singular: 'Praça',
    plural: 'Praças',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'region', 'priority', 'updatedAt'],
    description:
      'As 436 Praças são pré-definidas (município, ou zona eleitoral em Salvador e Camaçari) e criadas por migração. A geografia não é editável.',
  },
  access: {
    create: canCreatePlaza,
    read: canReadPlaza,
    update: canUpdatePlaza,
    delete: canDeletePlaza,
  },
  hooks: {
    beforeValidate: [validatePlazaAdvisors, validateVoteGoals],
    beforeChange: [derivePoliticalTrendAudit],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
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
      admin: {
        readOnly: true,
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
      options: [
        { label: 'Município', value: 'municipio' },
        { label: 'Zona eleitoral', value: 'zona' },
      ],
    },
    {
      name: 'city',
      type: 'text',
      label: 'Município',
      required: true,
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
      name: 'region',
      type: 'text',
      label: 'Território de identidade',
      required: true,
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
      name: 'ibgeCode',
      type: 'text',
      label: 'Código IBGE',
      required: true,
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
      name: 'tseCityCode',
      type: 'text',
      label: 'Código TSE do município',
      required: true,
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
      name: 'zoneNumber',
      type: 'number',
      label: 'Zona eleitoral',
      min: 1,
      max: 999,
      index: true,
      admin: {
        readOnly: true,
        description: 'Preenchido apenas para Praças de zona (Salvador e Camaçari).',
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'advisors',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Assessores',
      hasMany: true,
      index: true,
      access: {
        create: canAssignPlazaAdvisors,
        update: canManagePlazaAdvisors,
      },
      filterOptions: eligibleCampaignStaffWhere,
    },
    {
      name: 'priority',
      type: 'select',
      label: 'Prioridade',
      defaultValue: 'normal',
      index: true,
      access: {
        read: canReadCampaignStaffField,
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      options: [
        { label: 'Alta', value: 'alta' },
        { label: 'Normal', value: 'normal' },
      ],
    },
    {
      name: 'voteGoals',
      type: 'group',
      label: 'Metas de votos 2026',
      access: {
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      fields: [
        {
          name: 'good',
          type: 'number',
          label: 'Bom',
          min: 0,
        },
        {
          name: 'regular',
          type: 'number',
          label: 'Regular',
          min: 0,
        },
        {
          name: 'minimum',
          type: 'number',
          label: 'Mínimo',
          min: 0,
        },
      ],
    },
    {
      name: 'politicalTrend',
      type: 'group',
      label: 'Tendência política',
      admin: {
        description:
          'Leitura de conjuntura registrada pela coordenação (alianças, prefeitos, disputas locais) — não é série numérica.',
      },
      access: {
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      fields: [
        {
          name: 'status',
          type: 'select',
          label: 'Tendência',
          options: [
            { label: 'Favorável', value: 'favoravel' },
            { label: 'Neutra', value: 'neutra' },
            { label: 'Desfavorável', value: 'desfavoravel' },
          ],
        },
        {
          name: 'note',
          type: 'textarea',
          label: 'Justificativa',
          maxLength: 2000,
        },
        {
          name: 'recordedBy',
          type: 'relationship',
          relationTo: 'campaignUser',
          label: 'Registrada por',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetCampaignSystemField,
            update: canSetCampaignSystemField,
          },
        },
        {
          name: 'recordedAt',
          type: 'date',
          label: 'Registrada em',
          admin: {
            readOnly: true,
          },
          access: {
            create: canSetCampaignSystemField,
            update: canSetCampaignSystemField,
          },
        },
      ],
    },
    {
      name: 'strengths',
      type: 'array',
      label: 'Forças',
      access: {
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      fields: [
        {
          name: 'text',
          type: 'textarea',
          label: 'Força',
          required: true,
          maxLength: 1000,
        },
      ],
    },
    {
      name: 'risks',
      type: 'array',
      label: 'Riscos',
      access: {
        read: canReadCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      fields: [
        {
          name: 'text',
          type: 'textarea',
          label: 'Risco',
          required: true,
          maxLength: 1000,
        },
      ],
    },
    {
      name: 'dobradinhaNotes',
      type: 'textarea',
      label: 'Dobradinhas (notas)',
      maxLength: 4000,
      access: {
        read: canReadCampaignStaffField,
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      admin: {
        description: 'Quem dobra na Praça hoje e o estado da negociação.',
      },
    },
    {
      name: 'nextSteps',
      type: 'textarea',
      label: 'Encaminhamentos',
      maxLength: 4000,
      access: {
        read: canReadCampaignStaffField,
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      admin: {
        description: 'Próximos passos operacionais para a Praça.',
      },
    },
    {
      name: 'lastUpdateAt',
      type: 'date',
      label: 'Última atualização',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derivado automaticamente do feed de atualizações da Praça.',
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
  ],
}
