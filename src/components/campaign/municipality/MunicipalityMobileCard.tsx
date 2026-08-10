'use client'

import { ChevronDownIcon, CircleAlertIcon } from 'lucide-react'
import Link from 'next/link'
import { useState, type ReactNode } from 'react'

import {
  advisorEntriesFromIds,
  MunicipalityAdvisorAvatarStack,
} from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { MunicipalityLevelBadge } from '@/components/campaign/municipality/MunicipalityLevelBadge'
import { MunicipalityListAdvisorsControl } from '@/components/campaign/municipality/MunicipalityListAdvisorsControl'
import { MunicipalityListExpectedVotesControl } from '@/components/campaign/municipality/MunicipalityListExpectedVotesControl'
import { MunicipalityListLeadershipsControl } from '@/components/campaign/municipality/MunicipalityListLeadershipsControl'
import { MunicipalityListLevelControl } from '@/components/campaign/municipality/MunicipalityListLevelControl'
import { TerritorialClassCardReadout } from '@/components/campaign/municipality/MunicipalityListRowReadouts'
import { MunicipalityListTrendControl } from '@/components/campaign/municipality/MunicipalityListTrendControl'
import { MunicipalityListUpdateControl } from '@/components/campaign/municipality/MunicipalityListUpdateControl'
import { MunicipalityVotePositionReadout } from '@/components/campaign/municipality/MunicipalityVotePositionReadout'
import { TerritoryLink } from '@/components/campaign/municipality/TerritoryLink'
import {
  MunicipalityRelationAvatarStack,
  type MunicipalityRelationEntry,
} from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import {
  MunicipalityStateDeputyRelationCell,
  type MunicipalityStateDeputyCreateAction,
} from '@/components/campaign/shared/MunicipalityStateDeputyRelationCell'
import { VoteEstimateScenarioStrip } from '@/components/campaign/votePledge/VoteEstimateScenarioStrip'
import { Badge } from '@/components/ui/Badge'
import { SALVADOR_CITY_AGGREGATE_LABEL } from '@/lib/salvadorCity'
import {
  municipalityUpdatePolarityBadgeVariant,
  municipalityUpdatePolarityLabels,
} from '@/lib/schemas/municipalityUpdate'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import {
  municipalityGeographyParts,
  politicalTrendBadgeVariant,
  politicalTrendLabels,
} from '@/utilities/municipality/municipalityLabels'
import {
  formatMunicipalitySignalAgeLabel,
  isMunicipalitySignalCold,
  municipalitySignalAgeInDays,
} from '@/utilities/municipality/municipalitySignal'
import type {
  EligibleAdvisorOption,
  EligibleLeadershipOption,
  MunicipalityAdvisorSummary,
  MunicipalityLeadershipSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'
import { toMunicipalityPledgeCoverageView } from '@/utilities/votePledgeViews'

const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

type MunicipalityStaffFormAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<CampaignFormActionState>

type MunicipalityMobileCardProps = {
  municipality: MunicipalityListViewModel
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  isStaffView: boolean
  isCoordinator: boolean
  isCampaignUnrestricted: boolean
  canMoveEngagementLevel: boolean
  advisorOptions: EligibleAdvisorOption[]
  leadershipOptions: EligibleLeadershipOption[]
  stateDeputyOptions: StateDeputyRelationOption[]
  stateDeputyCommitAction: MunicipalityStaffFormAction
  stateDeputyCreateAction: MunicipalityStateDeputyCreateAction
  signalFormAction: MunicipalityStaffFormAction
}

/** Dense chip trigger styling shared by the Tendência/Nível chips (B193). */
const chipTriggerClassName = 'min-h-8 rounded-full px-2.5'

/** Ghost trigger styling for the read-only relation groups (no hover pill). */
const relationTriggerClassName = 'min-h-0 rounded-md bg-transparent px-0 hover:bg-transparent'

const ChipLabel = ({ children }: { children: ReactNode }) => (
  <span className="text-xs font-medium text-muted-foreground">{children}</span>
)

/** Read-only city rows render a plain dash everywhere a control would sit. */
const CityDash = () => <span className="text-muted-foreground">—</span>

const RelationGroupTrigger = ({
  label,
  entries,
  emptyState,
}: {
  label: string
  entries: MunicipalityRelationEntry[]
  emptyState: ReactNode
}) => (
  <div className="flex w-full min-w-0 flex-col gap-1.5">
    <ChipLabel>{label}</ChipLabel>
    <MunicipalityRelationAvatarStack entries={entries} emptyState={emptyState} wrap />
  </div>
)

/**
 * One third of the avatar row: the label + the relation control (or the
 * read-only display) for a single association type.
 */
const RelationGroup = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="min-w-0 flex-1">
    {children ?? (
      <div className="flex w-full flex-col gap-1.5">
        <ChipLabel>{label}</ChipLabel>
        <CityDash />
      </div>
    )}
  </div>
)

