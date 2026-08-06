'use client'

import { ExternalLinkIcon } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useMemo, useState } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import { fieldError } from '@/utilities/campaignFormFields'
import type { TourStopRole } from '@/utilities/visit/visitPlannerViews'
import {
  MAX_TOUR_NAME_LENGTH,
  MAX_TOUR_STOPS,
  tourStopRoleDescriptions,
  tourStopRoleLabels,
} from '@/utilities/visit/visitPlannerViews'

/**
 * One candidate stop, already reduced to what the decision needs. Numbers arrive
 * formatted and the dossier href arrives built: the canonical serializers drag
 * the município catalog with them, and this is a client component (the B14
 * lesson — 21 kB of First Load JS for one link).
 */
export type TourStopOption = {
  municipalityID: number
  slug: string
  name: string
  role: TourStopRole
  suggested: boolean
  /** Activity tags the stop generates, derived from its role. */
  tags: string[]
  metCount: number
  conditionCount: number
  unmetConditionLabels: string[]
  deficitLabel: string
  contraindicationReason: string | null
  dossierHref: string
}

const StopRow = ({
  stop,
  checked,
  onToggle,
}: {
  stop: TourStopOption
  checked: boolean
  onToggle: (checked: boolean) => void
}) => {
  const checkboxId = `tour-stop-${stop.slug}`

  return (
    <li className="flex flex-col gap-3 p-4 data-[checked=false]:bg-muted/20" data-checked={checked}>
      <div className="flex items-start gap-3">
        <Checkbox
          id={checkboxId}
          checked={checked}
          onCheckedChange={(next) => onToggle(next === true)}
          className="mt-1.5"
        />
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor={checkboxId} className="text-sm font-medium">
              {stop.name}
            </label>
            <Badge variant={stop.role === 'ancora' ? 'default' : 'outline'}>
              {tourStopRoleLabels[stop.role]}
            </Badge>
            <span className="text-xs text-muted-foreground tabular-nums">
              {stop.metCount} de {stop.conditionCount} condições
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{tourStopRoleDescriptions[stop.role]}</p>
          <p className="text-xs text-muted-foreground">
            Faltam <span className="tabular-nums">{stop.deficitLabel}</span> votos para a meta.
            {stop.unmetConditionLabels.length > 0
              ? ` Ainda não atende: ${stop.unmetConditionLabels.join(', ')}.`
              : ' Atende as cinco condições.'}
          </p>
          {stop.contraindicationReason ? (
            <p className="text-xs text-estimate-pending-foreground">
              {stop.contraindicationReason}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={stop.dossierHref}
              className="text-xs font-medium text-primary underline underline-offset-4"
            >
              Ver dossiê
              <ExternalLinkIcon aria-hidden="true" className="ml-1 inline size-3" />
            </Link>
            <span className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
              Tags:{' '}
              {stop.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag}
                </Badge>
              ))}
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * Interactions 2 and 3 of the composer: review the proposed composition
 * (âncora + satélites + semente, all pre-selected) and generate the drafts.
 *
 * It is a SUGGESTION and it says so — the numbers rank, the coordination
 * decides, and nothing is written until this form is submitted (P25: no
 * automatic allocation without a human in the loop).
 */
export const TourComposerForm = ({
  region,
  stops,
  defaultTourName,
  formAction,
}: {
  region: string
  stops: TourStopOption[]
  defaultTourName: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}) => {
  const [state, submitAction, isPending] = useActionState(formAction, {})
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>(() =>
    stops.filter((stop) => stop.suggested).map((stop) => stop.slug),
  )

  const selectedSet = useMemo(() => new Set(selectedSlugs), [selectedSlugs])

  const stopsJson = useMemo(
    () =>
      JSON.stringify(
        stops
          .filter((stop) => selectedSet.has(stop.slug))
          .map((stop) => ({
            municipality: stop.municipalityID,
            tags: stop.tags,
          })),
      ),
    [stops, selectedSet],
  )

  const overCap = selectedSlugs.length > MAX_TOUR_STOPS
  const canSubmit = selectedSlugs.length > 0 && !overCap

  const toggleStop = (slug: string, checked: boolean) =>
    setSelectedSlugs((current) =>
      checked ? [...current, slug] : current.filter((entry) => entry !== slug),
    )

  return (
    <form action={submitAction} className="flex flex-col gap-5">
      <input type="hidden" name="stopsJson" value={stopsJson} />

      <div className="rounded-xl border">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b p-4">
          <h2 className="text-base font-medium">Paradas propostas em {region}</h2>
          <span className="text-sm text-muted-foreground tabular-nums">
            {selectedSlugs.length} selecionada{selectedSlugs.length === 1 ? '' : 's'}
          </span>
        </div>
        <ul className="flex list-none flex-col divide-y pl-0 [&>li]:mt-0">
          {stops.map((stop) => (
            <StopRow
              key={stop.slug}
              stop={stop}
              checked={selectedSet.has(stop.slug)}
              onToggle={(checked) => toggleStop(stop.slug, checked)}
            />
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="tour-name">Nome do giro</FieldLabel>
          <Input
            id="tour-name"
            name="tourName"
            defaultValue={defaultTourName}
            maxLength={MAX_TOUR_NAME_LENGTH}
            required
            className="min-h-11"
          />
          <FieldDescription>
            Cada compromisso recebe este nome mais o município — assim o giro se lê como um conjunto
            na lista de Atividades.
          </FieldDescription>
          {fieldError(state.fieldErrors, 'tourName') ? (
            <FieldError>{fieldError(state.fieldErrors, 'tourName')}</FieldError>
          ) : null}
        </Field>
        <Field>
          <FieldLabel htmlFor="tour-note">Nota de janela política</FieldLabel>
          <Textarea id="tour-note" name="note" rows={4} maxLength={4000} />
          <FieldDescription>
            Vai na descrição de cada compromisso: com quem falar, o que já foi combinado, o que não
            pode ser dito.
          </FieldDescription>
        </Field>
      </div>

      {fieldError(state.fieldErrors, 'stopsJson') ? (
        <Alert variant="destructive">
          <AlertDescription>{fieldError(state.fieldErrors, 'stopsJson')}</AlertDescription>
        </Alert>
      ) : null}
      {state.message ? (
        <Alert variant="destructive">
          <AlertTitle>Nada foi gravado</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-col gap-2">
        <Button type="submit" disabled={isPending || !canSubmit} className="min-h-11 w-fit">
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Gerar {selectedSlugs.length} rascunho{selectedSlugs.length === 1 ? '' : 's'}
        </Button>
        <p className="text-xs text-muted-foreground" aria-live="polite">
          {selectedSlugs.length === 0
            ? 'Selecione ao menos uma parada.'
            : overCap
              ? `Um giro é um dia ou dois: escolha no máximo ${MAX_TOUR_STOPS} paradas.`
              : 'Os compromissos entram com presença do candidato marcada. A data e o horário você define em cada atividade.'}
        </p>
      </div>
    </form>
  )
}
