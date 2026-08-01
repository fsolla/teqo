'use client'

import {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  createContext,
  type ReactNode,
} from 'react'

import {
  bootstrapOpsMirror,
  syncOpsMirror,
} from '@/components/campaign/opsSync/opsMirrorClient'
import type { OpsSyncState, OpsSyncStatus } from '@/lib/campaignOps/opsSyncMeta'

const POLL_INTERVAL_MS = 3 * 60 * 1000

type OpsSyncContextValue = {
  status: OpsSyncStatus
  lastSyncedAt: string | null
  lastError?: string
  offline: boolean
}

const OpsSyncContext = createContext<OpsSyncContextValue | null>(null)

const initialState: OpsSyncContextValue = {
  status: 'idle',
  lastSyncedAt: null,
  offline: false,
}

export const useOpsSyncState = (): Pick<
  OpsSyncContextValue,
  'status' | 'lastSyncedAt' | 'lastError'
> => {
  const value = useContext(OpsSyncContext)
  if (!value) {
    return { status: 'idle', lastSyncedAt: null }
  }
  return {
    status: value.status,
    lastSyncedAt: value.lastSyncedAt,
    lastError: value.lastError,
  }
}

/**
 * Offline when the browser reports offline OR the last sync failed.
 * Clears on successful sync or the `online` event.
 */
export const useOpsOffline = (): boolean => {
  const value = useContext(OpsSyncContext)
  return value?.offline ?? false
}

export const CampaignOpsSyncProvider = ({
  enabled,
  children,
}: {
  enabled: boolean
  children: ReactNode
}) => {
  const [state, setState] = useState<OpsSyncContextValue>(initialState)
  const syncingRef = useRef(false)
  const mountedRef = useRef(false)

  const applySyncResult = useCallback((result: OpsSyncState, browserOnline: boolean) => {
    if (!mountedRef.current) return
    const syncFailed = result.status === 'error'
    setState({
      status: result.status,
      lastSyncedAt: result.lastSyncedAt,
      lastError: result.lastError,
      offline: !browserOnline || syncFailed,
    })
  }, [])

  const runSync = useCallback(async () => {
    if (syncingRef.current) return
    syncingRef.current = true
    if (mountedRef.current) {
      setState((prev) => ({ ...prev, status: 'syncing' }))
    }
    try {
      const result = await syncOpsMirror()
      applySyncResult(result, typeof navigator === 'undefined' ? true : navigator.onLine)
    } finally {
      syncingRef.current = false
    }
  }, [applySyncResult])

  useEffect(() => {
    if (!enabled) return

    mountedRef.current = true
    let pollTimer: ReturnType<typeof setInterval> | null = null

    const boot = async () => {
      if (!mountedRef.current) return
      setState((prev) => ({
        ...prev,
        status: 'syncing',
        offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
      }))
      try {
        await bootstrapOpsMirror({ skipNetworkSync: true })
        if (!mountedRef.current) return
        await runSync()
      } catch {
        if (!mountedRef.current) return
        setState((prev) => ({
          ...prev,
          status: 'error',
          offline: true,
          lastError: 'bootstrap failed',
        }))
      }
    }

    void boot()

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void runSync()
    }
    const onOnline = () => {
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, offline: false }))
      void runSync()
    }
    const onOffline = () => {
      if (!mountedRef.current) return
      setState((prev) => ({ ...prev, offline: true }))
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') void runSync()
    }, POLL_INTERVAL_MS)

    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [enabled, runSync])

  if (!enabled) {
    return children
  }

  return <OpsSyncContext.Provider value={state}>{children}</OpsSyncContext.Provider>
}