/**
 * B193 — the dense mobile municipality card: header with the 2022 vote
 * position on the right, the estimate scenario bar with the active marker,
 * classe/tendência/nível chips, three labelled avatar groups and the
 * expandable "Última atualização" footer. Every data point is its own edit
 * target (bottom sheet) — anything else on the card falls through to the
 * stretched município link and opens the detail page.
 */
export const MunicipalityMobileCard = ({
  municipality,
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
}: MunicipalityMobileCardProps) => {
  const [expanded, setExpanded] = useState(false)
  const isCity = municipality.isCity
  const isPriority = municipality.priority === 'alta' && isStaffView
  const { region, zoneSuffix } = municipalityGeographyParts(municipality)
  const position = municipality.votePosition2022
  const advisors = advisorEntriesFromIds(municipality.advisorIDs, advisorNamesById)
  const update = municipality.lastUpdate
  const updateAge = municipalitySignalAgeInDays(update?.createdAt ?? null)
  const updateIsCold = isMunicipalitySignalCold(updateAge)

  const registerCta = (
    <span className="flex min-h-11 w-full items-center justify-center rounded-md border border-dashed border-border px-3 text-sm font-medium">
      Registrar atualização
    </span>
  )

  const updateControl = (trigger: ReactNode) => (
    <MunicipalityListUpdateControl
      municipalityID={municipality.id}
      municipalitySlug={municipality.slug}
      municipalityName={municipality.name}
      lastSignalAt={municipality.lastSignalAt}
      variant="sheet"
      formAction={signalFormAction}
      isStaff={isCampaignUnrestricted}
    >
      {trigger}
    </MunicipalityListUpdateControl>
  )

  return (
    <article
      className={cn(
        'relative flex flex-col gap-3 rounded-none border-b p-4 last:border-b-0 md:rounded-xl md:border md:last:border-b',
        isPriority && !isCity && 'border-r-[6px] border-r-primary',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className="flex items-center gap-1.5 font-medium">
            <Link
              href={`/campanha/municipios/${municipality.slug}`}
              className="rounded-md after:absolute after:inset-0 after:rounded-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:after:rounded-xl"
            >
              {municipality.name}
            </Link>
            {isCity ? <Badge variant="secondary">Cidade</Badge> : null}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isCity ? (
              <>
                {SALVADOR_CITY_AGGREGATE_LABEL} · {region}
              </>
            ) : (
              <>
                <span className="relative">
                  <TerritoryLink region={region} />
                </span>
                {zoneSuffix ? ` ${zoneSuffix}` : null}
              </>
            )}
          </p>
        </div>
        {position ? (
          <div className="shrink-0">
            <MunicipalityVotePositionReadout
              position={position}
              layout="card"
              className="items-end text-right"
            />
          </div>
        ) : null}
      </div>

      {isStaffView ? (
        <>
          {!isCity ? (
            <MunicipalityListExpectedVotesControl
              municipalityID={municipality.id}
              municipalityName={municipality.name}
              expectedVotes={municipality.expectedVotes}
              pledgeCoverage={toMunicipalityPledgeCoverageView(municipality.pledges)}
              variant="sheet"
              trigger={(values, activeScenario) => (
                <VoteEstimateScenarioStrip
                  values={values}
                  activeScenario={activeScenario}
                  markerMode="active-only"
                  labelMode="all"
                  className="w-full"
                  stretch
                />
              )}
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-1.5">
            <TerritorialClassCardReadout municipality={municipality} />
            {isCity ? (
              <span className="inline-flex items-center gap-1.5">
                <ChipLabel>Tendência</ChipLabel>
                <Badge variant="outline">Não registrada</Badge>
              </span>
            ) : (
              <MunicipalityListTrendControl
                municipalityID={municipality.id}
                municipalityName={municipality.name}
                status={municipality.politicalTrendStatus}
                trendNote={municipality.politicalTrendNote}
                variant="sheet"
                triggerClassName={chipTriggerClassName}
                trigger={(trend) => (
                  <>
                    <ChipLabel>Tendência</ChipLabel>
                    <Badge
                      variant={trend.status ? politicalTrendBadgeVariant[trend.status] : 'outline'}
                    >
                      {trend.status ? politicalTrendLabels[trend.status] : 'Não registrada'}
                    </Badge>
                  </>
                )}
              />
            )}
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
                triggerClassName={chipTriggerClassName}
                trigger={(level, note) => (
                  <>
                    <ChipLabel>Nível</ChipLabel>
                    <MunicipalityLevelBadge level={level} note={note} layout="table" />
                  </>
                )}
              />
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <ChipLabel>Nível</ChipLabel>
                <MunicipalityLevelBadge
                  level={municipality.engagementLevel}
                  note={municipality.levelNote}
                  layout="table"
                />
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-start gap-3">
            <RelationGroup label="Assessores">
              {isCity ? null : isCoordinator ? (
                <MunicipalityListAdvisorsControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  currentAdvisorIDs={municipality.advisorIDs}
                  isPriority={isPriority}
                  advisorNamesById={advisorNamesById}
                  options={advisorOptions}
                  variant="sheet"
                  trigger={(entries, emptyState) => (
                    <RelationGroupTrigger
                      label="Assessores"
                      entries={entries}
                      emptyState={emptyState}
                    />
                  )}
                  triggerClassName={relationTriggerClassName}
                />
              ) : (
                <div className="flex w-full flex-col gap-1.5">
                  <ChipLabel>Assessores</ChipLabel>
                  <MunicipalityAdvisorAvatarStack
                    advisors={advisors}
                    isPriority={isPriority}
                    wrap
                  />
                </div>
              )}
            </RelationGroup>
            <RelationGroup label="Lideranças">
              {isCity ? null : (
                <MunicipalityListLeadershipsControl
                  municipalityID={municipality.id}
                  municipalityName={municipality.name}
                  currentLeadershipIDs={municipality.leadershipIDs}
                  leadershipNamesById={leadershipNamesById}
                  options={leadershipOptions}
                  variant="sheet"
                  trigger={(entries, emptyState) => (
                    <RelationGroupTrigger
                      label="Lideranças"
                      entries={entries}
                      emptyState={emptyState}
                    />
                  )}
                  triggerClassName={relationTriggerClassName}
                />
              )}
            </RelationGroup>
            <RelationGroup label="Dobradinhas">
              {isCity ? null : (
                <MunicipalityStateDeputyRelationCell
                  municipalityId={municipality.id}
                  municipalityName={municipality.name}
                  stateDeputyIDs={municipality.stateDeputyIDs}
                  options={stateDeputyOptions}
                  commitAction={stateDeputyCommitAction}
                  createAction={stateDeputyCreateAction}
                  editorVariant="sheet"
                  trigger={(entries, emptyState) => (
                    <RelationGroupTrigger
                      label="Dobradinhas"
                      entries={entries}
                      emptyState={emptyState}
                    />
                  )}
                  triggerClassName={relationTriggerClassName}
                />
              )}
            </RelationGroup>
          </div>

          {isCity ? (
            <CityDash />
          ) : update ? (
            <>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setExpanded((current) => !current)}
                className="relative inline-flex min-h-11 items-center justify-end gap-1.5 rounded-md text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    'inline-flex items-center gap-1 tabular-nums',
                    updateIsCold
                      ? 'font-medium text-estimate-pending-foreground'
                      : 'text-muted-foreground',
                  )}
                >
                  {updateIsCold ? (
                    <CircleAlertIcon className="size-3.5 shrink-0" aria-hidden="true" />
                  ) : null}
                  Última atualização {formatMunicipalitySignalAgeLabel(updateAge)}
                </span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className={cn(
                    'size-4 text-muted-foreground transition-transform',
                    expanded && 'rotate-180',
                  )}
                />
              </button>
              {expanded ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant={municipalityUpdatePolarityBadgeVariant[update.polarity]}>
                        {municipalityUpdatePolarityLabels[update.polarity]}
                      </Badge>
                      {update.urgent ? <Badge variant="destructive">Urgente</Badge> : null}
                      {update.adversarySignal ? <Badge variant="outline">Adversário</Badge> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {update.body ?? 'Sem texto.'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{update.authorName}</span>
                      <span aria-hidden="true"> · </span>
                      {dateTimeFormatter.format(new Date(update.createdAt))}
                    </p>
                  </div>
                  {updateControl(registerCta)}
                </div>
              ) : null}
            </>
          ) : (
            updateControl(registerCta)
          )}
        </>
      ) : null}
    </article>
  )
}
