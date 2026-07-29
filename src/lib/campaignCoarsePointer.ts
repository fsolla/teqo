'use client'

import { useSyncExternalStore } from 'react'

const COARSE_POINTER_QUERY = '(pointer: coarse)'

const listeners = new Set<() => void>()
let changeListenerAttached = false

const notifyCoarsePointerListeners = () => {
  for (const listener of listeners) listener()
}

const subscribeCoarsePointer = (onStoreChange: () => void) => {
  listeners.add(onStoreChange)
  if (typeof window !== 'undefined' && !changeListenerAttached) {
    window.matchMedia(COARSE_POINTER_QUERY).addEventListener('change', notifyCoarsePointerListeners)
    changeListenerAttached = true
  }
  return () => {
    listeners.delete(onStoreChange)
  }
}

const getCoarsePointerSnapshot = () =>
  typeof window === 'undefined' ? false : window.matchMedia(COARSE_POINTER_QUERY).matches

/** @internal Test harness resets `matchMedia` between fine/coarse cases. */
export const resetCampaignCoarsePointerForTests = () => {
  listeners.clear()
  changeListenerAttached = false
}

/** One shared `change` listener; snapshot re-reads `matchMedia` each time. */
export const useCoarsePointer = () =>
  useSyncExternalStore(subscribeCoarsePointer, getCoarsePointerSnapshot, () => false)
