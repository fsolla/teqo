import type {
  CollectionAfterChangeHook,
  CollectionAfterDeleteHook,
  CollectionBeforeChangeHook,
  CollectionBeforeValidateHook,
  CollectionConfig,
} from 'payload'

import {
  CONTENT_MEDIA_SLUG,
  CONTENT_PIECE_CURATED_FIELDS,
  CONTENT_PIECE_DESCRIPTION_MAX_LENGTH,
  CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
  CONTENT_PIECE_LEADERS_MAX,
  CONTENT_PIECE_LINK_FAILURE_REASONS,
  CONTENT_PIECE_ORIGINS,
  CONTENT_PIECE_PROCESSING_STATUSES,
  CONTENT_PIECE_PUBLIC_FIGURES_MAX,
  CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH,
  CONTENT_PIECE_STATUSES,
  CONTENT_PIECE_STEPS,
  CONTENT_PIECE_TITLE_MAX_LENGTH,
  CONTENT_PIECE_TYPES,
  contentPieceCuratedFieldLabels,
  contentPieceLinkFailureReasonLabels,
  contentPieceOriginLabels,
  contentPieceProcessingStatusLabels,
  contentPieceSearchText,
  contentPieceSlugCandidates,
  contentPieceStatusLabels,
  contentPieceStepLabels,
  contentPieceTypeLabels,
} from '@/lib/contentPiece'
import { normalizeContentPiecePublicFigures } from '@/lib/publicFigureCatalog'
import { uniqueRelationshipIds } from '@/lib/relationship'
import { SPEECH_TOPICS } from '@/lib/speechFacets'
import { TRANSCRIPT_TEXT_MAX_LENGTH } from '@/lib/speechSearch'
import {
  canCreateContentPiece,
  canDeleteContentPiece,
  canReadContentPiece,
  canSetCampaignSystemField,
  canUpdateContentPiece,
} from '@/utilities/campaignAccess'
import { stampCampaignCreatedBy, systemStampedActorField } from '@/utilities/campaignAuditFields'
import { resolveContentPieceLeaderNames } from '@/utilities/content/contentPieceLeaderOptions'
import { revalidateContentPiecesListing } from '@/utilities/documents'
import { acquireTextAdvisoryLocks } from '@/utilities/postgresTransactionLocks'

/**
 * C211 — one campaign content piece ("peça") of the internal Central: the
 * catalogued material (uploaded file or Instagram/YouTube link) that the public
 * Central (S27) publishes. `processingStatus`/`step`/`error` are the honest
 * states of the transcription/cataloguing pipeline; `status` is the editorial
 * kill switch (rascunho → publicado) and never deletes the file. `media` is the
 * private upload, served only through the authenticated route under
 * `/campanha`; `curatedFields` records what the assessoria edited, so the
 * pipeline never overwrites a human decision (D6).
 */

const TYPE_OPTIONS = CONTENT_PIECE_TYPES.map((value) => ({
  value,
  label: contentPieceTypeLabels[value],
}))
const STATUS_OPTIONS = CONTENT_PIECE_STATUSES.map((value) => ({
  value,
  label: contentPieceStatusLabels[value],
}))
const PROCESSING_STATUS_OPTIONS = CONTENT_PIECE_PROCESSING_STATUSES.map((value) => ({
  value,
  label: contentPieceProcessingStatusLabels[value],
}))
const STEP_OPTIONS = CONTENT_PIECE_STEPS.map((value) => ({
  value,
  label: contentPieceStepLabels[value],
}))
const ORIGIN_OPTIONS = CONTENT_PIECE_ORIGINS.map((value) => ({
  value,
  label: contentPieceOriginLabels[value],
}))
const LINK_FAILURE_REASON_OPTIONS = CONTENT_PIECE_LINK_FAILURE_REASONS.map((value) => ({
  value,
  label: contentPieceLinkFailureReasonLabels[value],
}))

/**
 * The one seam with the public Central (S27): every write of a piece — the
 * pipeline's cataloguing, the ficha, the kill switch — busts the listing tag
 * the public surface caches under. A collection hook and not a per-caller line,
 * so a new write path cannot forget it.
 */
