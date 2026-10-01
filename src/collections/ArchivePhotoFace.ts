import type { CollectionConfig } from 'payload'

import { payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C242 — one detected face of an APPROVED archive photo: the anonymous index
 * that lets any visitor find themselves (scope B of the gate, decision of
 * 2026-10-01; supersedes the A/C `faceSubject` enrollment). The row carries no
 * identity, no link to `Contact`/leadership and no name — only the photo it was
 * found in, the 128-float descriptor and the model that produced it.
 *
 * Machine-only data: no admin surface (`admin.hidden`), admin-only access, and
 * the descriptor never leaves the server. Written exclusively by the
 * `pnpm faces:index` batch (trusted operator, `overrideAccess`), deleted by the
 * opt-out (`leave-index` matches the person's own descriptor) and by the photo
 * lifecycle hooks on unapproval/deletion. A photo that is not `approved` must
 * never have rows here.
 */
export const ArchivePhotoFace: CollectionConfig = {
  slug: 'archivePhotoFace',
  labels: {
    singular: 'Rosto no índice',
    plural: 'Rostos no índice',
  },
  admin: {
    group: 'Comunicação',
    hidden: true,
    description:
      'Índice facial anônimo do acervo público aprovado (C242). Operado pela CLI faces:index; o descriptor nunca é exposto.',
  },
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'photo',
      type: 'relationship',
      relationTo: 'archivePhoto',
      label: 'Foto',
      required: true,
      index: true,
      admin: {
        description: 'Foto aprovada em que o rosto foi detectado.',
      },
    },
    {
      name: 'model',
      type: 'text',
      label: 'Modelo',
      required: true,
      index: true,
      admin: {
        readOnly: true,
        description:
          'Modelo do descriptor (troca de modelo invalida a revisão e o lote reprocessa).',
      },
    },
    {
      name: 'detectedAt',
      type: 'date',
      label: 'Detectado em',
      admin: {
        readOnly: true,
      },
    },
    {
      name: 'vector',
      type: 'json',
      label: 'Descriptor',
      admin: {
        hidden: true,
        readOnly: true,
      },
    },
  ],
}
