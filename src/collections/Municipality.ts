import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH,
  engagementLevels,
  formatEngagementLevelLabel,
} from '@/lib/engagementLevel'
import { politicalTrendStatuses } from '@/lib/schemas/municipality'
import {
  getVoteEstimateOrderViolation,
  VOTE_ESTIMATE_ORDER_ERROR_MESSAGE,
  type VoteEstimateScenarioFields,
} from '@/lib/voteEstimate'
import {
  canAssignMunicipalityAdvisors,
  canCreateMunicipality,
  canDeleteMunicipality,
  canManageCampaignStaffField,
  canManageMunicipalityAdvisors,
  canManageMunicipalityEngagementLevel,
  canReadCampaignStaffField,
  canReadMunicipality,
  canSetCampaignSystemField,
  canUpdateMunicipality,
  eligibleCampaignStaffWhere,
} from '@/utilities/campaignAccess'
import { politicalTrendLabels } from '@/utilities/municipalityLabels'
import { relationshipId, uniqueRelationshipIds } from '@/utilities/relationship'
import {
  voteEstimateScenarioGroupAccess,
  voteEstimateScenarioGroupFields,
} from '@/utilities/voteEstimateScenarioFields'

const voteEstimateNumber = (value: unknown): number | null | undefined => {
  if (value === null || value === undefined || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new APIError('Cada estimativa de votos deve ser um número inteiro não negativo.', 400)
  }
  return Math.trunc(value)
}

const validateExpectedVotes: CollectionBeforeValidateHook = ({ data, originalDoc, operation }) => {
  if (!data) return data

  const mergedExpected =
    data.expectedVotes !== undefined
      ? { ...(originalDoc?.expectedVotes ?? {}), ...(data.expectedVotes as object) }
      : operation === 'update'
        ? originalDoc?.expectedVotes
        : undefined

  if (!mergedExpected || typeof mergedExpected !== 'object') return data

  const pessimistic = voteEstimateNumber((mergedExpected as VoteEstimateScenarioFields).pessimistic)
  const central = voteEstimateNumber((mergedExpected as VoteEstimateScenarioFields).central)
  const optimistic = voteEstimateNumber((mergedExpected as VoteEstimateScenarioFields).optimistic)

  if (getVoteEstimateOrderViolation({ pessimistic, central, optimistic })) {
    throw new APIError(VOTE_ESTIMATE_ORDER_ERROR_MESSAGE, 400)
  }

  if (data.expectedVotes && typeof data.expectedVotes === 'object') {
    data.expectedVotes = {
      pessimistic:
        (data.expectedVotes as { pessimistic?: unknown }).pessimistic === undefined
          ? (originalDoc?.expectedVotes?.pessimistic ?? null)
          : pessimistic,
      central:
        (data.expectedVotes as { central?: unknown }).central === undefined
          ? (originalDoc?.expectedVotes?.central ?? null)
          : central,
      optimistic:
        (data.expectedVotes as { optimistic?: unknown }).optimistic === undefined
          ? (originalDoc?.expectedVotes?.optimistic ?? null)
          : optimistic,
    }
  }

  return data
}

const validateMunicipalityAdvisors: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data || data.advisors === undefined) return data

  const advisorIDs = Array.isArray(data.advisors) ? uniqueRelationshipIds(data.advisors) : []
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
    throw new APIError(
      'Cada assessor deve ter papel de Coordenador Geral, Assessor ou Candidato.',
      400,
    )
  }

  return data
}

/**
 * E14 — `levelChangedAt` is the clock the movement rules read (protection
 * window, one movement per month), so it is derived here rather than trusted
 * from the caller: an admin editing the level in `/admin` has to start the
 * same clock the server action does.
 */
