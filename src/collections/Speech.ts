import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { SPEECH_CLASSIFICATION_SOURCES, SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import { canReadSpeech, canUpdateSpeech, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * Speech catalog (C153) — one record per Jorge Solla speech in the Câmara,
 * with the official transcript (taquigrafia), the ASR segments with timestamps
 * (speechSegment), curated facets and extracted mentions.
 *
 * Data provenance: Câmara open data + VOD, CC BY 4.0 — keep the credit.
 * Identity is the API speech (`sourceKey`), never the regenerable VOD URL.
 */

const FACET_FIELDS = [
  'topics',
  'scopes',
  'classifiedBy',
  'mentionedMunicipalities',
  'mentionedPeople',
  'mentionedPrograms',
  'mentionedProjects',
] as const

const deriveSpeechYear: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const speechAt = typeof data.speechAt === 'string' ? data.speechAt : originalDoc?.speechAt
  const year = Number(String(speechAt ?? '').slice(0, 4))
  if (Number.isInteger(year) && year > 1900) data.year = year
  return data
}

/**
 * A manual facet correction is curation: unauthenticated writes (the import
 * CLI) never overwrite it. Authenticated admin edits stay free to change both
 * the facets and the provenance.
 */
const preserveManualFacets: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data || operation !== 'update' || originalDoc?.classifiedBy !== 'manual') return data
  if (req.user) return data

  const next = data as Record<string, unknown>
  for (const field of FACET_FIELDS) {
    if (field in next) next[field] = originalDoc[field]
  }
  return data
}

/** Segments are owned by the speech; Payload relationships do not cascade. */
const deleteSpeechSegments: CollectionBeforeDeleteHook = async ({ id, req }) => {
  await req.payload.delete({
    collection: 'speechSegment',
    where: { speech: { equals: id } },
    req,
    // Intentional bypass: the cascade is owned by this hook; segment access is
    // admin-only and this runs inside the authorized speech delete request.
    overrideAccess: true,
  })
}

export const Speech: CollectionConfig = {
  slug: 'speech',
  labels: {
    singular: 'Discurso',
    plural: 'Discursos',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'speechAt',
    defaultColumns: ['speechAt', 'type', 'phase', 'topics', 'classifiedBy'],
    description:
      'Acervo de falas do deputado na Câmara. Dados e vídeos da Câmara dos Deputados (CC BY 4.0).',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadSpeech,
    update: canUpdateSpeech,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [deriveSpeechYear],
    beforeChange: [preserveManualFacets],
    beforeDelete: [deleteSpeechSegments],
  },
  fields: [
    {
      name: 'sourceKey',
      type: 'text',
      label: 'Chave da fonte',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Identidade da fala na API da Câmara (data/hora + tipo + fase).',
      },
    },
    {
      // Wall-clock time of the source (Brasília local, no timezone). Kept as
      // text on purpose: the Câmara API has no timezone and pretending it is an
      // instant would shift old DST dates.
      name: 'speechAt',
      type: 'text',
      label: 'Data e hora',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Horário local de Brasília, como publicado pela Câmara.',
      },
    },
    {
      name: 'year',
      type: 'number',
      label: 'Ano',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'legislature',
      type: 'select',
      label: 'Legislatura',
      index: true,
      options: [
        { label: '54ª', value: '54' },
        { label: '55ª', value: '55' },
        { label: '56ª', value: '56' },
        { label: '57ª', value: '57' },
      ],
    },
    {
      name: 'type',
      type: 'text',
      label: 'Tipo de discurso',
      admin: { readOnly: true },
    },
    {
      name: 'phase',
      type: 'text',
      label: 'Fase da sessão',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'Duração (s)',
      admin: { readOnly: true },
    },
    {
      name: 'summary',
      type: 'textarea',
      label: 'Sumário oficial',
      admin: { readOnly: true },
    },
    {
      name: 'officialTranscript',
      type: 'textarea',
      label: 'Transcrição oficial',
      admin: { readOnly: true },
    },
    {
      name: 'officialTextUrl',
      type: 'text',
      label: 'Texto oficial (Diário)',
      admin: { readOnly: true },
    },
    {
      name: 'keywords',
      type: 'text',
      label: 'Palavras-chave oficiais',
      hasMany: true,
      admin: {
        readOnly: true,
        description: 'Preservadas cruas; as facetas não as substituem.',
      },
    },
    {
      name: 'eventId',
      type: 'number',
      label: 'Evento',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'eventType',
      type: 'text',
      label: 'Tipo de sessão',
      admin: { readOnly: true },
    },
    {
      name: 'eventStartAt',
      type: 'text',
      label: 'Início da sessão',
      admin: { readOnly: true },
    },
    {
      name: 'eventEndAt',
      type: 'text',
      label: 'Fim da sessão',
      admin: { readOnly: true },
    },
    {
      name: 'youtubeUrl',
      type: 'text',
      label: 'YouTube da sessão',
      admin: { readOnly: true },
    },
    {
      name: 'presidingOfficer',
      type: 'text',
      label: 'Quem presidia',
      admin: {
        readOnly: true,
        description: 'Derivado das trocas de mesa da sessão; vazio quando não há registro.',
      },
    },
    {
      name: 'audioId',
      type: 'number',
      label: 'Áudio',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'excerptTMs',
      type: 'number',
      label: 'Início do trecho (ms)',
      index: true,
      admin: { readOnly: true },
    },
    {
      name: 'vodPlaybackUrl',
      type: 'text',
      label: 'VOD (reproduzir)',
      admin: { readOnly: true, description: 'Último link conhecido; regerável pelo VOD.' },
    },
    {
      name: 'vodDownloadUrl',
      type: 'text',
      label: 'VOD (baixar)',
      admin: { readOnly: true, description: 'Último link conhecido; regerável pelo VOD.' },
    },
    {
      name: 'topics',
      type: 'select',
      label: 'Temas',
      hasMany: true,
      index: true,
      options: SPEECH_TOPICS.map(({ value, label }) => ({ value, label })),
    },
    {
      name: 'scopes',
      type: 'select',
      label: 'Alcance',
      hasMany: true,
      index: true,
      options: SPEECH_SCOPES.map(({ value, label }) => ({ value, label })),
    },
    {
      name: 'classifiedBy',
      type: 'select',
      label: 'Proveniência da classificação',
      required: true,
      defaultValue: 'gazetteer',
      index: true,
      options: SPEECH_CLASSIFICATION_SOURCES.map((value) => ({
        value,
        label: value === 'gazetteer' ? 'Gazetteer' : value === 'llm' ? 'LLM' : 'Manual',
      })),
    },
    {
      name: 'mentionedMunicipalities',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Municípios citados',
      hasMany: true,
      index: true,
    },
    {
      name: 'mentionedPeople',
      type: 'text',
      label: 'Pessoas citadas',
      hasMany: true,
      admin: { description: 'Menções textuais — não é cadastro de contatos.' },
    },
    {
      name: 'mentionedPrograms',
      type: 'text',
      label: 'Programas citados',
      hasMany: true,
    },
    {
      name: 'mentionedProjects',
      type: 'text',
      label: 'Projetos citados',
      hasMany: true,
    },
  ],
}
