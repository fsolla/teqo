'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { EligibleAdvisorOption } from '@/utilities/municipality/municipalityViewModels'

type MunicipalityAdvisorCreateContextValue = {
  /** Advisors created inline (B154) since the page last rendered server-side. */
  createdOptions: EligibleAdvisorOption[]
  registerCreatedAdvisor: (option: EligibleAdvisorOption) => void
}

const MunicipalityAdvisorCreateContext =
  createContext<MunicipalityAdvisorCreateContextValue | null>(null)

export const useMunicipalityAdvisorCreate = () => useContext(MunicipalityAdvisorCreateContext)

/**
 * B154 — one shared bridge of inline-created advisor options for the whole
 * `/campanha/municipios` list surface (desktop table + mobile cards): a create
 * in one row's popover makes the new account selectable in every other row's
 * popover on the same page load, without waiting for an RSC refresh. The bridge
 * is short-lived by design — the page is dynamic, so the next navigation's
 * `getEligibleAdvisorOptions` already returns the account from the DB. Same
 * shell pattern as `CampaignListSheetProvider`.
 */
export const MunicipalityAdvisorCreateProvider = ({ children }: { children: ReactNode }) => {
  const [createdOptions, setCreatedOptions] = useState<EligibleAdvisorOption[]>([])

  const registerCreatedAdvisor = useCallback((option: EligibleAdvisorOption) => {
    setCreatedOptions((current) =>
      current.some((existing) => existing.id === option.id) ? current : [...current, option],
    )
  }, [])

  const contextValue = useMemo(
    () => ({ createdOptions, registerCreatedAdvisor }),
    [createdOptions, registerCreatedAdvisor],
  )

  return (
    <MunicipalityAdvisorCreateContext.Provider value={contextValue}>
      {children}
    </MunicipalityAdvisorCreateContext.Provider>
  )
}
