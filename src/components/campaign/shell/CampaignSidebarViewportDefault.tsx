'use client'

import { useEffect, useRef } from 'react'

import { useSidebar } from '@/components/ui/Sidebar'

const DESKTOP_MIN_WIDTH_QUERY = '(min-width: 1024px)'

/** One-shot tablet default when no persisted sidebar_state cookie. */
export const CampaignSidebarViewportDefault = ({
  hasSidebarCookie,
}: {
  hasSidebarCookie: boolean
}) => {
  const { setOpen } = useSidebar()
  const appliedRef = useRef(false)

  useEffect(() => {
    if (hasSidebarCookie || appliedRef.current) return
    appliedRef.current = true
    if (!window.matchMedia(DESKTOP_MIN_WIDTH_QUERY).matches) {
      setOpen(false)
    }
  }, [hasSidebarCookie, setOpen])

  return null
}
