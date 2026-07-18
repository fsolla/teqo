'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

type LazyDialogModule<T> = { default: T }

type LazyDialogModuleState<T> =
  | { status: 'idle'; component: null }
  | { status: 'loading'; component: null }
  | { status: 'ready'; component: T }
  | { status: 'error'; component: null }

export const useLazyDialogModule = <T,>(
  loadModule: () => Promise<LazyDialogModule<T>>,
) => {
  const [state, setState] = useState<LazyDialogModuleState<T>>({
    status: 'idle',
    component: null,
  })
  const statusRef = useRef<LazyDialogModuleState<T>['status']>('idle')
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      attemptRef.current += 1
    }
  }, [])

  const updateState = useCallback((nextState: LazyDialogModuleState<T>) => {
    statusRef.current = nextState.status
    setState(nextState)
  }, [])

  const load = useCallback(() => {
    if (statusRef.current === 'loading' || statusRef.current === 'ready') return

    const attempt = ++attemptRef.current
    updateState({ status: 'loading', component: null })

    void Promise.resolve()
      .then(loadModule)
      .then(({ default: component }) => {
        if (!mountedRef.current || attempt !== attemptRef.current) return
        updateState({ status: 'ready', component })
      })
      .catch(() => {
        if (!mountedRef.current || attempt !== attemptRef.current) return
        updateState({ status: 'error', component: null })
      })
  }, [loadModule, updateState])

  const resetAfterClose = useCallback(() => {
    if (statusRef.current !== 'error') return
    attemptRef.current += 1
    updateState({ status: 'idle', component: null })
  }, [updateState])

  return {
    component: state.component,
    load,
    resetAfterClose,
    status: state.status,
  }
}
