'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import type { EligibleLeadershipOption } from '@/utilities/municipality/municipalityViewModels'

type MunicipalityLeadershipCreateContextValue = {
  /** Leaderships created inline (B155) since the page last rendered server-side. */
  createdOptions: EligibleLeadershipOption[]
  registerCreatedLeadership: (option: EligibleLeadershipOption) => void
}

const MunicipalityLeadershipCreateContext =
  createContext<MunicipalityLeadershipCreateContextValue | null>(null)

export const useMunicipalityLeadershipCreate = () => useContext(MunicipalityLeadershipCreateContext)

/**
 * B155 — one shared bridge of inline-created leadership options for the whole
 * `/campanha/municipios` list surface (desktop table + mobile cards): a create
 * in one row's popover makes the new leadership selectable in every other row's
 * popover on the same page load, without waiting for an RSC refresh. The bridge
 * is short-lived by design — the page is dynamic, so the next navigation's
 * `getEligibleLeadershipOptions` already returns the record from the DB.
 *
 * Deliberately a mirror of `MunicipalityAdvisorCreateProvider` (B154), not a
 * generalized bridge: two call sites, and the option types differ (`isCurrent`
 * exists only for advisors).
 */
export const MunicipalityLeadershipCreateProvider = ({ children }: { children: ReactNode }) => {
  const [createdOptions, setCreatedOptions] = useState<EligibleLeadershipOption[]>([])

  const registerCreatedLeadership = useCallback((option: EligibleLeadershipOption) => {
    setCreatedOptions((current) =>
      current.some((existing) => existing.id === option.id) ? current : [...current, option],
    )
  }, [])

  const contextValue = useMemo(
    () => ({ createdOptions, registerCreatedLeadership }),
    [createdOptions, registerCreatedLeadership],
  )

  return (
    <MunicipalityLeadershipCreateContext.Provider value={contextValue}>
      {children}
    </MunicipalityLeadershipCreateContext.Provider>
  )
}
