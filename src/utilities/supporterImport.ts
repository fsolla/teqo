import type { SupporterVoteIntention } from '@/lib/schemas/supporter'

export type SupporterImportRowStatus =
  | 'ok'
  | 'duplicado_pelo_telefone'
  | 'telefone_invalido'
  | 'municipio_nao_reconhecido'
  | 'nome_invalido'
  | 'intencao_invalida'

export type SupporterImportPreviewRowBase = {
  line: number
  nome: string
  telefone: string
  municipio: string
  intencao: string
}

export type SupporterImportOkRow = SupporterImportPreviewRowBase & {
  status: 'ok'
  normalizedPhone: string
  canonicalCity?: string
  voteIntention?: SupporterVoteIntention
}

export type SupporterImportPreviewRow =
  | SupporterImportOkRow
  | (SupporterImportPreviewRowBase & {
      status: Exclude<SupporterImportRowStatus, 'ok'>
      normalizedPhone?: string
      canonicalCity?: string
      voteIntention?: SupporterVoteIntention
    })

export type SupporterImportPreviewResult = {
  rows: SupporterImportPreviewRow[]
  counts: {
    ok: number
    duplicate: number
    error: number
  }
}

export const isSupporterImportOkRow = (
  row: SupporterImportPreviewRow,
): row is SupporterImportOkRow => row.status === 'ok'
