export type OpsSyncStatus = 'idle' | 'syncing' | 'error'

export type OpsSyncState = {
  status: OpsSyncStatus
  lastSyncedAt: string | null
  lastError?: string
}
