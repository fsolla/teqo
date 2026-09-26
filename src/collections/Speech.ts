import type {
  CollectionBeforeChangeHook,
  CollectionBeforeDeleteHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import { SPEECH_CLASSIFICATION_SOURCES, SPEECH_SCOPES, SPEECH_TOPICS } from '@/lib/speechFacets'
import { TRANSCRIPT_TEXT_MAX_LENGTH } from '@/lib/speechSearch'
import { INTERNET_SPEECH_MEDIA_SLUG, WEB_SPEECH_PLATFORMS } from '@/lib/webSpeech'
import { canReadSpeech, canUpdateSpeech, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * Speech catalog (C153) — one record per Jorge Solla speech: the Câmara
 * speeches with the official transcript (taquigrafia), ASR segments with
 * timestamps (speechSegment), curated facets and extracted mentions, plus the
 * web speeches (C215) mirrored from the internet with the same facets and
 * segments.
 *
 * Câmara data provenance: open data + VOD, CC BY 4.0 — keep the credit. Web
 * rows carry their own origin (platform + URL) and a private mirrored file.
 * Identity is the source (`sourceKey`): the Câmara API speech or the web
 * namespace (`web:<platform>:<externalId|url>`), never a regenerable URL.
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

/** Speech assets are owned by the speech; Payload relationships do not cascade. */
const deleteSpeechAssets: CollectionBeforeDeleteHook = async ({ id, req }) => {
  const speech = await req.payload.findByID({
    collection: 'speech',
    id,
    depth: 0,
    select: { mirroredMedia: true, thumbnail: true },
    req,
    // Intentional bypass: the cascade is owned by this hook; media access is the
    // acervo gate and this runs inside the authorized speech delete request.
    overrideAccess: true,
  })
  const mediaIds = [speech?.mirroredMedia, speech?.thumbnail]
    .map((media) => (typeof media === 'object' && media !== null ? media.id : media))
    .filter((mediaId): mediaId is number => typeof mediaId === 'number')

  // C229 — the semantic index is derived; deleting the speech deletes its rows
  // first (the relationship FK cannot SET NULL over a NOT NULL column).
  await req.payload.delete({
    collection: 'speechEmbedding',
    where: { speech: { equals: id } },
    req,
    // Intentional bypass: same cascade over derived vectors.
    overrideAccess: true,
  })
  await req.payload.delete({
    collection: 'speechSegment',
    where: { speech: { equals: id } },
    req,
    // Intentional bypass: the cascade is owned by this hook; segment access is
    // admin-only and this runs inside the authorized speech delete request.
    overrideAccess: true,
  })
  if (mediaIds.length > 0) {
    await req.payload.delete({
      collection: INTERNET_SPEECH_MEDIA_SLUG,
      where: { id: { in: mediaIds } },
      req,
      // Intentional bypass: same cascade, now over the private mirrored files.
      overrideAccess: true,
    })
  }
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
    defaultColumns: ['speechAt', 'origin', 'platform', 'type', 'topics', 'classifiedBy'],
    description:
      'Acervo de falas do deputado: discursos na Câmara (CC BY 4.0) e falas publicadas na internet (mídia espelhada privada).',
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
    beforeDelete: [deleteSpeechAssets],
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
        description: 'Identidade da fala: API da Câmara ou web:<plataforma>:<id|url>.',
      },
    },
    {
      // C215 — discriminator of the catalog source. The Câmara surfaces filter
      // `camara`; the web source is served by C216 with its own list contract.
      name: 'origin',
      type: 'select',
      label: 'Origem',
      required: true,
      defaultValue: 'camara',
      index: true,
      options: [
        { label: 'Câmara', value: 'camara' },
        { label: 'Internet', value: 'web' },
      ],
      admin: {
        description: 'Discurso da Câmara ou fala publicada na internet.',
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
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
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
      // C154 — normalized concatenation of the segment texts, so the acervo
      // search paginates by SPEECH (the unit the UI shows) with the Payload
      // access layer in the path. Kept in sync by `upsertSpeechBundle` (the
      // only writer of segments); the GIN trigram index is hand-written.
      name: 'searchText',
      type: 'textarea',
      label: 'Texto normalizado (busca)',
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
      // Optional on purpose: a speech without ASR segments legitimately has no
      // search text, and Payload's `required` rejects the empty string.
      defaultValue: '',
      admin: {
        readOnly: true,
        description: 'Concatenação normalizada dos segmentos (sem acentos); mantida pelo import.',
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
    // C215 — web speech origin and mirrored assets (null on Câmara rows).
    {
      name: 'platform',
      type: 'select',
      label: 'Plataforma',
      index: true,
      options: WEB_SPEECH_PLATFORMS.map(({ value, label }) => ({ value, label })),
      admin: {
        description: 'Plataforma de origem da fala da internet.',
      },
    },
    {
      name: 'externalId',
      type: 'text',
      label: 'Id externo',
      admin: {
        readOnly: true,
        description: 'Identificador da publicação na plataforma (quando houver).',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'URL de origem',
      admin: {
        readOnly: true,
        description: 'Link canônico da publicação original.',
      },
    },
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      admin: {
        description: 'Título da publicação na plataforma.',
      },
    },
    {
      name: 'channel',
      type: 'text',
      label: 'Canal/autor',
      admin: {
        description: 'Quem publicou (canal, rádio, perfil) — texto de origem, não é contato.',
      },
    },
    {
      name: 'mirroredMedia',
      type: 'upload',
      relationTo: INTERNET_SPEECH_MEDIA_SLUG,
      label: 'Mídia espelhada',
      admin: {
        readOnly: true,
        description: 'Arquivo privado preservado para player, download e cortes.',
      },
    },
    {
      name: 'thumbnail',
      type: 'upload',
      relationTo: INTERNET_SPEECH_MEDIA_SLUG,
      label: 'Capa',
      admin: {
        readOnly: true,
        description: 'Capa da origem quando capturada; sem ela a lista mostra placeholder.',
      },
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