const revalidateContentPieceListing: CollectionAfterChangeHook = ({ doc }) => {
  revalidateContentPiecesListing()
  return doc
}

/**
 * C222 — the other half of the S27 seam: a deleted piece must leave the public
 * listing tag too, or the public Central would keep serving a ghost from a
 * cache with no TTL. Hook, not a per-caller line, so the admin delete and any
 * future path cannot forget it (same reason as the `afterChange` above).
 */
const revalidateContentPieceListingAfterDelete: CollectionAfterDeleteHook = ({ doc }) => {
  revalidateContentPiecesListing()
  return doc
}

/** Stamps `publishedAt` on every transition into `publicado` (create included). */
const stampContentPiecePublishedAt: CollectionBeforeChangeHook = ({
  data,
  operation,
  originalDoc,
}) => {
  if (
    data.status === 'publicado' &&
    (operation === 'create' || originalDoc?.status !== 'publicado')
  ) {
    data.publishedAt = new Date().toISOString()
  }
  return data
}

/**
 * D7 — the public slug is generated on the FIRST transition into `publicado`,
 * from the title in force, and never changes after that: a draft has no slug,
 * and unpublishing preserves it (the link already shared keeps working). The
 * probe runs under a text advisory lock so two pieces published with the same
 * title cannot race the unique constraint; the candidates add `-2`, `-3`…
 * inside the caller's transaction (the publish action always provides one).
 */
const setCanonicalContentPieceSlug: CollectionBeforeChangeHook = async ({
  data,
  operation,
  originalDoc,
  req,
}) => {
  if (!data) return data
  const enteringPublished =
    data.status === 'publicado' && (operation === 'create' || originalDoc?.status !== 'publicado')
  if (!enteringPublished || originalDoc?.slug) return data

  const title = data.title ?? originalDoc?.title ?? ''
  const candidates = contentPieceSlugCandidates(title)
  await acquireTextAdvisoryLocks(req.payload, req, [`content-piece-slug:${candidates[0]}`])

  // Intentional admin bypass: the slug probe must see every piece, including
  // drafts the publishing actor cannot read.
  const existing = await req.payload.find({
    collection: 'contentPiece',
    where: { slug: { in: candidates } },
    depth: 0,
    limit: 0,
    pagination: false,
    select: { slug: true },
    overrideAccess: true,
    req,
  })
  const taken = new Set(existing.docs.map((doc) => doc.slug))
  const free = candidates.find((candidate) => !taken.has(candidate))
  if (free) data.slug = free
  return data
}

/**
 * Denormalized catalogue index: `cityLabel`/`region` mirror the related
 * município (a static, read-only catalog) and `searchText` is the normalized
 * haystack the list search matches — the same shape C199 persists on a
 * recording. The município is only read when the relation was TOUCHED: every
 * partial update (status, step, error, the job's heartbeats) reuses the stored
 * `cityLabel`/`region` instead of paying a query per save.
 */
const deriveContentPieceCatalogIndex: CollectionBeforeValidateHook = async ({
  data,
  originalDoc,
  req,
}) => {
  if (!data) return data

  const relationTouched = data.municipality !== undefined
  const municipalityValue = relationTouched ? data.municipality : originalDoc?.municipality
  const municipalityId =
    typeof municipalityValue === 'number'
      ? municipalityValue
      : typeof municipalityValue === 'object' && municipalityValue !== null
        ? municipalityValue.id
        : null

  let cityLabel = originalDoc?.cityLabel ?? null
  let region = originalDoc?.region ?? null
  if (relationTouched) {
    cityLabel = null
    region = null
    if (municipalityId !== null) {
      const municipality = await req.payload
        .findByID({
          collection: 'municipality',
          id: municipalityId,
          depth: 0,
          select: { name: true, region: true },
          // Intentional admin bypass: the município catalog is read-only geography.
          overrideAccess: true,
          req,
        })
        .catch(() => null)
      cityLabel = municipality?.name ?? null
      region = municipality?.region ?? null
    }
  }

  data.cityLabel = cityLabel
  data.region = region

  // S37 — "who appears in the piece". The leader snapshot is recomputed only
  // when the relation was TOUCHED (the ficha always sends the list, an empty
  // one clearing it); a partial update keeps the stored names. The public
  // figures are canonicalized against the catalog on every write, so any path
  // (ficha, admin, direct update) stores the same spelling.
  if (data.leaders !== undefined) {
    data.leaderNames = await resolveContentPieceLeaderNames(
      req.payload,
      req,
      uniqueRelationshipIds(data.leaders),
    )
  }
  if (data.publicFigures !== undefined) {
    data.publicFigures = normalizeContentPiecePublicFigures(data.publicFigures ?? [])
  }

  data.searchText = contentPieceSearchText({
    title: data.title ?? originalDoc?.title,
    description: data.description ?? originalDoc?.description,
    transcript: data.transcript ?? originalDoc?.transcript,
    institution: data.institution ?? originalDoc?.institution,
    topics: data.topics ?? originalDoc?.topics,
    cityLabel,
    leaderNames: data.leaderNames ?? originalDoc?.leaderNames,
    publicFigures: data.publicFigures ?? originalDoc?.publicFigures,
  })
  return data
}

