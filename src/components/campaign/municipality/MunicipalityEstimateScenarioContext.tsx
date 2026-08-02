'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_VOTE_ESTIMATE_SCENARIO, type VoteEstimateScenario } from '@/lib/voteEstimate'

type MunicipalityEstimateScenarioContextValue = {
  scenario: VoteEstimateScenario
  setScenario: (scenario: VoteEstimateScenario) => void
}

const MunicipalityEstimateScenarioContext =
  createContext<MunicipalityEstimateScenarioContextValue | null>(null)

export const MunicipalityEstimateScenarioProvider = ({ children }: { children: ReactNode }) => {
  const [scenario, setScenario] = useState<VoteEstimateScenario>(DEFAULT_VOTE_ESTIMATE_SCENARIO)
  const value = useMemo(() => ({ scenario, setScenario }), [scenario])

  return (
    <MunicipalityEstimateScenarioContext.Provider value={value}>
      {children}
    </MunicipalityEstimateScenarioContext.Provider>
  )
}

export const useMunicipalityEstimateScenarioOptional =
  (): MunicipalityEstimateScenarioContextValue | null =>
    useContext(MunicipalityEstimateScenarioContext)
