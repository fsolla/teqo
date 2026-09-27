import type { CollectionConfig } from 'payload'

import { payloadAdminOnly } from '@/utilities/campaignAccess'

/**
 * C234 — one person who ADHERED to the selfie search index (A/C scope of the
 * gate, PR #1370): the enrollment is an ops act of the assessoria with the
 * person (signed consent, `pnpm faces:enroll`), never self-service and never
 * inferred from the archive.
 *
 * This is not a people registry: it has no link to `Contact`/leadership, no
 * public read and no surface of its own — it exists to (a) hold the consented
 * descriptor that lets the person find themselves and (b) carry the audit
 * trail of the adherence (`consent` + `consentHash` + `model` + status). The
 * descriptor is written only by the CLI and never leaves the server; the
 * matched photos are a derived link the batch replaces on every run. A
 * `removed` subject keeps its row (the attendance record) but not the vector.
 */
export const FaceSubject: CollectionConfig = {
  slug: 'faceSubject',
  labels: {
    singular: 'Pessoa no índice facial',
    plural: 'Pessoas no índice facial',
  },
  admin: {
    group: 'Comunicação',
    description:
      'Pessoas que consentiram entrar no índice da busca por selfie (/fotos/encontre). Operado pela CLI faces:enroll/faces:index; a remoção é registrada no status.',
    useAsTitle: 'label',
    defaultColumns: ['label', 'status', 'model', 'removedAt'],
  },
  access: {
    create: payloadAdminOnly,
    read: payloadAdminOnly,
    update: payloadAdminOnly,
    delete: payloadAdminOnly,
  },
  fields: [
    {
      name: 'label',
      type: 'text',
      label: 'Nome (interno)',
      required: true,
      admin: {
        description: 'Como a assessoria identifica a pessoa; nunca aparece no site.',
      },
    },
    {
      name: 'consent',
      type: 'relationship',
      relationTo: 'consent',
      label: 'Consentimento (adesão)',
      required: true,
      index: true,
      admin: {
        description: 'O Consent da adesão ao índice (chave estável busca-selfie-indice).',
      },
    },
    {
      name: 'consentHash',
      type: 'text',
      label: 'Hash do consentimento',
      admin: {
        readOnly: true,
        description:
          'Snapshot do texto aceito no enrollment; se o texto mudar, a pessoa fica inelegível até re-consentir.',
      },
    },
    {
      name: 'model',
      type: 'text',
      label: 'Modelo',
      admin: {
        readOnly: true,
        description: 'Modelo do descriptor (troca de modelo invalida o índice: re-enrollment).',
      },
    },
    {
      name: 'enrolledAt',
      type: 'date',
      label: 'Inscrita em',
      admin: {
        readOnly: true,
        description:
          'Muda a cada enrollment/re-enrollment; é o que marca o lote como stale (o updated_at muda também quando o lote escreve os vínculos).',
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
    {
      name: 'status',
      type: 'select',
      label: 'Status',
      required: true,
      index: true,
      defaultValue: 'active',
      options: [
        { label: 'Ativa', value: 'active' },
        { label: 'Removida do índice', value: 'removed' },
      ],
      admin: {
        description:
          'Removida: pedido de saída atendido — o vetor é apagado e a pessoa deixa de ser encontrada.',
      },
    },
    {
      name: 'removedAt',
      type: 'date',
      label: 'Removida em',
      admin: {
        readOnly: true,
        description: 'Data do atendimento da saída do índice.',
      },
    },
    {
      name: 'matchedPhotos',
      type: 'relationship',
      relationTo: 'archivePhoto',
      hasMany: true,
      label: 'Fotos vinculadas',
      admin: {
        readOnly: true,
        description:
          'Derivado do lote (pnpm faces:index): fotos aprovadas em que o descriptor foi encontrado.',
      },
    },
  ],
}
