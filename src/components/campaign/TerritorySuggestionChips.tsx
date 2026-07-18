'use client'

import { useState } from 'react'

import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import type { CitySuggestion, ZoneSuggestion } from '@/lib/territorySuggestions'

const MAX_VISIBLE_SUGGESTION_CHIPS = 8

type TerritorySuggestionChipsProps =
  | {
      kind: 'zone'
      suggestions: ZoneSuggestion[]
      onAccept: (suggestion: ZoneSuggestion) => void
    }
  | {
      kind: 'city'
      suggestions: CitySuggestion[]
      onAccept: (suggestion: CitySuggestion) => void
    }

type ChipView = {
  key: string
  label: string
  ariaLabel: string
  variant: 'tse' | 'outline'
  onAccept: () => void
}

const toChipViews = (props: TerritorySuggestionChipsProps): ChipView[] => {
  if (props.kind === 'zone') {
    return props.suggestions.map((suggestion) => ({
      key: `zone-${suggestion.kind}-${suggestion.label}`,
      label: `${suggestion.label} +`,
      ariaLabel: `Adicionar zonas TSE de ${suggestion.label}`,
      variant: 'tse',
      onAccept: () => props.onAccept(suggestion),
    }))
  }
  return props.suggestions.map((suggestion) => ({
    key: `city-${suggestion.kind}-${suggestion.city}`,
    label: `${suggestion.city} +`,
    ariaLabel: `Adicionar município ${suggestion.city}`,
    variant: 'outline',
    onAccept: () => props.onAccept(suggestion),
  }))
}

export const TerritorySuggestionChips = (props: TerritorySuggestionChipsProps) => {
  const [expanded, setExpanded] = useState(false)

  if (props.suggestions.length === 0) return null

  const chips = toChipViews(props)
  const visible = expanded ? chips : chips.slice(0, MAX_VISIBLE_SUGGESTION_CHIPS)
  const hiddenCount = chips.length - visible.length

  return (
    <div className="flex flex-wrap items-center gap-1" data-slot="territory-suggestion-chips">
      {visible.map((chip) => (
        <Badge
          key={chip.key}
          asChild
          variant={chip.variant}
          className="h-8 rounded-sm px-2.5 py-1 text-xs font-medium"
        >
          <button type="button" onClick={chip.onAccept} aria-label={chip.ariaLabel}>
            {chip.label}
          </button>
        </Badge>
      ))}
      {hiddenCount > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 px-2 text-xs"
          onClick={() => setExpanded(true)}
        >
          +{hiddenCount} sugestões
        </Button>
      ) : null}
    </div>
  )
}
