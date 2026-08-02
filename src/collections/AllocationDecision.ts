import { systemStampedActorField } from '@/utilities/campaignAuditFields'
import { Buffer } from 'node:buffer'

import type {
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'
import { APIError } from 'payload'

import {
  canCreateAllocationDecision,
  canMutateAllocationDecision,
  canReadAllocationDecision,
  canSetCampaignSystemField,
} from '@/utilities/campaignAccess'

const MAX_SERIALIZED_SNAPSHOT_BYTES = 16_000

const validateAllocationDecision: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  if (
    nextData.outcome === 'descarta' &&
    (typeof nextData.alternativeReading !== 'string' || !nextData.alternativeReading.trim())
  ) {
    throw new APIError('Informe a leitura alternativa ao descartar a sugestão.', 400)
  }

  if (
    nextData.outcome !== 'movimento' &&
    (typeof nextData.rationale !== 'string' || !nextData.rationale.trim())
  ) {
    throw new APIError('Informe a justificativa.', 400)
  }

  try {
    const serializedSnapshot = JSON.stringify(nextData.snapshot)
    if (
      typeof nextData.snapshot !== 'object' ||
      nextData.snapshot === null ||
      Array.isArray(nextData.snapshot) ||
      Buffer.byteLength(serializedSnapshot, 'utf8') > MAX_SERIALIZED_SNAPSHOT_BYTES
    ) {
      throw new APIError('O recorte da decisão está grande demais.', 400)
    }
  } catch (error) {
    if (error instanceof APIError) throw error
    throw new APIError('O recorte da decisão é inválido.', 400)
  }

  return data
}

const deriveDecisionAuthor: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (operation === 'create' && req.user?.collection === 'campaignUser') {
    data.decidedBy = req.user.id
  }
  return data
}

export const AllocationDecision: CollectionConfig = {
  slug: 'allocationDecision',
  labels: {
    singular: 'Decisão de alocação',
    plural: 'Decisões de alocação',
  },
  admin: {
    group: 'Campanha',
    hidden: true,
    useAsTitle: 'patternId',
  },
  access: {
    create: canCreateAllocationDecision,
    read: canReadAllocationDecision,
    update: canMutateAllocationDecision,
    delete: canMutateAllocationDecision,
  },
  hooks: {
    beforeValidate: [validateAllocationDecision],
    beforeChange: [deriveDecisionAuthor],
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
      name: 'patternId',
      type: 'text',
      label: 'Padrão avaliado',
      required: true,
      maxLength: 120,
      index: true,
    },
    {
      name: 'outcome',
      type: 'select',
      label: 'Decisão',
      required: true,
      // `aceita`/`descarta` is the triage of a SUGGESTED pattern (E11). A level
      // movement (E14) is neither — it is a decision taken outright — so it
      // gets its own value instead of masquerading as an acceptance. `adiada`
      // (E11) is "not now": recording it as a special-cased dismissal would
      // poison the alternative-reading data the E15 backtest depends on.
      options: [
        { label: 'Aceita', value: 'aceita' },
        { label: 'Descarta', value: 'descarta' },
        { label: 'Movimento', value: 'movimento' },
        { label: 'Adiada', value: 'adiada' },
      ],
    },
    {
      name: 'rationale',
      type: 'textarea',
      label: 'Justificativa',
      // E14 movimento may omit motivo (B134); triage outcomes validate in beforeValidate.
      required: false,
      maxLength: 2000,
    },
    {
      name: 'alternativeReading',
      type: 'textarea',
      label: 'Leitura alternativa',
      maxLength: 2000,
      admin: {
        condition: (_, siblingData) => siblingData.outcome === 'descarta',
      },
    },
    {
      name: 'snapshot',
      type: 'json',
      label: 'Recorte da decisão',
      required: true,
      admin: {
        description: 'Somente os números e classificações usados no momento da decisão.',
      },
    },
    systemStampedActorField({
      name: 'decidedBy',
      label: 'Decidido por',
      setAccess: canSetCampaignSystemField,
    }),
  ],
}
