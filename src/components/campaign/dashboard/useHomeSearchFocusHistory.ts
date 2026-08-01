'use client'

import { useEffect, useRef } from 'react'

import { HOME_SEARCH_FOCUS_HISTORY_KEY } from '@/lib/homeSearchFocusHistory'

/**
 * B106 — Android / browser back collapses Início search without leaving `/campanha`.
 * Only active while mounted on the home page publisher.
 */
export const useHomeSearchFocusHistory = (input: {
  focused: boolean
  onCollapse: () => void
}): void => {
  const { focused, onCollapse } = input
  const historyPushedRef = useRef(false)
  const closingProgrammaticallyRef = useRef(false)
  const onCollapseRef = useRef(onCollapse)

  useEffect(() => {
    onCollapseRef.current = onCollapse
  }, [onCollapse])

  useEffect(() => {
    if (!focused || typeof window === 'undefined' || historyPushedRef.current) {
      return
    }

    window.history.pushState({ [HOME_SEARCH_FOCUS_HISTORY_KEY]: true }, '')
    historyPushedRef.current = true
  }, [focused])

  useEffect(() => {
    if (focused || !historyPushedRef.current || typeof window === 'undefined') {
      return
    }

    if (window.history.state?.[HOME_SEARCH_FOCUS_HISTORY_KEY]) {
      closingProgrammaticallyRef.current = true
      window.history.back()
    }
    historyPushedRef.current = false
  }, [focused])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      if (closingProgrammaticallyRef.current) {
        closingProgrammaticallyRef.current = false
        historyPushedRef.current = false
        return
      }

      if (!historyPushedRef.current) {
        return
      }

      historyPushedRef.current = false
      onCollapseRef.current()
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])
}
