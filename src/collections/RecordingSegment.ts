import type { CollectionBeforeValidateHook, CollectionConfig } from 'payload'

import { normalizeForSearch } from '@/lib/speechSearch'
import { canReadRecording, payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C199 — searchable ASR segment of an uploaded recording: one timestamped block
 * of the transcript with the trigram-search index (`recording_segment_search_text_trgm_idx`,
 * hand-written migration). Admin-hidden: the product surface is the recording
 * detail with its clickable transcript. C200 adds `speakerKey`: the anonymous
 * acoustic cluster ("Falante N") the segment was assigned to; null when the
 * recording has no diarization (the detail renders the plain transcript then).
 */

const deriveSearchText: CollectionBeforeValidateHook = ({ data, originalDoc }) => {
  if (!data) return data
  const text = typeof data.text === 'string' ? data.text : originalDoc?.text
  data.searchText = normalizeForSearch(text ?? '')
  return data
}

export const RecordingSegment: CollectionConfig = {
  slug: 'recordingSegment',
  labels: {
    singular: 'Segmento de gravação',
    plural: 'Segmentos de gravação',
  },
  admin: {
    group: 'Comunicação',
    hidden: () => true,
    useAsTitle: 'text',
  },
  access: {
    create: payloadAdminOnly,
    read: canReadRecording,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  hooks: {
    beforeValidate: [deriveSearchText],
  },
  fields: [
    {
      name: 'recording',
      type: 'relationship',
      relationTo: 'recording',
      label: 'Gravação',
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
      name: 'speakerKey',
      type: 'text',
      label: 'Agrupamento de falante',
      admin: {
        readOnly: true,
        description: 'Chave do agrupamento acústico ("Falante N") do trecho; vazio sem diarização.',
      },
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
    },
    {
      name: 'searchText',
      type: 'text',
      label: 'Texto normalizado (busca)',
      required: true,
      admin: {
        readOnly: true,
        description: 'Derivado do texto (sem acentos, minúsculas) para a busca por palavra.',
      },
    },
  ],
}
