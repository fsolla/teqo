import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'
import { APIError } from 'payload'

import {
  isBahiaIdentityTerritory,
  isBahiaMunicipality,
  validateBahiaTerritoryPair,
} from '@/lib/bahiaTerritories'
import {
  canCreateElectoralNucleus,
  canCreateNucleusCoordinators,
  canDeleteElectoralNucleus,
  canManageNucleusCoordinators,
  canManageNucleusLifecycle,
  canReadLeadershipInternal,
  canReadElectoralNucleus,
  canSetDerivedNucleusField,
  canUpdateElectoralNucleus,
} from '@/utilities/campaignAccess'
import { eligibleNucleusCoordinatorWhere } from '@/utilities/nucleusCoordinatorOptions'
import { acquirePrimaryContactInvariantLocks } from '@/utilities/primaryContactInvariantLock'
import { relationshipId } from '@/utilities/relationship'
import { slugify } from '@/utilities/slug'

const trimmedText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const validateNucleusTerritoryAndZones: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data

  const nextData = operation === 'update' ? { ...originalDoc, ...data } : data
  const region = trimmedText(nextData?.region)
  const city = trimmedText(nextData?.city)
  const neighborhood = trimmedText(nextData?.neighborhood)
  const locality = trimmedText(nextData?.locality)
  const territoryNotes = trimmedText(nextData?.territoryNotes)

  if (region && !isBahiaIdentityTerritory(region)) {
    throw new APIError('Selecione um território de identidade válido da Bahia.', 400)
  }
  if (city && !isBahiaMunicipality(city)) {
    throw new APIError('Selecione um município válido da Bahia.', 400)
  }
  if (!validateBahiaTerritoryPair(region, city)) {
    throw new APIError('O município não pertence ao território de identidade selecionado.', 400)
  }
  if (neighborhood && !city) {
    throw new APIError('Informe o município antes do bairro.', 400)
  }
  if (!region && !city && !locality) {
    throw new APIError(
      'Informe o território de identidade, município ou localidade do núcleo.',
      400,
    )
  }

  data.region = region || null
  data.city = city || null
  data.neighborhood = neighborhood || null
  data.locality = locality || null
  data.territoryNotes = territoryNotes || null

  const zones = Array.isArray(nextData.tseZones) ? nextData.tseZones : []
  const zoneNumbers = zones.map((zone: { zoneNumber?: unknown }) => zone?.zoneNumber)

  if (new Set(zoneNumbers).size !== zoneNumbers.length) {
    throw new APIError('Cada Zona TSE deve aparecer apenas uma vez.', 400)
  }

  return data
}

const setCanonicalNucleusSlug: CollectionBeforeValidateHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (!data) return data
  const name = trimmedText(data.name ?? originalDoc?.name)
  const slug = slugify(name)
  if (!slug) {
    throw new APIError('Informe um nome com letras ou números.', 400)
  }
  if (operation === 'update' && data.name !== undefined && name !== originalDoc?.name) {
    throw new APIError('O nome do núcleo não pode ser alterado após a criação.', 409)
  }
  data.name = name
  data.slug = operation === 'create' ? slug : originalDoc?.slug
  return data
}

const validateNucleusCoordinators: CollectionBeforeValidateHook = async ({ data, req }) => {
  if (!data) return data

  if (data.coordinators === undefined) return data
  const coordinatorValues = data.coordinators
  const coordinatorIDs = Array.isArray(coordinatorValues)
    ? [...new Set(coordinatorValues.map(relationshipId).filter((id): id is number => id !== null))]
    : []

  if (coordinatorIDs.length === 0) return data

  const eligibleCoordinators = await req.payload.find({
    collection: 'campaignUser',
    depth: 0,
    pagination: false,
    where: {
      and: [{ id: { in: coordinatorIDs } }, eligibleNucleusCoordinatorWhere],
    },
    select: { name: true },
    overrideAccess: true,
    req,
  })

  if (eligibleCoordinators.docs.length !== coordinatorIDs.length) {
    throw new APIError('Cada responsável deve ter papel de coordenação geral ou coordenador.', 400)
  }

  return data
}

