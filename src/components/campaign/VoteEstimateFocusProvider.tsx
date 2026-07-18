'use client'

import {
  createContext,
  type MutableRefObject,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
} from 'react'
import { usePathname } from 'next/navigation'

import type { VoteEstimateDialogMode } from '@/components/campaign/VoteEstimateDialog'

export type VoteEstimateSuccessFocus = {
  confirmedEstimateRevision: string | null
  mode: VoteEstimateDialogMode
  nucleusId: number
}

const VoteEstimateFocusContext =
  createContext<MutableRefObject<VoteEstimateSuccessFocus | null> | null>(null)

export const VoteEstimateFocusProvider = ({ children }: { children: ReactNode }) => {
  const pathname = usePathname()
  const focusIntentRef = useRef<VoteEstimateSuccessFocus | null>(null)

  useEffect(() => {
    focusIntentRef.current = null
  }, [pathname])

  return (
    <VoteEstimateFocusContext.Provider value={focusIntentRef}>
      {children}
    </VoteEstimateFocusContext.Provider>
  )
}

export const useVoteEstimateSuccessFocus = () => useContext(VoteEstimateFocusContext)
