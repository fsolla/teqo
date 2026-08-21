'use client'

import type { MunicipalityStateDeputyCreateResult } from '@/app/(campaign)/campanha/actions/stateDeputy'
import type { CampaignCellEditOverlayVariant } from '@/components/campaign/shared/CampaignCellEditOverlay'
import type { MunicipalityRelationEntry } from '@/components/campaign/shared/MunicipalityRelationAvatarStack'
import {
  MunicipalityRelationEditor,
  type MunicipalityRelationMutationResult,
  type MunicipalityRelationTriggerProps,
} from '@/components/campaign/shared/MunicipalityRelationEditor'
import { stateDeputyDisplayName } from '@/lib/stateDeputyNameParty'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { firstFormActionMessage } from '@/utilities/campaignFormFields'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'

type MunicipalityStateDeputyRelationCellProps = MunicipalityRelationTriggerProps & {
  municipalityId: number
  municipalityName: string
  stateDeputyIDs: number[]
  options: StateDeputyRelationOption[]
  commitAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  createAction: MunicipalityStateDeputyCreateAction
  editorVariant: CampaignCellEditOverlayVariant
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`). */
  readOnly?: boolean
}

export type MunicipalityStateDeputyCreateAction = (
  state: CampaignFormActionState,
  formData: FormData,
) => Promise<
  CampaignFormActionState & { stateDeputy?: MunicipalityStateDeputyCreateResult['stateDeputy'] }
>

const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar as dobradinhas. Tente novamente.'
const CREATE_ERROR_MESSAGE = 'Não foi possível criar a dobradinha. Tente novamente.'

const entriesByOptions = new WeakMap<
  readonly StateDeputyRelationOption[],
  MunicipalityRelationEntry[]
>()

const entryOf = (option: StateDeputyRelationOption): MunicipalityRelationEntry => ({
  id: option.id,
  label: option.name,
  initialsLabel: option.plainName,
  searchText: `${option.plainName} ${option.party ?? ''}`,
  href: `/campanha/dobradinhas/${option.id}`,
})

const entriesFor = (options: readonly StateDeputyRelationOption[]) => {
  const cached = entriesByOptions.get(options)
  if (cached) return cached
  const entries = options.map(entryOf)
  entriesByOptions.set(options, entries)
  return entries
}

export const MunicipalityStateDeputyRelationCell = ({
  municipalityId,
  municipalityName,
  stateDeputyIDs,
  options,
  commitAction,
  createAction,
  editorVariant,
  trigger,
  triggerClassName,
  readOnly = false,
}: MunicipalityStateDeputyRelationCellProps) => {
  const toggle = async (
    stateDeputyID: number,
    assigned: boolean,
  ): Promise<MunicipalityRelationMutationResult> => {
    const formData = new FormData()
    formData.set('municipalityId', String(municipalityId))
    formData.set('stateDeputyId', String(stateDeputyID))
    formData.set('assigned', assigned ? 'true' : 'false')
    const result = await commitAction({}, formData)
    return result.status === 'success'
      ? { status: 'success' }
      : { status: 'error', message: firstFormActionMessage(result) ?? SAVE_ERROR_MESSAGE }
  }

  const create = async (rawName: string): Promise<MunicipalityRelationMutationResult> => {
    const formData = new FormData()
    formData.set('municipalityId', String(municipalityId))
    formData.set('rawName', rawName)
    const result = await createAction({}, formData)
    if (result.status !== 'success' || !result.stateDeputy) {
      return {
        status: 'error',
        message: firstFormActionMessage(result) ?? CREATE_ERROR_MESSAGE,
      }
    }
    const created = result.stateDeputy
    return {
      status: 'success',
      createdEntry: {
        id: created.id,
        label: stateDeputyDisplayName(created.name, created.party),
        initialsLabel: created.name,
        searchText: `${created.name} ${created.party ?? ''}`,
        href: `/campanha/dobradinhas/${created.id}`,
      },
    }
  }

  return (
    <MunicipalityRelationEditor
      municipalityName={municipalityName}
      currentIDs={stateDeputyIDs}
      options={entriesFor(options)}
      variant={editorVariant}
      title="Gerenciar dobradinhas"
      description="Vincule os deputados estaduais que fazem dobradinha neste município."
      searchPlaceholder="Buscar dobradinha…"
      searchLabel="Buscar dobradinha"
      savingMessage="Salvando dobradinhas."
      saveErrorMessage={SAVE_ERROR_MESSAGE}
      createErrorMessage={CREATE_ERROR_MESSAGE}
      triggerLabel={(entries) =>
        `Editar dobradinhas em ${municipalityName}${
          entries.length ? ` — ${entries.map((entry) => entry.label).join(', ')}` : ''
        }`
      }
      emptyState={<span className="text-sm text-muted-foreground">—</span>}
      trigger={trigger}
      triggerClassName={triggerClassName}
      createLabel={(name) => `Criar dobradinha “${name}”`}
      createMaxLength={120}
      sortSelected={false}
      readOnly={readOnly}
      onToggle={toggle}
      onCreate={create}
    />
  )
}