export const ElectoralNucleus: CollectionConfig = {
  slug: 'electoralNucleus',
  labels: {
    singular: 'Núcleo eleitoral',
    plural: 'Núcleos eleitorais',
  },
  admin: {
    group: 'Campanha',
    useAsTitle: 'name',
    defaultColumns: ['name', 'status', 'region', 'city', 'updatedAt'],
  },
  access: {
    create: canCreateElectoralNucleus,
    read: canReadElectoralNucleus,
    update: canUpdateElectoralNucleus,
    delete: canDeleteElectoralNucleus,
  },
  hooks: {
    beforeValidate: [
      setCanonicalNucleusSlug,
      validateNucleusTerritoryAndZones,
      validateNucleusCoordinators,
    ],
    beforeChange: [
      ({ data, operation, req }) => {
        if (operation === 'create' && req.user?.collection === 'campaignUser') {
          data.createdBy = req.user.id
        }

        return data
      },
      async ({ data, operation, originalDoc, req }) => {
        if (data.primaryContact === undefined || data.primaryContact === null) return data

        const contact = relationshipId(data.primaryContact)
        const nucleus = relationshipId(originalDoc?.id)
        if (!contact || operation !== 'update' || !nucleus) {
          throw new APIError(
            'Escolha o contato principal entre as lideranças engajadas após criar o núcleo.',
            400,
          )
        }

        await acquirePrimaryContactInvariantLocks(req, [nucleus])
        const engagedLeadership = await req.payload.find({
          collection: 'leadership',
          where: {
            and: [
              { nucleus: { equals: nucleus } },
              { contact: { equals: contact } },
              { supportStatus: { equals: 'engajado' } },
            ],
          },
          depth: 0,
          limit: 1,
          overrideAccess: true,
          req,
        })

        if (engagedLeadership.totalDocs === 0) {
          throw new APIError(
            'O contato principal deve ser uma liderança engajada neste núcleo.',
            409,
          )
        }

        return data
      },
    ],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      label: 'Nome',
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
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      defaultValue: 'ativo',
      index: true,
      access: {
        create: canSetDerivedNucleusField,
        update: canManageNucleusLifecycle,
      },
      options: [
        { label: 'Ativo', value: 'ativo' },
        { label: 'Arquivado', value: 'arquivado' },
      ],
    },
    {
      name: 'coordinators',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Coordenadores',
      hasMany: true,
      index: true,
      access: {
        create: canCreateNucleusCoordinators,
        update: canManageNucleusCoordinators,
      },
      filterOptions: eligibleNucleusCoordinatorWhere,
    },
    {
      name: 'region',
      type: 'text',
      label: 'Território de identidade',
      index: true,
      validate: (value: unknown) =>
        value === null ||
        value === undefined ||
        (typeof value === 'string' && isBahiaIdentityTerritory(value))
          ? true
          : 'Selecione um território de identidade válido da Bahia.',
    },
    {
      name: 'city',
      type: 'text',
      label: 'Município',
      maxLength: 120,
      index: true,
    },
    {
      name: 'neighborhood',
      type: 'text',
      label: 'Bairro',
      maxLength: 160,
    },
    {
      name: 'locality',
      type: 'text',
      label: 'Localidade',
      maxLength: 160,
    },
    {
      name: 'territoryNotes',
      type: 'textarea',
      label: 'Observações do território',
      maxLength: 2000,
    },
    {
      name: 'organizationKind',
      type: 'select',
      label: 'Natureza organizativa',
      required: true,
      defaultValue: 'territorial',
      index: true,
      options: [
        { label: 'Territorial', value: 'territorial' },
        { label: 'Associação', value: 'associacao' },
        { label: 'Sindicato', value: 'sindicato' },
        { label: 'Religioso', value: 'religioso' },
        { label: 'Movimento', value: 'movimento' },
        { label: 'Categoria profissional', value: 'categoria_profissional' },
        { label: 'Outro', value: 'outro' },
      ],
    },
    {
      name: 'organizationLabel',
      type: 'text',
      label: 'Nome da organização',
      maxLength: 160,
    },
    {
      name: 'sectorKind',
      type: 'select',
      label: 'Setor',
      index: true,
      options: [
        { label: 'Rural', value: 'rural' },
        { label: 'Religioso', value: 'religioso' },
        { label: 'Sindical', value: 'sindical' },
        { label: 'Empresarial', value: 'empresarial' },
        { label: 'Juventude', value: 'juventude' },
        { label: 'Saúde', value: 'saude' },
        { label: 'Educação', value: 'educacao' },
        { label: 'Cultura', value: 'cultura' },
        { label: 'Outro', value: 'outro' },
      ],
    },
    {
      name: 'tseZones',
      type: 'array',
      label: 'Zonas TSE',
      labels: {
        singular: 'Zona TSE',
        plural: 'Zonas TSE',
      },
      fields: [
        {
          name: 'zoneNumber',
          type: 'number',
          label: 'Número',
          required: true,
          min: 1,
          max: 999,
          validate: (value: unknown) =>
            typeof value === 'number' && Number.isInteger(value)
              ? true
              : 'O número da Zona TSE deve ser inteiro.',
        },
        {
          name: 'label',
          type: 'text',
          label: 'Descrição',
          maxLength: 160,
        },
      ],
    },
    {
      name: 'primaryContact',
      type: 'relationship',
      relationTo: 'contact',
      label: 'Contato principal',
      index: true,
    },
    {
      name: 'voterProfiles',
      type: 'array',
      label: 'Perfis do eleitorado',
      labels: {
        singular: 'Perfil do eleitorado',
        plural: 'Perfis do eleitorado',
      },
      fields: [
        {
          name: 'label',
          type: 'text',
          label: 'Nome do perfil',
          required: true,
          maxLength: 120,
        },
        {
          name: 'ageRange',
          type: 'text',
          label: 'Faixa etária',
          maxLength: 80,
        },
        {
          name: 'incomeBand',
          type: 'text',
          label: 'Faixa de renda',
          maxLength: 80,
        },
        {
          name: 'occupation',
          type: 'text',
          label: 'Ocupação',
          maxLength: 120,
        },
        {
          name: 'localTraits',
          type: 'textarea',
          label: 'Características locais',
          maxLength: 500,
        },
        {
          name: 'notes',
          type: 'textarea',
          label: 'Observações',
          maxLength: 1000,
        },
      ],
    },
    {
      name: 'strengths',
      type: 'array',
      label: 'Forças',
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
      name: 'confirmedVoteEstimate',
      type: 'number',
      label: 'Estimativa de votos confirmada',
      min: 0,
      index: true,
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'confirmedVoteEstimateAt',
      type: 'date',
      label: 'Estimativa confirmada em',
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'confirmedVoteEstimateBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Estimativa confirmada por',
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'confirmationNote',
      type: 'textarea',
      label: 'Justificativa da confirmação',
      maxLength: 1000,
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'proposedVoteEstimate',
      type: 'number',
      label: 'Sugestão de estimativa de votos',
      min: 0,
      index: true,
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'proposedVoteEstimateAt',
      type: 'date',
      label: 'Sugestão enviada em',
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'proposedVoteEstimateBy',
      type: 'relationship',
      relationTo: 'campaignUser',
      label: 'Sugestão enviada por',
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
    {
      name: 'proposedVoteEstimateVersion',
      type: 'text',
      label: 'Versão da sugestão de estimativa',
      index: true,
      admin: {
        readOnly: true,
      },
      access: {
        read: canReadLeadershipInternal,
        create: () => false,
        update: () => false,
      },
    },
    {
      name: 'ticketAlliance',
      type: 'group',
      label: 'Dobrada',
      fields: [
        {
          name: 'partnerName',
          type: 'text',
          label: 'Nome da parceria',
          maxLength: 120,
        },
        {
          name: 'office',
          type: 'text',
          label: 'Cargo',
          maxLength: 120,
        },
        {
          name: 'isCampaignPartner',
          type: 'checkbox',
          label: 'Parceiro da campanha',
          defaultValue: false,
        },
        {
          name: 'notes',
          type: 'textarea',
          label: 'Observações',
          maxLength: 1000,
        },
      ],
    },
    {
      name: 'lastUpdateAt',
      type: 'date',
      label: 'Última atualização',
      index: true,
      admin: {
        readOnly: true,
        description: 'Preenchido automaticamente quando o domínio de atualizações for ativado.',
      },
      access: {
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
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
        create: canSetDerivedNucleusField,
        update: canSetDerivedNucleusField,
      },
    },
  ],
}
