'use client'

import { useEffect, useState } from 'react'

import { CalendarFeedButton } from '@/components/campaign/activity/CalendarFeedButton'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useCampaignListFilterNavigation } from '@/components/campaign/shared/useCampaignListFilterNavigation'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/Checkbox'
import { NativeSelect, NativeSelectOption } from '@/components/ui/native-select'
import { buildActivityAgendaHref, type ActivityAgendaState } from '@/utilities/activityUi'

type CalendarFeedSummary = {
  id: number
  label: string
  createdAt: string
}

type ActivityAgendaFiltersProps = {
  state: ActivityAgendaState
  municipalityOptions: RelationOption[]
  knownTags: string[]
  feeds?: CalendarFeedSummary[]
  onCreateFeed?: (
    label: string,
  ) => Promise<{ ok: true; feedUrl: string } | { ok: false; message: string }>
  onRevokeFeed?: (feedId: number) => Promise<{ ok: boolean }>
}

export const ActivityAgendaFilters = ({
  state,
  municipalityOptions,
  knownTags,
  feeds = [],
  onCreateFeed,
  onRevokeFeed,
}: ActivityAgendaFiltersProps) => {
  const { navigate, isPending } = useCampaignListFilterNavigation({
    state,
    toHref: buildActivityAgendaHref,
  })
  const [draft, setDraft] = useState(state)

  useEffect(() => setDraft(state), [state])

  const update = (next: ActivityAgendaState) => {
    setDraft(next)
    navigate(next)
  }

  const hasFilters = Boolean(draft.municipality || draft.deputyPresent || draft.tag)

  return (
    <section
      aria-label="Filtros da agenda"
      aria-busy={isPending}
      className="rounded-xl border bg-card p-4 transition-opacity data-[pending=true]:opacity-70"
      data-pending={isPending}
    >
      <div className="grid gap-4 md:grid-cols-[minmax(12rem,1fr)_minmax(11rem,0.7fr)_auto_auto] md:items-end">
        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="agenda-municipality">
            Município
          </label>
          <NativeSelect
            id="agenda-municipality"
            value={draft.municipality ? String(draft.municipality) : ''}
            onChange={(event) => {
              const municipality = Number(event.target.value)
              update({
                ...draft,
                municipality: municipality > 0 ? municipality : undefined,
              })
            }}
            className="w-full **:data-[slot=native-select]:min-h-11"
          >
            <NativeSelectOption value="">Todos os municípios</NativeSelectOption>
            {municipalityOptions.map((option) => (
              <NativeSelectOption key={option.id} value={String(option.id)}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <div className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor="agenda-tag">
            Tag
          </label>
          <NativeSelect
            id="agenda-tag"
            value={draft.tag ?? ''}
            onChange={(event) => update({ ...draft, tag: event.target.value || undefined })}
            className="w-full **:data-[slot=native-select]:min-h-11"
          >
            <NativeSelectOption value="">Todas as tags</NativeSelectOption>
            {knownTags.map((tag) => (
              <NativeSelectOption key={tag} value={tag}>
                {tag}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>

        <label className="flex min-h-11 items-center gap-3 rounded-lg border px-3 text-sm font-medium">
          <Checkbox
            checked={Boolean(draft.deputyPresent)}
            onCheckedChange={(checked) =>
              update({ ...draft, deputyPresent: checked === true ? true : undefined })
            }
          />
          Deputado presente
        </label>

        <Button
          type="button"
          variant="ghost"
          className="min-h-11"
          disabled={!hasFilters}
          onClick={() => update({})}
        >
          Limpar filtros
        </Button>

        {onCreateFeed && onRevokeFeed && (
          <CalendarFeedButton
            state={state}
            hasFilters={hasFilters}
            feeds={feeds}
            onCreateFeed={onCreateFeed}
            onRevokeFeed={onRevokeFeed}
          />
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {isPending ? 'Atualizando os compromissos da agenda.' : 'Filtros da agenda atualizados.'}
      </p>
    </section>
  )
}
