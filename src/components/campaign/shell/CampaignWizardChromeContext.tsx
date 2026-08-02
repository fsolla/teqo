'use client'

import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react'

export type CampaignWizardChromeSkip = {
  label: string
  href: string
}

export type CampaignWizardChromeState = {
  flowTitle: string
  municipalityLabel?: string
  stepKind: 'entry' | 'continue'
  previousHref?: string
  dismissHref: string
  skip?: CampaignWizardChromeSkip
}

type CampaignWizardChromeContextValue = {
  chrome: CampaignWizardChromeState | null
  setChrome: Dispatch<SetStateAction<CampaignWizardChromeState | null>>
  requestBack: () => void
  setBackHandler: (handler: (() => void) | null) => void
}

const CampaignWizardChromeContext = createContext<CampaignWizardChromeContextValue | null>(null)

export const CampaignWizardChromeProvider = ({ children }: { children: ReactNode }) => {
  const [chrome, setChrome] = useState<CampaignWizardChromeState | null>(null)
  const backHandlerRef = useRef<(() => void) | null>(null)

  const setBackHandler = useCallback((handler: (() => void) | null) => {
    backHandlerRef.current = handler
  }, [])

  const requestBack = useCallback(() => {
    backHandlerRef.current?.()
  }, [])

  const value = useMemo(
    () => ({ chrome, setChrome, requestBack, setBackHandler }),
    [chrome, requestBack, setBackHandler],
  )

  return (
    <CampaignWizardChromeContext.Provider value={value}>
      {children}
    </CampaignWizardChromeContext.Provider>
  )
}

const useCampaignWizardChromeContext = (): CampaignWizardChromeContextValue => {
  const value = useContext(CampaignWizardChromeContext)
  if (!value) {
    throw new Error('CampaignWizardChromeProvider is required')
  }
  return value
}

export const useCampaignWizardChrome = (): CampaignWizardChromeState | null =>
  useCampaignWizardChromeContext().chrome

export const useCampaignWizardRequestBack = (): (() => void) =>
  useCampaignWizardChromeContext().requestBack

type CampaignWizardChromeInput = {
  flowTitle: string
  isEntryStep: boolean
  previousHref: string
  dismissHref: string
  municipalityLabel?: string
  skip?: CampaignWizardChromeSkip
}

export const toCampaignWizardChromeState = ({
  flowTitle,
  isEntryStep,
  previousHref,
  dismissHref,
  municipalityLabel,
  skip,
}: CampaignWizardChromeInput): CampaignWizardChromeState => ({
  flowTitle,
  municipalityLabel,
  stepKind: isEntryStep ? 'entry' : 'continue',
  previousHref: isEntryStep ? undefined : previousHref,
  dismissHref,
  skip,
})

export const useSetCampaignWizardChrome = (state: CampaignWizardChromeState | null): void => {
  const { setChrome } = useCampaignWizardChromeContext()

  useLayoutEffect(() => {
    setChrome(state)
  }, [setChrome, state])

  useLayoutEffect(
    () => () => {
      setChrome(null)
    },
    [setChrome],
  )
}

/** Registers the shared Voltar / Android back handler for the active wizard shell (B114). */
export const useSetCampaignWizardBackHandler = (handler: (() => void) | null): void => {
  const { setBackHandler } = useCampaignWizardChromeContext()

  useLayoutEffect(() => {
    setBackHandler(handler)
    return () => {
      setBackHandler(null)
    }
  }, [handler, setBackHandler])
}