const deriveEngagementLevelAudit: CollectionBeforeChangeHook = ({ data, originalDoc }) => {
  if (!data || data.engagementLevel === undefined) return data
  if (data.engagementLevel === (originalDoc?.engagementLevel ?? null)) return data

  // Clearing the level clears its clock too: "registrado em" with no level is
  // a date that describes nothing, and the rules would read it as history.
  data.levelChangedAt = data.engagementLevel ? new Date().toISOString() : null
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

export const Municipality: CollectionConfig = {
  slug: 'municipality',
  labels: {
    singular: 'Município',
    plural: 'Municípios',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
    defaultColumns: ['name', 'kind', 'region', 'priority', 'updatedAt'],
    description:
      'Os 435 municípios operacionais são pré-definidos (município inteiro, ou zona eleitoral em Salvador) e criados por migração. A geografia não é editável.',
  },
  access: {
    create: canCreateMunicipality,
    read: canReadMunicipality,
    update: canUpdateMunicipality,
    delete: canDeleteMunicipality,
  },
  hooks: {
    beforeValidate: [validateMunicipalityAdvisors, validateExpectedVotes],
    beforeChange: [derivePoliticalTrendAudit, deriveEngagementLevelAudit],
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
        { label: 'Município inteiro', value: 'municipio' },
        { label: 'Zona eleitoral (Salvador)', value: 'zona' },
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
        description: 'Preenchido apenas para municípios de zona (Salvador).',
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
        create: canAssignMunicipalityAdvisors,
        update: canManageMunicipalityAdvisors,
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
      name: 'engagementLevel',
      type: 'select',
      label: 'Nível de envolvimento',
      index: true,
      // No default on purpose: stamping N2 on all 435 municípios would assert a
      // decision nobody took. Absent means "ainda não decidido", and filtering
      // for it is the triage queue.
      access: {
        read: canReadCampaignStaffField,
        create: canManageMunicipalityEngagementLevel,
        update: canManageMunicipalityEngagementLevel,
      },
      admin: {
        description:
          'Quanto a campanha investe neste município (N0 a N4). Movimento é decisão da coordenação e fica registrado em Decisões de alocação.',
      },
      // Single source: the ladder in `lib/engagementLevel` + the shared label table.
      options: engagementLevels.map((value) => ({
        label: formatEngagementLevelLabel(value),
        value,
      })),
    },
    {
      name: 'levelNote',
      type: 'textarea',
      label: 'Motivo do nível',
      maxLength: ENGAGEMENT_LEVEL_TEXT_MAX_LENGTH,
      access: {
        read: canReadCampaignStaffField,
        create: canManageMunicipalityEngagementLevel,
        update: canManageMunicipalityEngagementLevel,
      },
      admin: {
        description: 'Motivo corrente do nível — o histórico vive em Decisões de alocação.',
      },
    },
    {
      name: 'levelChangedAt',
      type: 'date',
      label: 'Nível registrado em',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derivado da última mudança de nível.',
      },
      access: {
        read: canReadCampaignStaffField,
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
    {
      name: 'expectedVotes',
      type: 'group',
      label: 'Votos estimados',
      access: voteEstimateScenarioGroupAccess,
      admin: {
        description:
          'Total esperado do município por cenário (pessimista/média/otimista) — distinto da soma das lideranças.',
      },
      fields: voteEstimateScenarioGroupFields(),
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
          // Single source: the zod enum + the shared label table.
          options: politicalTrendStatuses.map((value) => ({
            label: politicalTrendLabels[value],
            value,
          })),
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
      name: 'stateDeputies',
      type: 'relationship',
      relationTo: 'stateDeputy',
      label: 'Dobradinhas deste município',
      hasMany: true,
      index: true,
      access: {
        read: canReadCampaignStaffField,
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
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
        description: 'Quem dobra no município hoje e o estado da negociação.',
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
        description: 'Próximos passos operacionais para o município.',
      },
    },
    {
      name: 'budgetNotes',
      type: 'textarea',
      label: 'Emendas aportadas',
      maxLength: 4000,
      access: {
        read: canReadCampaignStaffField,
        create: canManageCampaignStaffField,
        update: canManageCampaignStaffField,
      },
      admin: {
        description:
          'Emendas parlamentares aportadas no município (valores, anos, situação) — nota manual da coordenação (G11).',
      },
    },
    {
      name: 'lastUpdateAt',
      type: 'date',
      label: 'Última atualização',
      index: true,
      admin: {
        readOnly: true,
        description: 'Derivado automaticamente do feed de atualizações do município.',
      },
      access: {
        create: canSetCampaignSystemField,
        update: canSetCampaignSystemField,
      },
    },
  ],
}
