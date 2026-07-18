import type { CollectionConfig } from 'payload'

import { canMutateElectionData, canReadElectionData } from '@/utilities/campaignAccess'

import { ELECTION_OFFICE_OPTIONS, ELECTION_TURN_OPTIONS } from '@/lib/electionResults'

const slug = 'electionTally'

export const ElectionTally: CollectionConfig<typeof slug> = {
  slug,
  labels: {
    singular: 'Apuração eleitoral',
    plural: 'Apurações eleitorais',
  },
  admin: {
    group: 'Dados Eleitorais',
    useAsTitle: 'cityName',
    defaultColumns: ['year', 'office', 'turn', 'cityName', 'zoneNumber', 'updatedAt'],
    description: 'Totais oficiais TSE por município e zona (dado público).',
  },
  access: {
    create: canMutateElectionData,
    read: canReadElectionData,
    update: canMutateElectionData,
    delete: canMutateElectionData,
  },
  indexes: [
    {
      fields: ['year', 'office', 'turn', 'state', 'cityCode', 'zoneNumber'],
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
      name: 'aptos',
      type: 'number',
      label: 'Eleitores aptos',
      required: true,
      min: 0,
    },
    {
      name: 'comparecimento',
      type: 'number',
      label: 'Comparecimento',
      required: true,
      min: 0,
    },
    {
      name: 'abstencoes',
      type: 'number',
      label: 'Abstenções',
      required: true,
      min: 0,
    },
    {
      name: 'votosValidos',
      type: 'number',
      label: 'Votos válidos',
      required: true,
      min: 0,
    },
    {
      name: 'votosNominaisValidos',
      type: 'number',
      label: 'Votos nominais válidos',
      required: true,
      min: 0,
    },
    {
      name: 'votosLegenda',
      type: 'number',
      label: 'Votos de legenda',
      required: true,
      min: 0,
    },
    {
      name: 'votosBranco',
      type: 'number',
      label: 'Votos em branco',
      required: true,
      min: 0,
    },
    {
      name: 'votosNulo',
      type: 'number',
      label: 'Votos nulos',
      required: true,
      min: 0,
    },
    {
      name: 'votosAnulados',
      type: 'number',
      label: 'Votos anulados',
      required: true,
      min: 0,
      defaultValue: 0,
    },
    {
      name: 'winnerCandidateNumber',
      type: 'number',
      label: 'Número do mais votado',
      min: 0,
    },
    {
      name: 'winnerCandidateName',
      type: 'text',
      label: 'Nome do mais votado',
      maxLength: 160,
    },
    {
      name: 'winnerVotes',
      type: 'number',
      label: 'Votos do mais votado',
      min: 0,
    },
    {
      name: 'winnerCoalition',
      type: 'text',
      label: 'Coligação do mais votado',
      maxLength: 240,
    },
    {
      name: 'winnerParty',
      type: 'text',
      label: 'Partido do mais votado',
      maxLength: 40,
    },
  ],
}
