import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { normalizeForSearch, TRANSCRIPT_TEXT_MAX_LENGTH } from '@/lib/speechSearch'
import { canReadSpeech, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * Searchable ASR segment of a speech (C153). The official transcript is the
 * reading surface; these segments carry the timestamps and the trigram-search
 * index (`speech_segment_search_text_trgm_idx`, hand-written migration) used
 * by the C154 search. Admin-hidden: the product surface is the catalog UI.
 */

const deriveSearchText: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const text = typeof data.text === 'string' ? data.text : originalDoc?.text
  data.searchText = normalizeForSearch(text ?? '')
  return data
}

export const SpeechSegment: CollectionConfig = {
  slug: 'speechSegment',
  labels: {
    singular: 'Segmento de fala',
    plural: 'Segmentos de fala',
  },
  admin: {
    group: 'Comunicação',
    hidden: () => true,
    useAsTitle: 'text',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadSpeech,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [deriveSearchText],
  },
  fields: [
    {
      name: 'speech',
      type: 'relationship',
      relationTo: 'speech',
      label: 'Discurso',
      required: true,
      index: true,
    },
    {
      name: 'order',
      type: 'number',
      label: 'Ordem',
      required: true,
    },
    {
      name: 'startSeconds',
      type: 'number',
      label: 'Início (s)',
      required: true,
    },
    {
      name: 'endSeconds',
      type: 'number',
      label: 'Fim (s)',
      required: true,
    },
    {
      name: 'text',
      type: 'textarea',
      label: 'Texto',
      required: true,
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
    },
    {
      name: 'searchText',
      type: 'text',
      label: 'Texto normalizado (busca)',
      required: true,
      maxLength: TRANSCRIPT_TEXT_MAX_LENGTH,
      admin: {
        readOnly: true,
        description: 'Derivado do texto (sem acentos, minúsculas) para a busca por palavra.',
      },
    },
  ],
}