export const ContentPiece: CollectionConfig = {
  slug: 'contentPiece',
  labels: {
    singular: 'Peça',
    plural: 'Peças',
  },
  admin: {
    group: 'Comunicação',
    useAsTitle: 'title',
    defaultColumns: ['title', 'type', 'processingStatus', 'status', 'pieceDate'],
    description:
      'Peças de campanha da Central de Conteúdos. O arquivo é privado; "Rascunho" não aparece na Central pública.',
  },
  access: {
    create: canCreateContentPiece,
    read: canReadContentPiece,
    update: canUpdateContentPiece,
    // C211 kept no delete surface in the Central; C222 reopens that anti-goal
    // on purpose: the same vertical that writes publishes can now remove a
    // piece for good, warned by the confirmation dialog. The admin keeps it.
    delete: canDeleteContentPiece,
  },
  hooks: {
    beforeValidate: [deriveContentPieceCatalogIndex],
    beforeChange: [
      setCanonicalContentPieceSlug,
      stampContentPiecePublishedAt,
      stampCampaignCreatedBy,
    ],
    afterChange: [revalidateContentPieceListing],
    afterDelete: [revalidateContentPieceListingAfterDelete],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      label: 'Título',
      required: true,
      maxLength: CONTENT_PIECE_TITLE_MAX_LENGTH,
    },
    {
      name: 'slug',
      type: 'text',
      label: 'Endereço na Central pública',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          'Gerado no primeiro "Publicar" a partir do título e imutável depois. Despublicar não apaga o endereço.',
      },
    },
    {
      name: 'type',
      type: 'select',
      label: 'Tipo',
      required: true,
      index: true,
      options: TYPE_OPTIONS,
      admin: {
        description: 'Derivado do arquivo no envio; a assessoria pode ajustar (ex.: card).',
      },
    },
    {
      name: 'description',
      type: 'textarea',
      label: 'Descrição',
      maxLength: CONTENT_PIECE_DESCRIPTION_MAX_LENGTH,
    },
    {
      name: 'topics',
      type: 'select',
      label: 'Temas',
      hasMany: true,
      index: true,
      options: SPEECH_TOPICS.map((topic) => ({ value: topic.value, label: topic.label })),
    },
    {
      name: 'municipality',
      type: 'relationship',
      relationTo: 'municipality',
      label: 'Cidade',
      index: true,
      admin: {
        description: 'Município da campanha relacionado à peça (opcional).',
      },
    },
    {
      name: 'cityLabel',
      type: 'text',
      label: 'Cidade (busca)',
      admin: {
        readOnly: true,
        description: 'Derivado do município relacionado.',
      },
    },
    {
      name: 'region',
      type: 'text',
      label: 'Região',
      admin: {
        readOnly: true,
        description: 'Território de identidade derivado do município.',
      },
    },
    {
      name: 'institution',
      type: 'text',
      label: 'Instituição',
      maxLength: CONTENT_PIECE_INSTITUTION_MAX_LENGTH,
    },
    {
      name: 'leaders',
      type: 'relationship',
      relationTo: 'leadership',
      hasMany: true,
      label: 'Lideranças da campanha',
      maxRows: CONTENT_PIECE_LEADERS_MAX,
      admin: {
        description:
          'Quem aparece na peça entre as lideranças já registradas. À Central pública vai apenas o nome.',
      },
    },
    {
      name: 'leaderNames',
      type: 'text',
      hasMany: true,
      label: 'Nomes para a Central pública',
      admin: {
        readOnly: true,
        description: 'Derivado das lideranças marcadas; é o que a faceta pública mostra.',
      },
    },
    {
      name: 'publicFigures',
      type: 'text',
      hasMany: true,
      label: 'Figuras públicas',
      maxRows: CONTENT_PIECE_PUBLIC_FIGURES_MAX,
      maxLength: CONTENT_PIECE_PUBLIC_FIGURE_MAX_LENGTH,
      admin: {
        description:
          'Dobradinhas/estaduais do catálogo e outras personalidades; a grafia é canonicalizada ao salvar.',
      },
    },
    {
      name: 'pieceDate',
      type: 'date',
      label: 'Data da peça',
      index: true,
    },
    {
      name: 'durationSeconds',
      type: 'number',
      label: 'Duração (s)',
      admin: {
        readOnly: true,
        description: 'Medida pelo provedor de transcrição; nunca estimada.',
      },
    },
    {
      name: 'transcript',
      type: 'textarea',
      label: 'Transcrição / texto',
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
      admin: {
        description: 'Transcrição do áudio/vídeo ou texto extraído. Editável pela assessoria.',
      },
    },
    {
      name: 'media',
      type: 'upload',
      relationTo: CONTENT_MEDIA_SLUG,
      label: 'Arquivo da peça',
      admin: {
        readOnly: true,
        description: 'O arquivo privado; publicado, é o que a Central pública serve.',
      },
    },
    {
      name: 'sourceUrl',
      type: 'text',
      label: 'Link de origem',
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        description: 'Link canônico do Instagram/YouTube quando a peça entrou por link.',
      },
    },
    {
      name: 'origin',
      type: 'select',
      label: 'Origem',
      required: true,
      defaultValue: 'arquivo',
      options: ORIGIN_OPTIONS,
    },
    {
      name: 'status',
      type: 'select',
      label: 'Publicação',
      required: true,
      defaultValue: 'rascunho',
      index: true,
      options: STATUS_OPTIONS,
      admin: {
        description: 'Despublicar tira a peça da Central pública na hora e preserva o arquivo.',
      },
    },
    {
      name: 'publishedAt',
      type: 'date',
      label: 'Publicado em',
      admin: { readOnly: true },
    },
    {
      name: 'processingStatus',
      type: 'select',
      label: 'Processamento',
      required: true,
      defaultValue: 'pronto',
      index: true,
      options: PROCESSING_STATUS_OPTIONS,
    },
    {
      name: 'step',
      type: 'select',
      label: 'Passo',
      options: STEP_OPTIONS,
      admin: {
        readOnly: true,
        description: 'Progresso honesto do processamento em andamento.',
      },
    },
    {
      name: 'error',
      type: 'textarea',
      label: 'Erro',
      admin: {
        readOnly: true,
        description: 'Motivo interno da falha; nunca vai à pessoa com o detalhe cru.',
      },
    },
    {
      name: 'linkFailureReason',
      type: 'select',
      label: 'Motivo da peça-link',
      options: LINK_FAILURE_REASON_OPTIONS,
      admin: {
        readOnly: true,
        description:
          'Por que uma peça do Instagram ficou só como link; preenchido pelo processamento.',
      },
    },
    {
      name: 'searchText',
      type: 'textarea',
      label: 'Texto normalizado (busca)',
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
      admin: {
        readOnly: true,
        description:
          'Título, descrição, transcrição, temas, cidade e instituição normalizados (sem acentos, minúsculas).',
      },
    },
    {
      name: 'curatedFields',
      type: 'select',
      label: 'Campos curados pela assessoria',
      hasMany: true,
      options: CONTENT_PIECE_CURATED_FIELDS.map((value) => ({
        value,
        label: contentPieceCuratedFieldLabels[value],
      })),
      admin: {
        readOnly: true,
        description:
          'O que a assessoria já editou; a catalogação automática nunca sobrescreve estes campos.',
      },
    },
    systemStampedActorField({ setAccess: canSetCampaignSystemField }),
  ],
}
