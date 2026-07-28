'use client'

import { useRef, useState } from 'react'
import { toast } from 'sonner'

/**
 * One policy, worth naming because every quick-edit cell has to obey it:
 * **closing unmounts the inline Alert, so a failure that arrives after that has
 * to change channel.** These cells keep saving past the dismissal — closing is
 * what commits the draft, and nothing aborts a request already in flight — so a
 * revert reported only through the Alert is a revert reported to nobody.
 *
 * While the overlay is open the Alert is the closer channel; once closed, a
 * toast is what outlives it.
 *
 * The caller advances `noteOpenChange` from its own `onOpenChange`: the ref, not
 * the state, is what an async callback started three renders ago can read.
 */
export const useCampaignCellFailureChannel = () => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const openRef = useRef(false)

  const reportFailure = (message: string) => {
    setErrorMessage(message)
    if (!openRef.current) toast.error(message)
  }

  const noteOpenChange = (nextOpen: boolean) => {
    openRef.current = nextOpen
  }

  return { errorMessage, setErrorMessage, reportFailure, noteOpenChange }
}
