'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

import { DEFAULT_VOTE_ESTIMATE_SCENARIO, type VoteEstimateScenario } from '@/utilities/voteEstimate'

type PlazaEstimateScenarioContextValue = {
  scenario: VoteEstimateScenario
  setScenario: (scenario: VoteEstimateScenario) => void
}

const PlazaEstimateScenarioContext = createContext<PlazaEstimateScenarioContextValue | null>(null)

export const PlazaEstimateScenarioProvider = ({ children }: { children: ReactNode }) => {
  const [scenario, setScenario] = useState<VoteEstimateScenario>(DEFAULT_VOTE_ESTIMATE_SCENARIO)
  const value = useMemo(() => ({ scenario, setScenario }), [scenario])

  return (
    <PlazaEstimateScenarioContext.Provider value={value}>
      {children}
    </PlazaEstimateScenarioContext.Provider>
  )
}

export const usePlazaEstimateScenario = (): PlazaEstimateScenarioContextValue => {
  const value = useContext(PlazaEstimateScenarioContext)
  if (!value) {
    throw new Error('usePlazaEstimateScenario must be used within PlazaEstimateScenarioProvider')
  }
  return value
}

export const usePlazaEstimateScenarioOptional = (): PlazaEstimateScenarioContextValue | null =>
  useContext(PlazaEstimateScenarioContext)
