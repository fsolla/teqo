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
  counts: {
    ok: number
    duplicate: number
    error: number
  }
  /** First N rows for the on-screen preview table (the full set stays server-side). */
  sampleRows: SupporterImportPreviewRow[]
  /** Precomputed CSV of every error row, for the "Baixar relatório de erros" button. */
  errorReportCsv: string
  /** HMAC-signed token that `confirmSupporterImport` exchanges for the staged batch. */
  importToken: string
}

export const isSupporterImportOkRow = (
  row: SupporterImportPreviewRow,
): row is SupporterImportOkRow => row.status === 'ok'
