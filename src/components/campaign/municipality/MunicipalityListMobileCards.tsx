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
import { MunicipalityListLeadershipsControl } from '@/components/campaign/municipality/MunicipalityListLeadershipsControl'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import {
  SignalAgeReadout,
  TerritorialClassCardReadout,
} from '@/components/campaign/municipality/MunicipalityListRowReadouts'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalityListUpdateControl } from '@/components/campaign/municipality/MunicipalityListUpdateControl'
import { MunicipalityPriorityIndicator } from '@/components/campaign/municipality/MunicipalityPriorityIndicator'
import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import {
  MunicipalityStateDeputyRelationCell,
  type MunicipalityStateDeputyCreateAction,
} from '@/components/campaign/shared/MunicipalityStateDeputyRelationCell'
import { Badge } from '@/components/ui/Badge'
import { SALVADOR_CITY_AGGREGATE_LABEL } from '@/lib/salvadorCity'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import { municipalityGeographyParts } from '@/utilities/municipality/municipalityLabels'
import { municipalityColumnLabels } from '@/utilities/municipality/municipalityListUrl'
import type {
  EligibleAdvisorOption,
  EligibleLeadershipOption,
  MunicipalityAdvisorSummary,
  MunicipalityLeadershipSummary,
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
  /** B155 — contact-name lookup for the Lideranças sheet chips. */
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  isStaffView: boolean
  isCoordinator: boolean
  isCampaignUnrestricted: boolean
  canMoveEngagementLevel: boolean
  advisorOptions: EligibleAdvisorOption[]
  /** B155 — every leadership the actor may add, for the Lideranças sheet. */
  leadershipOptions: EligibleLeadershipOption[]
  stateDeputyOptions: StateDeputyRelationOption[]
  stateDeputyCommitAction: MunicipalityStaffFormAction
  stateDeputyCreateAction: MunicipalityStateDeputyCreateAction
  signalFormAction: MunicipalityStaffFormAction
  emptySlot: ReactNode
}

/**
 * B42 mobile cards with sheet-variant quick edits. Wrapped by
 * `MunicipalityListMobileSection`, which hosts a single shared Drawer.
 */
