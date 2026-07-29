'use client'

import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

/**
 * The success→toast effect every form-action consumer spelled by hand (P3-G,
 * ×7): fires once per state change, then runs the caller's follow-up (form
 * reset, `router.refresh()`, navigation) through a ref so a re-rendered
 * callback never re-fires the toast.
 */
export const useCampaignFormSuccessToast = (
  state: { status?: string; message?: string },
  onSuccess?: () => void,
) => {
  const onSuccessRef = useRef(onSuccess)
  useEffect(() => {
    onSuccessRef.current = onSuccess
  })

  useEffect(() => {
    if (state.status !== 'success') return
    toast.success(state.message)
    onSuccessRef.current?.()
    // `state.message` is part of the change the toast reports — both belong
    // to the firing condition, like the seven hand-written effects it replaces.
  }, [state.message, state.status])
}
