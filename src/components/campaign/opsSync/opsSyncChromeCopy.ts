import type { OpsSyncStatus } from '@/lib/campaignOps/opsSyncMeta'

const MINUTE_MS = 60_000
const HOUR_MS = 60 * MINUTE_MS

/** Relative “Actualizado há …” for the shell chrome (pt-BR). */
export const formatOpsSyncRelative = (
  lastSyncedAt: string | null,
  nowMs: number = Date.now(),
): string => {
  if (!lastSyncedAt) return 'A sincronizar…'
  const syncedMs = Date.parse(lastSyncedAt)
  if (Number.isNaN(syncedMs)) return 'A sincronizar…'

  const elapsed = Math.max(0, nowMs - syncedMs)
  if (elapsed < MINUTE_MS) return 'Actualizado agora'
  const minutes = Math.floor(elapsed / MINUTE_MS)
  if (minutes < 60) return `Actualizado há ${minutes}m`
  const hours = Math.floor(elapsed / HOUR_MS)
  if (hours < 24) return `Actualizado há ${hours}h`
  const days = Math.floor(hours / 24)
  return `Actualizado há ${days}d`
}

export const resolveOpsSyncChromeLabel = (input: {
  status: OpsSyncStatus
  lastSyncedAt: string | null
  nowMs?: number
}): string => {
  if (input.status === 'syncing') return 'A sincronizar…'
  if (input.status === 'error') return 'Dados podem estar desatualizados'
  return formatOpsSyncRelative(input.lastSyncedAt, input.nowMs)
}
