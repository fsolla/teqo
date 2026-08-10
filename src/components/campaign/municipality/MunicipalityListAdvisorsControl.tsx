'use client'

import type { MunicipalityListAdvisorsResponse } from '@/app/(campaign)/campanha/(app)/municipios/advisors/types'
import { MissingAdvisorBadge } from '@/components/campaign/municipality/MunicipalityAdvisorAvatarStack'
import { useMunicipalityAdvisorCreate } from '@/components/campaign/municipality/MunicipalityAdvisorCreateProvider'
import type { CampaignCellEditOverlayVariant } from '@/components/campaign/shared/CampaignCellEditOverlay'
import type { MunicipalityRelationEntry } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import {
  MunicipalityRelationEditor,
  type MunicipalityRelationMutationResult,
  type MunicipalityRelationTriggerProps,
} from '@/components/campaign/shared/MunicipalityRelationEditor'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type {
  EligibleAdvisorOption,
  MunicipalityAdvisorSummary,
} from '@/utilities/municipality/municipalityViewModels'

const ADVISORS_ENDPOINT = '/campanha/municipios/advisors'
const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar os assessores. Tente novamente.'

type MunicipalityListAdvisorsControlProps = MunicipalityRelationTriggerProps & {
  municipalityID: number
  municipalityName: string
  currentAdvisorIDs: number[]
  isPriority: boolean
  advisorNamesById: ReadonlyMap<number, MunicipalityAdvisorSummary>
  options: EligibleAdvisorOption[]
  variant: CampaignCellEditOverlayVariant
}

const entryOf = (option: { id: number; name: string }): MunicipalityRelationEntry => ({
  id: option.id,
  label: option.name,
})

export const MunicipalityListAdvisorsControl = ({
  municipalityID,
  municipalityName,
  currentAdvisorIDs,
  isPriority,
  advisorNamesById,
  options,
  variant,
  trigger,
  triggerClassName,
}: MunicipalityListAdvisorsControlProps) => {
  const createBridge = useMunicipalityAdvisorCreate()
  const createdOptions = createBridge?.createdOptions ?? []

  const toggle = async (
    advisorID: number,
    assigned: boolean,
  ): Promise<MunicipalityRelationMutationResult> => {
    const { ok, payload } = await postCampaignJson<MunicipalityListAdvisorsResponse>(
      ADVISORS_ENDPOINT,
      { municipalityId: municipalityID, advisorId: advisorID, assigned },
    )
    if (!ok || payload.status !== 'success') {
      return {
        status: 'error',
        message: payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
      }
    }
    return { status: 'success', selectedIDs: payload.advisors }
  }

  const create = async (name: string): Promise<MunicipalityRelationMutationResult> => {
    const { ok, payload } = await postCampaignJson<MunicipalityListAdvisorsResponse>(
      ADVISORS_ENDPOINT,
      { municipalityId: municipalityID, name },
    )
    if (!ok || payload.status !== 'success' || !payload.createdAdvisor) {
      return {
        status: 'error',
        message: payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
      }
    }
    return {
      status: 'success',
      selectedIDs: payload.advisors,
      createdEntry: entryOf(payload.createdAdvisor),
    }
  }

  return (
    <MunicipalityRelationEditor
      municipalityName={municipalityName}
      currentIDs={currentAdvisorIDs}
      knownEntries={[...advisorNamesById.values()].map(entryOf)}
      options={[...options, ...createdOptions].map((option) => ({
        ...entryOf(option),
        optionSuffix: option.isCurrent ? ' (você)' : undefined,
      }))}
      variant={variant}
      title="Atribuir assessores"
      description="O assessor vê e gerencia somente os municípios que administra."
      searchPlaceholder="Buscar assessor…"
      searchLabel="Buscar assessor"
      savingMessage="Salvando assessores."
      saveErrorMessage={SAVE_ERROR_MESSAGE}
      triggerLabel={(entries) =>
        `Editar assessores em ${municipalityName} — ${
          entries.length
            ? entries.map((entry) => entry.label).join(', ')
            : isPriority
              ? 'sem responsável'
              : 'sem assessor'
        }`
      }
      emptyState={<MissingAdvisorBadge isPriority={isPriority} />}
      trigger={trigger}
      triggerClassName={triggerClassName}
      createLabel={(name) => `Criar assessor “${name}”`}
      createMaxLength={160}
      onToggle={toggle}
      onCreate={create}
      onCreated={(entry) =>
        createBridge?.registerCreatedAdvisor({ id: entry.id, name: entry.label, isCurrent: false })
      }
    />
  )
}
