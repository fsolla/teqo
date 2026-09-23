import type { CollectionConfig } from 'payload'

import {
  CONTENT_EVENT_SUBJECT_TYPES,
  CONTENT_EVENT_TYPES,
  contentEventSubjectTypeLabels,
  contentEventTypeLabels,
} from '@/lib/contentEvents'
import { payloadAdminOnly } from '@/utilities/access/shared'
import { canReadContentPiece } from '@/utilities/campaignAccess'

/**
 * C213 — one anonymous engagement event of the Central de Conteúdos (and, by
 * S32, of the personalized cards: the card is another `subjectType` of this
 * same mechanism, never a second collection).
 *
 * The row carries the event type and the subject — `subjectType` + `subjectId`
 * (the internal piece id; the card model id) — plus the optional `variant`
 * (S32: the state-deputy slug chosen on the team/colinha card models), and
 * nothing else: no IP, no cookie, no user-agent, no session, no visitor
 * identity. Counting is best-effort (fail-soft): the public page, the download
 * and the share never depend on a row landing here.
 *
 * There is deliberately NO hook: a write here must never bust the public
 * `contentPieces` listing tag (a counter is not content). Rows are written only
 * through the Local API with an intentional admin bypass
 * (`overrideAccess: true`) — the public `POST /api/content-events` (validated,
 * same-origin, rate-limited) and the public media route's `?download=1` — so no
 * access predicate grants a create.
 * Hidden from the admin nav: the surface is the Central list, not a dashboard.
 */
export const ContentEvent: CollectionConfig = {
  slug: 'contentEvent',
  labels: {
    singular: 'Evento de conteúdo',
    plural: 'Eventos de conteúdo',
  },
  admin: {
    group: 'Comunicação',
    hidden: () => true,
    useAsTitle: 'type',
    defaultColumns: ['type', 'subjectType', 'subjectId', 'createdAt'],
    description: 'Eventos anônimos de circulação (abertura, download, compartilhamento).',
  },
  access: {
    create: () => false,
    read: canReadContentPiece,
    update: () => false,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'type',
      type: 'select',
      label: 'Evento',
      required: true,
      options: CONTENT_EVENT_TYPES.map((value) => ({
        value,
        label: contentEventTypeLabels[value],
      })),
    },
    {
      name: 'subjectType',
      type: 'select',
      label: 'Assunto',
      required: true,
      options: CONTENT_EVENT_SUBJECT_TYPES.map((value) => ({
        value,
        label: contentEventSubjectTypeLabels[value],
      })),
    },
    {
      name: 'subjectId',
      type: 'text',
      label: 'Chave do assunto',
      required: true,
      admin: {
        description:
          'Id interno da peça (peça) ou do modelo (card). Nunca um identificador de visitante.',
      },
    },
    {
      // S32 — the sub-key of the subject, when it has one: the state-deputy
      // slug chosen on the team/colinha card models. It is a public catalog
      // slug, never a visitor identifier.
      name: 'variant',
      type: 'text',
      label: 'Variante',
      admin: {
        description:
          'Slug do estadual escolhido (modelos de card com escolha estadual). Nunca um identificador de visitante.',
      },
    },
  ],
  // ONE compound index and no per-field ones: every read filters by the whole
  // prefix (`subject_type` + `subject_id` + the grouped `type`), and a
  // write-heavy event table should not carry an index per column.
  indexes: [
    {
      fields: ['subjectType', 'subjectId', 'type'],
    },
  ],
}
