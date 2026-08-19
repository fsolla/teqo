'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { Spinner } from '@/components/ui/Spinner'
import {
  ADVISOR_EDITING_OPTIONS,
  ADVISOR_VISIBILITY_OPTIONS,
  type AdvisorEditing,
  type AdvisorVisibility,
} from '@/lib/campaignAdvisorProfile'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type AdvisorPermissionEditorProps = {
  visibility: AdvisorVisibility
  editing: AdvisorEditing
  /**
   * Present = the profile is saved on the server through `formAction`;
   * absent = draft mode (new-advisor row), where the values only update local
   * state via `onDraftChange`.
   */
  advisorId?: number
  formAction?: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  onDraftChange?: (visibility: AdvisorVisibility, editing: AdvisorEditing) => void
  /** Fired after a successful save (or draft change) — closes the popover. */
  onSaved?: () => void
  /** When provided, renders a "Cancelar" button (popover footer). */
  onCancel?: () => void
  /** The popover renders its own heading; the detail section has its own h2. */
  showHeading?: boolean
}

const EDITING_NOTE =
  'Demandas seguem regra própria: só quem é responsável pela demanda (e candidato/coordenador) a vê — mesmo com visão "Tudo". Decisões de coordenação (contas, carteiras, nível de envolvimento, demandas escaladas) continuam restritas a coordenador e candidato.'

/**
 * C141 — the Visão × Edição editor, shared by the advisors list popover, the
 * advisor detail section and the new-advisor draft row. Only coherent
 * combinations are offered: picking Edição "Tudo" raises Visão to "Tudo", and
 * lowering Visão to "Carteira" drops Edição to "Carteira".
 */
export const AdvisorPermissionEditor = ({
  visibility: initialVisibility,
  editing: initialEditing,
  advisorId,
  formAction,
  onDraftChange,
  onSaved,
  onCancel,
  showHeading = true,
}: AdvisorPermissionEditorProps) => {
  const [visibility, setVisibility] = useState(initialVisibility)
  const [editing, setEditing] = useState(initialEditing)
  const [isSaving, startSave] = useTransition()

  const updateEditing = (next: AdvisorEditing) => {
    if (next === 'tudo') setVisibility('tudo')
    setEditing(next)
  }

  const updateVisibility = (next: AdvisorVisibility) => {
    setVisibility(next)
    if (next === 'carteira' && editing === 'tudo') setEditing('carteira')
  }

  const save = () => {
    if (advisorId === undefined || formAction === undefined) {
      onDraftChange?.(visibility, editing)
      onSaved?.()
      return
    }

    const formData = new FormData()
    formData.set('advisorId', String(advisorId))
    formData.set('visibility', visibility)
    formData.set('editing', editing)

    startSave(async () => {
      const result = await formAction({}, formData)
      if (result.status === 'success') {
        toast.success(result.message ?? 'Permissão atualizada.')
        onSaved?.()
      } else {
        toast.error(result.message ?? 'Não foi possível atualizar a permissão.')
      }
    })
  }

  const selectedVisibility = ADVISOR_VISIBILITY_OPTIONS.find(
    (option) => option.value === visibility,
  )
  const selectedEditing = ADVISOR_EDITING_OPTIONS.find((option) => option.value === editing)

  return (
    <div className="flex flex-col gap-4">
      {showHeading ? (
        <div>
          <p className="text-sm font-bold">Permissão da conta</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Vale para todas as telas do /campanha.
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="advisor-permission-visibility" className="text-xs font-bold">
          Visão
        </label>
        <NativeSelect
          id="advisor-permission-visibility"
          value={visibility}
          onChange={(event) => updateVisibility(event.currentTarget.value as AdvisorVisibility)}
          className="w-full"
        >
          {ADVISOR_VISIBILITY_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label} — {option.description}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {selectedVisibility?.description}.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="advisor-permission-editing" className="text-xs font-bold">
          Edição
        </label>
        <NativeSelect
          id="advisor-permission-editing"
          value={editing}
          onChange={(event) => updateEditing(event.currentTarget.value as AdvisorEditing)}
          className="w-full"
        >
          {ADVISOR_EDITING_OPTIONS.map((option) => (
            <NativeSelectOption key={option.value} value={option.value}>
              {option.label} — {option.description}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {selectedEditing?.description}.
        </p>
      </div>

      <div className="rounded-md bg-muted px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
        {EDITING_NOTE}
      </div>

      <div className="flex justify-end gap-2">
        {onCancel ? (
          <Button type="button" variant="outline" className="min-h-9" onClick={onCancel}>
            Cancelar
          </Button>
        ) : null}
        <Button type="button" className="min-h-9" onClick={save} disabled={isSaving}>
          {isSaving ? <Spinner className="size-4" aria-hidden="true" /> : null}
          Salvar
        </Button>
      </div>
    </div>
  )
}
