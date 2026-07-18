import type { CollectionConfig } from 'payload'

import { canMutateElectionData, canReadElectionData } from '@/utilities/campaignAccess'

import {
  ELECTION_ELECTED_BY_OPTIONS,
  ELECTION_OFFICE_OPTIONS,
  ELECTION_RUNNING_AGAIN_OPTIONS,
  ELECTION_TURN_OPTIONS,
} from '@/lib/electionResults'

const slug = 'electionCandidate'

export const ElectionCandidate: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Candidato eleitoral',
    plural: 'Candidatos eleitorais',
  },
  admin: {
    group: 'Dados Eleitorais',
    useAsTitle: 'urnaName',
    defaultColumns: [
      'year',
      'office',
      'candidateNumber',
      'urnaName',
      'party',
      'elected',
      'updatedAt',
    ],
    description: 'Registro de candidatura TSE (dado público).',
  },
  access: {
    create: canMutateElectionData,
    read: canReadElectionData,
    update: canMutateElectionData,
    delete: canMutateElectionData,
  },
  indexes: [
    {
      fields: ['year', 'office', 'turn', 'state', 'candidateNumber'],
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
      name: 'candidateNumber',
      type: 'number',
      label: 'Número do candidato',
      required: true,
      index: true,
      min: 0,
    },
    {
      name: 'urnaName',
      type: 'text',
      label: 'Nome na urna',
      required: true,
      maxLength: 160,
    },
    {
      name: 'completeName',
      type: 'text',
      label: 'Nome completo',
      maxLength: 200,
    },
    {
      name: 'party',
      type: 'text',
      label: 'Partido',
      maxLength: 40,
    },
    {
      name: 'coalition',
      type: 'text',
      label: 'Coligação',
      maxLength: 240,
    },
    {
      name: 'candidateStatus',
      type: 'text',
      label: 'Situação da candidatura',
      maxLength: 80,
    },
    {
      name: 'elected',
      type: 'checkbox',
      label: 'Eleito',
      defaultValue: false,
      index: true,
    },
    {
      name: 'electedBy',
      type: 'select',
      label: 'Forma de eleição',
      options: [...ELECTION_ELECTED_BY_OPTIONS],
    },
    {
      name: 'totalVotesState',
      type: 'number',
      label: 'Total de votos no estado',
      min: 0,
    },
    {
      name: 'identityKey',
      type: 'text',
      label: 'Chave de identidade cross-ano',
      index: true,
      maxLength: 64,
      admin: {
        description: 'sha256(nome urna + naturalidade + partido); só dados públicos.',
        readOnly: true,
      },
    },
    {
      name: 'runningAgain2026',
      type: 'select',
      label: 'Concorre de novo em 2026',
      required: true,
      defaultValue: 'desconhecido',
      options: [...ELECTION_RUNNING_AGAIN_OPTIONS],
    },
  ],
}
