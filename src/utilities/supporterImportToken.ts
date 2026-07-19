import 'server-only'

import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto'

import type { Payload } from 'payload'

import type { SupporterVoteIntention } from '@/lib/schemas/supporter'
import type { PayloadTransactionRequest } from '@/utilities/payloadTransaction'

export type SupporterImportOkRow = {
  nome: string
  telefone: string
  municipio?: string
  intencao?: SupporterVoteIntention
}

export type SupporterImportBatch = {
  actorID: number
  expiresAt: number
  okRows: SupporterImportOkRow[]
}

const BATCH_COLLECTION = 'supporterImportBatch'
/** Short-lived server-side staging; the wizard must confirm within this window. */
const IMPORT_TOKEN_TTL_MS = 10 * 60 * 1000

export const storeSupporterImportBatch = async (
  payload: Payload,
  batchId: string,
  batch: SupporterImportBatch,
  req?: PayloadTransactionRequest,
): Promise<void> => {
  await payload.create({
    collection: BATCH_COLLECTION,
    data: {
      batchId,
      actor: batch.actorID,
      expiresAt: new Date(batch.expiresAt).toISOString(),
      rows: batch.okRows,
    },
    depth: 0,
    overrideAccess: true,
    req,
  })
}

export const loadSupporterImportBatch = async (
  payload: Payload,
  batchId: string,
  expectedActorID: number,
  req?: PayloadTransactionRequest,
): Promise<SupporterImportBatch> => {
  const result = await payload.find({
    collection: BATCH_COLLECTION,
    where: { batchId: { equals: batchId } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const doc = result.docs[0] as
    | { id: number; actor: unknown; expiresAt?: string; rows?: unknown }
    | undefined
  if (!doc) throw new Error('Lote de importação não encontrado ou expirado.')

  const actorID =
    typeof doc.actor === 'number'
      ? doc.actor
      : typeof doc.actor === 'object' && doc.actor !== null && 'id' in doc.actor
        ? (doc.actor as { id: number }).id
        : null
  if (actorID !== expectedActorID) {
    throw new Error('Lote de importação inválido.')
  }

  const expiresAtMs = doc.expiresAt ? Date.parse(doc.expiresAt) : NaN
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
    throw new Error('Lote de importação expirado.')
  }
  if (!Array.isArray(doc.rows)) {
    throw new Error('Lote de importação inválido.')
  }

  return {
    actorID: expectedActorID,
    expiresAt: expiresAtMs,
    okRows: doc.rows as SupporterImportOkRow[],
  }
}

export const deleteSupporterImportBatch = async (
  payload: Payload,
  batchId: string,
  req?: PayloadTransactionRequest,
): Promise<void> => {
  const result = await payload.find({
    collection: BATCH_COLLECTION,
    where: { batchId: { equals: batchId } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
    req,
  })
  const doc = result.docs[0] as { id: number } | undefined
  if (!doc) return
  await payload.delete({
    collection: BATCH_COLLECTION,
    id: doc.id,
    depth: 0,
    overrideAccess: true,
    req,
  })
}

const base64url = (buffer: Buffer): string =>
  buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

const base64urlToBuffer = (value: string): Buffer => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(padded, 'base64')
}

const getSecret = (): string => {
  const secret = process.env.PAYLOAD_SECRET
  if (!secret) throw new Error('PAYLOAD_SECRET não configurado para o token de importação.')
  return secret
}

const signature = (batchId: string, actorID: number, expiresAt: number): Buffer =>
  createHmac('sha256', getSecret()).update(`${batchId}.${actorID}.${expiresAt}`).digest()

export type SignedImportToken = {
  token: string
  batchId: string
  expiresAt: number
}

export const issueSupporterImportToken = (actorID: number): SignedImportToken => {
  const batchId = randomUUID()
  const expiresAt = Date.now() + IMPORT_TOKEN_TTL_MS
  const sig = base64url(signature(batchId, actorID, expiresAt))
  return { token: `${batchId}.${expiresAt}.${sig}`, batchId, expiresAt }
}

export const verifySupporterImportToken = (
  token: string,
  actorID: number,
): { batchId: string; expiresAt: number } => {
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Token de importação inválido.')
  const [batchId, expiresAtText, sig] = parts as [string, string, string]
  const expiresAt = Number(expiresAtText)
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) {
    throw new Error('Token de importação expirado.')
  }
  const expected = signature(batchId, actorID, expiresAt)
  const provided = base64urlToBuffer(sig)
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error('Token de importação inválido.')
  }
  return { batchId, expiresAt }
}

