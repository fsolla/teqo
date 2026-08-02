'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import {
  advisorEntriesFromIds,
  MissingAdvisorBadge,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListGoalCoverageCell } from '@/components/campaign/municipality/MunicipalityListGoalCoverageCell'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { SignalAgeReadout } from '@/components/campaign/municipality/MunicipalityListRowReadouts'
import { MunicipalityListSignalControl } from '@/components/campaign/municipality/MunicipalityListSignalControl'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { municipalityGeographyParts } from '@/utilities/municipality/municipalityLabels'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import { toMunicipalityPledgeCoverageView } from '@/utilities/votePledgeViews'

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

export type MunicipalityListMobileCardsProps = {
  municipalities: MunicipalityListViewModel[]
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  isStaffView: boolean
  isCoordinator: boolean
  canMoveEngagementLevel: boolean
  advisorOptions: EligibleAdvisorOption[]
  signalFormAction: MunicipalityStaffFormAction
  emptySlot: ReactNode
}

/**
 * B42 mobile cards densified by B120: name + territory, one coverage/level line,
 * then a compact row of edit-in-place controls. Classe and 2022 position live on
 * the detail — they don't change "open or act" on the list.
 */
export const MunicipalityListMobileCards = ({
  municipalities,
  advisorNamesById,
  isStaffView,
  isCoordinator,
  canMoveEngagementLevel,
  advisorOptions,
  signalFormAction,
  emptySlot,
}: MunicipalityListMobileCardsProps) => (
  <div data-view="mobile-cards" className="flex flex-col gap-2.5 md:hidden">
    {municipalities.length === 0 ? emptySlot : null}
    {municipalities.map((municipality) => {
      const names = advisorEntriesFromIds(municipality.advisorIDs, advisorNamesById).map(
        (advisor) => advisor.name,
      )
      const isPriority = municipality.priority === 'alta'
      const { region, zoneSuffix } = municipalityGeographyParts(municipality)
      return (
        <article
          key={municipality.id}
          className="relative flex flex-col gap-2 rounded-xl border px-3 py-2.5"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex flex-col gap-0.5">
              <h3 className="font-medium leading-snug">
                <Link
                  href={`/campanha/municipios/${municipality.slug}`}
                  className="rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {municipality.name}
                </Link>
              </h3>
              <p className="text-sm text-muted-foreground">
                <span className="relative">
                  <TerritoryLink region={region} />
                </span>
                {zoneSuffix ? ` ${zoneSuffix}` : null}
              </p>
            </div>
            {isPriority && isStaffView ? (
              <MunicipalityPriorityIndicator className="relative size-11 shrink-0" />
            ) : null}
          </div>

          {isStaffView ? (
            <>
              <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <div className="min-w-0">
                  <MunicipalityListGoalCoverageCell
                    coverageByScenario={municipality.goalCoverageByScenario}
                  />
                </div>
                <div className="min-w-0">
                  {canMoveEngagementLevel ? (
                    <MunicipalityListLevelControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      level={municipality.engagementLevel}
                      levelNote={municipality.levelNote}
                      levelChangedAt={municipality.levelChangedAt}
                      updatedAt={municipality.updatedAt}
                      variant="sheet"
                    />
                  ) : (
                    <MunicipalityLevelBadge
                      level={municipality.engagementLevel}
                      note={municipality.levelNote}
                      layout="card"
                    />
                  )}
                </div>
              </div>

              <div className="relative flex flex-wrap items-center gap-1">
                <MunicipalityListTrendControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  status={municipality.politicalTrendStatus}
                  trendNote={municipality.politicalTrendNote}
                  updatedAt={municipality.updatedAt}
                  variant="sheet"
                />
                <MunicipalityListExpectedVotesControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  expectedVotes={municipality.expectedVotes}
                  pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                  variant="sheet"
                />
                <MunicipalityListSignalControl
                  municipalityID={municipality.id}
                  municipalitySlug={municipality.slug}
                  municipalityName={municipality.name}
                  lastSignalAt={municipality.lastSignalAt}
                  variant="sheet"
                  formAction={signalFormAction}
                >
                  <SignalAgeReadout lastSignalAt={municipality.lastSignalAt} layout="card" />
                </MunicipalityListSignalControl>
                {isCoordinator ? (
                  <MunicipalityListAdvisorsControl
                    municipalityID={municipality.id}
                    municipalityName={municipality.name}
                    currentAdvisorIDs={municipality.advisorIDs}
                    isPriority={isPriority}
                    advisorNamesById={advisorNamesById}
                    options={advisorOptions}
                    updatedAt={municipality.updatedAt}
                    variant="sheet"
                  />
                ) : names.length ? (
                  <span className="relative px-1 text-sm text-muted-foreground">
                    {names.join(', ')}
                  </span>
                ) : (
                  <span className="relative">
                    <MissingAdvisorBadge isPriority={isPriority} />
                  </span>
                )}
              </div>
            </>
          ) : null}
        </article>
      )
    })}
  </div>
)
