'use client'

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
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
}

const CampaignWizardChromeContext = createContext<CampaignWizardChromeContextValue | null>(null)

export const CampaignWizardChromeProvider = ({ children }: { children: ReactNode }) => {
  const [chrome, setChrome] = useState<CampaignWizardChromeState | null>(null)
  const value = useMemo(() => ({ chrome, setChrome }), [chrome])

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
