'use client'

import type { ReactNode } from 'react'

import { MunicipalityMobileCard } from '@/components/campaign/municipality/MunicipalityMobileCard'
import type { MunicipalityStateDeputyCreateAction } from '@/components/campaign/shared/MunicipalityStateDeputyRelationCell'
import type { AdvisorEditingScope } from '@/lib/campaignAdvisorProfile'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import type {
  EligibleAdvisorOption,
  EligibleLeadershipOption,
  MunicipalityAdvisorSummary,
  MunicipalityLeadershipSummary,
  MunicipalityListViewModel,
} from '@/utilities/municipality/municipalityViewModels'

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
  /** C142 — the UI write scope for the mobile card quick edits. */
  editingScope: AdvisorEditingScope
  portfolioIDs: ReadonlySet<number> | null
}

/**
 * B193 dense mobile cards with sheet-variant quick edits (edit-where-you-see).
 * Wrapped by `MunicipalityListMobileSection`, which hosts a single shared
 * Drawer. Each card is its own component so the "Última atualização" expansion
 * keeps per-card state.
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
  editingScope,
  portfolioIDs,
}: MunicipalityListMobileCardsProps) => (
  <div
    data-view="mobile-cards"
    // B184 — borderless, edge-to-edge cards below `md`: no page breathing room
    // (`-mx-4` bleeds past the scrollport's mobile `p-4`), one horizontal line
    // between cards (`border-b`), nothing between the last card and the footer.
    // The `md:` variants restore the framed desktop look for the narrow-desktop
    // window that still sees this tree (container < 48rem).
    className="flex flex-col gap-0 -mx-4 md:mx-0 md:gap-4 @min-[48rem]/municipality-list:hidden"
  >
    {municipalities.length === 0 ? emptySlot : null}
    {municipalities.map((municipality) => (
      <MunicipalityMobileCard
        key={municipality.id}
        municipality={municipality}
        advisorNamesById={advisorNamesById}
        leadershipNamesById={leadershipNamesById}
        isStaffView={isStaffView}
        isCoordinator={isCoordinator}
        canMoveEngagementLevel={canMoveEngagementLevel}
        advisorOptions={advisorOptions}
        leadershipOptions={leadershipOptions}
        stateDeputyOptions={stateDeputyOptions}
        stateDeputyCommitAction={stateDeputyCommitAction}
        stateDeputyCreateAction={stateDeputyCreateAction}
        signalFormAction={signalFormAction}
        isCampaignUnrestricted={isCampaignUnrestricted}
        editingScope={editingScope}
        portfolioIDs={portfolioIDs}
      />
    ))}
  </div>
)
