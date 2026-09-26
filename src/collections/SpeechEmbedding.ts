import type { CollectionConfig } from 'payload'

import { canReadSpeech, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C229 — the semantic index of the speech acervo, one row per vector. `kind:
 * 'speech'` is the speech-level vector (element-wise mean of its units, used by
 * the ranking); `kind: 'segment'` points at an ASR segment by `order` and
 * `kind: 'window'` at a fixed-size text window of a speech without segments —
 * both are the real evidence excerpt the card shows ("Trecho mais próximo do
 * tema"). The vector is L2-normalized at write time and stored as JSON.
 *
 * Derived data, never authoritative: the acervo keeps its access gate
 * (`canReadSpeech`), the import CLIs restore it and `pnpm acervo:index`
 * rebuilds/stales it by `contentHash` + `model`. Admin-hidden: the product
 * surface is the catalog UI.
 */
export const SpeechEmbedding: CollectionConfig = {
  slug: 'speechEmbedding',
  labels: {
    singular: 'Vetor de fala',
    plural: 'Vetores de fala',
  },
  admin: {
    group: 'Comunicação',
    hidden: () => true,
    useAsTitle: 'kind',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadSpeech,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'speech',
      type: 'relationship',
      relationTo: 'speech',
      label: 'Fala',
      required: true,
      index: true,
    },
    {
      name: 'kind',
      type: 'select',
      label: 'Unidade',
      required: true,
      index: true,
      options: [
        { label: 'Fala', value: 'speech' },
        { label: 'Segmento', value: 'segment' },
        { label: 'Janela de texto', value: 'window' },
      ],
    },
    {
      name: 'order',
      type: 'number',
      label: 'Ordem',
      admin: {
        description: 'Posição do trecho na fala; vazio no vetor da fala.',
      },
    },
    {
      name: 'startSeconds',
      type: 'number',
      label: 'Início (s)',
      admin: {
        description: 'Início do segmento quando conhecido; vazio na janela de texto.',
      },
    },
    {
      name: 'model',
      type: 'text',
      label: 'Modelo',
      required: true,
      admin: {
        description: 'Modelo de embedding que gerou o vetor (muda ⇒ reindexar).',
      },
    },
    {
      name: 'dimensions',
      type: 'number',
      label: 'Dimensões',
      required: true,
    },
    {
      name: 'contentHash',
      type: 'text',
      label: 'Hash do conteúdo',
      required: true,
      admin: {
        description: 'Hash do texto + modelo; decide o pulo na reindexação.',
      },
    },
    {
      name: 'vector',
      type: 'json',
      label: 'Vetor',
      required: true,
      admin: {
        readOnly: true,
        description: 'Embedding L2-normalizado da unidade.',
      },
    },
  ],
}
