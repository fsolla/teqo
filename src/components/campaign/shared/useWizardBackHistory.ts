'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef } from 'react'

import { useCampaignListTransition } from '@/components/campaign/shared/CampaignListPending'
import {
  resolveWizardBack,
  shouldHandleWizardBackPopstate,
  WIZARD_BACK_HISTORY_KEY,
  WIZARD_LAYER_HISTORY_KEY,
  WIZARD_LEADERSHIP_FORM_LAYER,
  type WizardClientLayer,
} from '@/lib/wizardBack'

type UseWizardBackHistoryInput = {
  stepKind: 'entry' | 'continue'
  previousHref?: string
  dismissHref: string
  clientLayer?: WizardClientLayer | null
  onPopClientLayer?: () => void
}

/**
 * B114 — Android / browser back shares the same target as header Voltar.
 * Pushes a same-URL synthetic entry per step; optional second entry for
 * client layers (leadership form). Mirrors `useHomeSearchFocusHistory` (B106).
 */
export const useWizardBackHistory = (
  input: UseWizardBackHistoryInput,
): { requestBack: () => void } => {
  const { stepKind, previousHref, dismissHref, clientLayer = null, onPopClientLayer } = input
  const router = useRouter()
  const { startTransition } = useCampaignListTransition()

  const backPushedRef = useRef(false)
  const layerPushedRef = useRef(false)
  const closingBackProgrammaticallyRef = useRef(false)
  const closingLayerProgrammaticallyRef = useRef(false)
  const onPopClientLayerRef = useRef(onPopClientLayer)
  const navigateHrefRef = useRef(dismissHref)
  const stepKindRef = useRef(stepKind)
  const previousHrefRef = useRef(previousHref)
  const dismissHrefRef = useRef(dismissHref)
  const clientLayerRef = useRef(clientLayer)
  const startTransitionRef = useRef(startTransition)
  const routerRef = useRef(router)

  useEffect(() => {
    onPopClientLayerRef.current = onPopClientLayer
  }, [onPopClientLayer])

  useEffect(() => {
    stepKindRef.current = stepKind
    previousHrefRef.current = previousHref
    dismissHrefRef.current = dismissHref
    clientLayerRef.current = clientLayer
    startTransitionRef.current = startTransition
    routerRef.current = router
  }, [clientLayer, dismissHref, previousHref, router, startTransition, stepKind])

  useEffect(() => {
    const target = resolveWizardBack({
      stepKind,
      previousHref,
      dismissHref,
      clientLayer: null,
    })
    navigateHrefRef.current = target.kind === 'navigate' ? target.href : dismissHref
  }, [dismissHref, previousHref, stepKind])

  // Synthetic entry for the current URL step / entry dismiss.
  useEffect(() => {
    if (typeof window === 'undefined' || backPushedRef.current) {
      return
    }
    window.history.pushState({ [WIZARD_BACK_HISTORY_KEY]: true }, '')
    backPushedRef.current = true
  }, [])

  // Client layer (leadership form) — second synthetic entry on the same URL.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    if (clientLayer === WIZARD_LEADERSHIP_FORM_LAYER) {
      if (layerPushedRef.current) {
        return
      }
      window.history.pushState({ [WIZARD_LAYER_HISTORY_KEY]: WIZARD_LEADERSHIP_FORM_LAYER }, '')
      layerPushedRef.current = true
      return
    }

    if (!layerPushedRef.current) {
      return
    }

    if (window.history.state?.[WIZARD_LAYER_HISTORY_KEY] === WIZARD_LEADERSHIP_FORM_LAYER) {
      closingLayerProgrammaticallyRef.current = true
      window.history.back()
    }
    layerPushedRef.current = false
  }, [clientLayer])

  const navigateTo = useCallback((href: string) => {
    startTransitionRef.current(() => {
      return routerRef.current.replace(href, { scroll: true })
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const handlePopState = () => {
      if (closingLayerProgrammaticallyRef.current) {
        closingLayerProgrammaticallyRef.current = false
        layerPushedRef.current = false
        return
      }

      if (
        shouldHandleWizardBackPopstate({
          wasHistoryPushed: layerPushedRef.current,
          closingProgrammatically: false,
        })
      ) {
        layerPushedRef.current = false
        onPopClientLayerRef.current?.()
        return
      }

      if (closingBackProgrammaticallyRef.current) {
        closingBackProgrammaticallyRef.current = false
        backPushedRef.current = false
        return
      }

      if (
        !shouldHandleWizardBackPopstate({
          wasHistoryPushed: backPushedRef.current,
          closingProgrammatically: false,
        })
      ) {
        return
      }

      backPushedRef.current = false
      navigateTo(navigateHrefRef.current)
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [navigateTo])

  const requestBack = useCallback(() => {
    if (typeof window === 'undefined') {
      return
    }

    const target = resolveWizardBack({
      stepKind: stepKindRef.current,
      previousHref: previousHrefRef.current,
      dismissHref: dismissHrefRef.current,
      clientLayer: clientLayerRef.current,
    })

    if (target.kind === 'pop-layer') {
      if (layerPushedRef.current) {
        // Same path as Android back — popstate closes the layer.
        window.history.back()
        return
      }
      onPopClientLayerRef.current?.()
      return
    }

    if (backPushedRef.current) {
      // Same path as Android back — popstate navigates to previous/dismiss.
      window.history.back()
      return
    }

    navigateTo(target.href)
  }, [navigateTo])

  return { requestBack }
}
