import type { CollectionConfig } from 'payload'

import { canMutateElectionData, canReadElectionData } from '@/utilities/campaignAccess'

import {
  ELECTION_OFFICE_OPTIONS,
  ELECTION_TURN_OPTIONS,
  ELECTION_VOTE_TYPE_OPTIONS,
} from '@/lib/electionResults'

const slug = 'electionCandidateVote'

export const ElectionCandidateVote: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Voto por candidato',
    plural: 'Votos por candidato',
  },
  admin: {
    group: 'Dados Eleitorais',
    useAsTitle: 'candidateName',
    defaultColumns: [
      'year',
      'office',
      'cityName',
      'zoneNumber',
      'candidateNumber',
      'votes',
      'updatedAt',
    ],
    description: 'Votos nominais oficiais TSE por município e zona (dado público).',
  },
  access: {
    create: canMutateElectionData,
    read: canReadElectionData,
    update: canMutateElectionData,
    delete: canMutateElectionData,
  },
  indexes: [
    {
      fields: [
        'year',
        'office',
        'turn',
        'state',
        'cityCode',
        'zoneNumber',
        'candidateNumber',
        'voteType',
      ],
      unique: true,
    },
  ],
  fields: [
    {
      name: 'year',
      type: 'number',
      label: 'Ano',
      required: true,
      index: true,
      min: 2000,
      max: 2100,
    },
    {
      name: 'office',
      type: 'select',
      label: 'Cargo',
      required: true,
      index: true,
      options: [...ELECTION_OFFICE_OPTIONS],
    },
    {
      name: 'turn',
      type: 'select',
      label: 'Turno',
      required: true,
      index: true,
      options: [...ELECTION_TURN_OPTIONS],
    },
    {
      name: 'state',
      type: 'text',
      label: 'UF',
      required: true,
      defaultValue: 'BA',
      maxLength: 2,
      index: true,
    },
    {
      name: 'cityCode',
      type: 'text',
      label: 'Código do município (TSE)',
      required: true,
      index: true,
      maxLength: 16,
    },
    {
      name: 'cityName',
      type: 'text',
      label: 'Município',
      required: true,
      index: true,
      maxLength: 120,
    },
    {
      name: 'zoneNumber',
      type: 'number',
      label: 'Zona TSE',
      required: true,
      index: true,
      min: 1,
      max: 999,
    },
    {
      name: 'candidateNumber',
      type: 'number',
      label: 'Número do candidato',
      required: true,
      index: true,
      min: 0,
    },
    {
      name: 'candidateName',
      type: 'text',
      label: 'Nome na urna',
      required: true,
      maxLength: 160,
    },
    {
      name: 'coalition',
      type: 'text',
      label: 'Coligação',
      maxLength: 240,
    },
    {
      name: 'party',
      type: 'text',
      label: 'Partido',
      maxLength: 40,
    },
    {
      name: 'voteType',
      type: 'select',
      label: 'Tipo de voto',
      required: true,
      index: true,
      defaultValue: 'nominal',
      options: [...ELECTION_VOTE_TYPE_OPTIONS],
    },
    {
      name: 'votes',
      type: 'number',
      label: 'Votos',
      required: true,
      min: 1,
    },
  ],
}
