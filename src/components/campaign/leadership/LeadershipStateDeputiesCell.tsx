'use client'

import { PencilIcon, XIcon } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { StateDeputyChips } from '@/components/campaign/stateDeputy/StateDeputyChips'
import { Badge } from '@/components/ui/Badge'
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/Command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { sameIdSet } from '@/lib/sameIdSet'
import { cn } from '@/lib/utils'
import { matchesAtWordStart } from '@/lib/wordStartFilter'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import type { StateDeputyRelationOption } from '@/utilities/campaignRelationOptions'
import type { StateDeputySummary } from '@/utilities/stateDeputyData'

const SAVE_ERROR_MESSAGE = 'Não foi possível atualizar as dobradinhas. Tente novamente.'

type LeadershipStateDeputiesCellProps = {
  leadershipId: number
  stateDeputies: StateDeputySummary[]
  options: StateDeputyRelationOption[]
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

/**
 * "Dobradinhas" column cell (B31) — read chips reuse `StateDeputyChips`
 * (same look as the leadership ficha / município strategy card); a separate
 * pencil affordance opens the Popover+Command editor, mirroring the
 * mechanics of `MunicipalityListAdvisorsControl` (B27) but writing through a
 * server action + `useTransition` like `AdvisorMunicipalityCell` (B19)
 * instead of a JSON endpoint. The catalog arrives as a prop, computed once
 * by the page's column factory (mirrors `municipalityListColumns`) instead
 * of a table-scoped context — one static catalog, one place that builds it.
 */
export const LeadershipStateDeputiesCell = ({
  leadershipId,
  stateDeputies,
  options,
  membershipAction,
}: LeadershipStateDeputiesCellProps) => {
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<StateDeputySummary[]>(stateDeputies)
  const [query, setQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const lastPropsRef = useRef(stateDeputies)

  // Adopt server props only when they change from outside (navigation / RSC
  // refresh) — an in-flight delta's optimistic state must not be clobbered by
  // a prop identical in content to what we already had.
  useEffect(() => {
    const propIds = stateDeputies.map((deputy) => deputy.id)
    if (
      sameIdSet(
        propIds,
        lastPropsRef.current.map((deputy) => deputy.id),
      )
    )
      return
    lastPropsRef.current = stateDeputies
    setCurrent(stateDeputies)
  }, [stateDeputies])

  const currentIds = useMemo(() => new Set(current.map((deputy) => deputy.id)), [current])
  const optionById = useMemo(() => new Map(options.map((option) => [option.id, option])), [options])

  const filteredOptions = useMemo(
    () =>
      options.filter(
        (option) => !currentIds.has(option.id) && matchesAtWordStart(option.name, query),
      ),
    [options, currentIds, query],
  )

  const toggle = (stateDeputyId: number, assigned: boolean) => {
    // The removed summary is captured up front (not re-derived from the
    // catalog) so a failed removal can be undone even for a deputy that has
    // since dropped out of `options` — same asymmetry as the `optionById`
    // lookup below, which only needs to resolve *additions*.
    const removedSummary = assigned
      ? undefined
      : current.find((deputy) => deputy.id === stateDeputyId)
    if (assigned && !optionById.has(stateDeputyId)) return

    setErrorMessage(null)
    setCurrent((previous) => {
      if (assigned) {
        if (previous.some((deputy) => deputy.id === stateDeputyId)) return previous
        const option = optionById.get(stateDeputyId)
        if (!option) return previous
        return [
          ...previous,
          { id: stateDeputyId, name: option.plainName, slug: option.slug, party: option.party },
        ]
      }
      return previous.filter((deputy) => deputy.id !== stateDeputyId)
    })
    setQuery('')

    const formData = new FormData()
    formData.set('leadershipId', String(leadershipId))
    formData.set('stateDeputyId', String(stateDeputyId))
    formData.set('assigned', assigned ? 'true' : 'false')

    startTransition(async () => {
      const result = await membershipAction({}, formData)
      if (result.status === 'success') return
      // Undo only this delta — not the whole cell back to `lastPropsRef` —
      // so a failed toggle can't wipe an earlier toggle from the same batch
      // that already saved successfully.
      setCurrent((previous) =>
        assigned
          ? previous.filter((deputy) => deputy.id !== stateDeputyId)
          : removedSummary
            ? [...previous, removedSummary]
            : previous,
      )
      const message = result.message ?? SAVE_ERROR_MESSAGE
      setErrorMessage(message)
      toast.error(message)
    })
  }

  const statusMessage = errorMessage ? errorMessage : isPending ? 'Salvando dobradinhas.' : ''

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.length > 0 ? (
        <StateDeputyChips deputies={current} />
      ) : (
        <span className="text-sm text-muted-foreground">—</span>
      )}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-label="Editar dobradinhas"
            className={cn(
              'inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              open ? 'bg-muted/60 text-foreground' : undefined,
            )}
          >
            <PencilIcon className="size-3.5" aria-hidden="true" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <div className="relative flex flex-col gap-2 p-3 pb-0">
            <p className="text-sm font-medium">Atribuir dobradinhas</p>
            <p className="text-xs text-muted-foreground">
              Deputados estaduais em dobradinha com esta liderança.
            </p>
            {isPending ? (
              <Spinner
                className="absolute top-3 right-3 size-3.5 text-muted-foreground"
                aria-label="Salvando dobradinhas"
              />
            ) : null}
          </div>
          {current.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 px-3 pt-2">
              {current.map((deputy) => (
                <button
                  key={deputy.id}
                  type="button"
                  aria-label={`Remover ${deputy.name}`}
                  onClick={() => toggle(deputy.id, false)}
                >
                  <Badge
                    variant="secondary"
                    className="max-w-full cursor-pointer gap-1 pr-1 font-normal hover:bg-destructive/15"
                  >
                    <span className="truncate">
                      {deputy.name}
                      {deputy.party ? ` (${deputy.party})` : ''}
                    </span>
                    <XIcon className="size-3 shrink-0 opacity-70" aria-hidden="true" />
                  </Badge>
                </button>
              ))}
            </div>
          ) : null}
          <Command shouldFilter={false} className="mt-1">
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar deputado estadual…"
              aria-label="Buscar deputado estadual"
            />
            <CommandList>
              {filteredOptions.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Nenhum resultado.
                </p>
              ) : (
                filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={`state-deputy-${option.id}`}
                    onSelect={() => toggle(option.id, true)}
                  >
                    <span className="truncate">{option.name}</span>
                  </CommandItem>
                ))
              )}
            </CommandList>
          </Command>
          <p className="sr-only" aria-live="polite">
            {statusMessage}
          </p>
        </PopoverContent>
      </Popover>
    </div>
  )
}
