'use client'

import type { MunicipalityListLeadershipsResponse } from '@/app/(campaign)/campanha/(app)/municipios/leaderships/types'
import { useMunicipalityLeadershipCreate } from '@/components/campaign/municipality/MunicipalityLeadershipCreateProvider'
import type { CampaignCellEditOverlayVariant } from '@/components/campaign/shared/CampaignCellEditOverlay'
import type { MunicipalityRelationEntry } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import {
  MunicipalityRelationEditor,
  type MunicipalityRelationMutationResult,
  type MunicipalityRelationTriggerProps,
} from '@/components/campaign/shared/MunicipalityRelationEditor'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type {
  EligibleLeadershipOption,
  MunicipalityLeadershipSummary,
} from '@/utilities/municipality/municipalityViewModels'

const LEADERSHIPS_ENDPOINT = '/campanha/municipios/leaderships'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar as lideranças. Tente novamente.'

type MunicipalityListLeadershipsControlProps = MunicipalityRelationTriggerProps & {
  municipalityID: number
  municipalityName: string
  currentLeadershipIDs: number[]
  leadershipNamesById: ReadonlyMap<number, MunicipalityLeadershipSummary>
  options: EligibleLeadershipOption[]
  variant: CampaignCellEditOverlayVariant
}

const entryOf = (option: { id: number; name: string }): MunicipalityRelationEntry => ({
  id: option.id,
  label: option.name,
})

export const MunicipalityListLeadershipsControl = ({
  municipalityID,
  municipalityName,
  currentLeadershipIDs,
  leadershipNamesById,
  options,
  variant,
  trigger,
  triggerClassName,
}: MunicipalityListLeadershipsControlProps) => {
  const createBridge = useMunicipalityLeadershipCreate()
  const createdOptions = createBridge?.createdOptions ?? []

  const toggle = async (
    leadershipID: number,
    assigned: boolean,
  ): Promise<MunicipalityRelationMutationResult> => {
    const { ok, payload } = await postCampaignJson<MunicipalityListLeadershipsResponse>(
      LEADERSHIPS_ENDPOINT,
      { municipalityId: municipalityID, leadershipId: leadershipID, assigned },
    )
    if (!ok || payload.status !== 'success') {
      return {
        status: 'error',
        message: payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
      }
    }
    return { status: 'success', selectedIDs: payload.leadershipIDs }
  }

  const create = async (name: string): Promise<MunicipalityRelationMutationResult> => {
    const { ok, payload } = await postCampaignJson<MunicipalityListLeadershipsResponse>(
      LEADERSHIPS_ENDPOINT,
      { municipalityId: municipalityID, name },
    )
    if (!ok || payload.status !== 'success' || !payload.createdLeadership) {
      return {
        status: 'error',
        message: payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
      }
    }
    return {
      status: 'success',
      selectedIDs: payload.leadershipIDs,
      createdEntry: entryOf(payload.createdLeadership),
    }
  }

  return (
    <MunicipalityRelationEditor
      municipalityName={municipalityName}
      currentIDs={currentLeadershipIDs}
      knownEntries={[...leadershipNamesById.values()].map(entryOf)}
      options={[...options, ...createdOptions].map(entryOf)}
      variant={variant}
      title="Gerenciar lideranças"
      description="A liderança passa a aparecer também na ficha dela, na área Lideranças."
      searchPlaceholder="Buscar liderança…"
      searchLabel="Buscar liderança"
      savingMessage="Salvando lideranças."
      saveErrorMessage={SAVE_ERROR_MESSAGE}
      triggerLabel={(entries) =>
        `Editar lideranças em ${municipalityName} — ${
          entries.length ? entries.map((entry) => entry.label).join(', ') : 'nenhuma'
        }`
      }
      emptyState={<span className="text-sm text-muted-foreground">Nenhuma</span>}
      trigger={trigger}
      triggerClassName={triggerClassName}
      createLabel={(name) => `Criar liderança “${name}”`}
      onToggle={toggle}
      onCreate={create}
      onCreated={(entry) =>
        createBridge?.registerCreatedLeadership({ id: entry.id, name: entry.label })
      }
    />
  )
}