export const MunicipalityListMobileCards = ({
  municipalities,
  advisorNamesById,
  leadershipNamesById,
  isStaffView,
  isCoordinator,
  isCampaignUnrestricted,
  canMoveEngagementLevel,
  advisorOptions,
  leadershipOptions,
  stateDeputyOptions,
  stateDeputyCommitAction,
  stateDeputyCreateAction,
  signalFormAction,
  emptySlot,
}: MunicipalityListMobileCardsProps) => (
  <div
    data-view="mobile-cards"
    className="flex flex-col gap-4 @min-[48rem]/municipality-list:hidden"
  >
    {municipalities.length === 0 ? emptySlot : null}
    {municipalities.map((municipality) => {
      const names = advisorEntriesFromIds(municipality.advisorIDs, advisorNamesById).map(
        (advisor) => advisor.name,
      )
      const position = municipality.votePosition2022
      const isPriority = municipality.priority === 'alta'
      const { region, zoneSuffix } = municipalityGeographyParts(municipality)
      const isCity = municipality.isCity
      return (
        <article
          key={municipality.id}
          className="relative flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-col gap-1">
              <h3 className="flex items-center gap-1.5 font-medium">
                <Link
                  href={`/campanha/municipios/${municipality.slug}`}
                  className="rounded-md after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {municipality.name}
                </Link>
                {isCity ? <Badge variant="secondary">Cidade</Badge> : null}
              </h3>
              <p className="text-sm text-muted-foreground">
                {isCity ? (
                  SALVADOR_CITY_AGGREGATE_LABEL
                ) : (
                  <>
                    <span className="relative">
                      <TerritoryLink region={region} />
                    </span>
                    {zoneSuffix ? ` ${zoneSuffix}` : null}
                  </>
                )}
              </p>
              {position ? (
                <MunicipalityVotePositionReadout position={position} layout="card" />
              ) : null}
            </div>
            {!isCity && isPriority && isStaffView ? (
              <MunicipalityPriorityIndicator className="relative size-11" />
            ) : null}
          </div>
          {isStaffView ? (
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-muted-foreground">Classe</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <TerritorialClassCardReadout municipality={municipality} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{municipalityColumnLabels.goalCoverage}</dt>
                <dd>
                  <MunicipalityListGoalCoverageCell
                    coverageByScenario={municipality.goalCoverageByScenario}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Votos estimados</dt>
                <dd>
                  {isCity ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <MunicipalityListExpectedVotesControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      expectedVotes={municipality.expectedVotes}
                      pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
                      variant="sheet"
                    />
                  )}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">Nível</dt>
                <dd>
                  {isCity ? (
                    <span className="text-muted-foreground">—</span>
                  ) : canMoveEngagementLevel ? (
                    <MunicipalityListLevelControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      level={municipality.engagementLevel}
                      levelNote={municipality.levelNote}
                      levelChangedAt={municipality.levelChangedAt}
                      variant="sheet"
                    />
                  ) : (
                    <MunicipalityLevelBadge
                      level={municipality.engagementLevel}
                      note={municipality.levelNote}
                      layout="card"
                    />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Tendência</dt>
                <dd>
                  {isCity ? (
                    <Badge variant="outline">Não registrada</Badge>
                  ) : (
                    <MunicipalityListTrendControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      status={municipality.politicalTrendStatus}
                      trendNote={municipality.politicalTrendNote}
                      variant="sheet"
                    />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Última atualização</dt>
                <dd>
                  {isCity ? (
                    <SignalAgeReadout lastSignalAt={null} layout="card" />
                  ) : (
                    <MunicipalityListUpdateControl
                      municipalityID={municipality.id}
                      municipalitySlug={municipality.slug}
                      municipalityName={municipality.name}
                      lastSignalAt={municipality.lastSignalAt}
                      variant="sheet"
                      formAction={signalFormAction}
                      isStaff={isCampaignUnrestricted}
                    >
                      <SignalAgeReadout lastSignalAt={municipality.lastSignalAt} layout="card" />
                    </MunicipalityListUpdateControl>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Assessores</dt>
                <dd>
                  {isCity ? (
                    <span className="text-muted-foreground">—</span>
                  ) : isCoordinator ? (
                    <MunicipalityListAdvisorsControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      currentAdvisorIDs={municipality.advisorIDs}
                      isPriority={isPriority}
                      advisorNamesById={advisorNamesById}
                      options={advisorOptions}
                      variant="sheet"
                    />
                  ) : names.length ? (
                    names.join(', ')
                  ) : (
                    <MissingAdvisorBadge isPriority={isPriority} />
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Lideranças</dt>
                <dd>
                  {isCity ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <MunicipalityListLeadershipsControl
                      municipalityID={municipality.id}
                      municipalityName={municipality.name}
                      currentLeadershipIDs={municipality.leadershipIDs}
                      leadershipNamesById={leadershipNamesById}
                      options={leadershipOptions}
                      variant="sheet"
                    />
                  )}
                </dd>
              </div>
              {/* B176 — staff-wide since 2026-08-09; the write stays scoped to
                  the actor's administered municípios (B37/B157). */}
              {isStaffView ? (
                <div className="col-span-2">
                  <dt className="text-muted-foreground">Dobradinhas</dt>
                  <dd>
                    {isCity ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <MunicipalityStateDeputyRelationCell
                        municipalityId={municipality.id}
                        municipalityName={municipality.name}
                        stateDeputyIDs={municipality.stateDeputyIDs}
                        options={stateDeputyOptions}
                        commitAction={stateDeputyCommitAction}
                        createAction={stateDeputyCreateAction}
                        editorVariant="sheet"
                      />
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </article>
      )
    })}
  </div>
)
