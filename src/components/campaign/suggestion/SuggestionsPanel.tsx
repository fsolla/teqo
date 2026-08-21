import Link from 'next/link'

import type { ComponentProps, ReactNode } from 'react'

import { CampaignInfoHint } from '@/components/campaign/shared/CampaignInfoHint'
import {
  SuggestionCard,
  type SuggestionCardData,
} from '@/components/campaign/suggestion/SuggestionCard'
import { Button } from '@/components/ui/button'
import { CAMPAIGN_CONCEPTS_PATH, campaignConceptHref } from '@/lib/campaignIntelligenceConcepts'
import { SUGGESTION_STATUTE } from '@/lib/suggestionCatalog'
import { formatSilenceAgeLabel } from '@/utilities/municipality/municipalitySignal'
import type { MunicipalitySilenceEntry } from '@/utilities/municipality/municipalityTriggers'

/**
 * E11 — the suggestion queue as a panel: triage-ordered cards, each a
 * data→decision pattern with its menu, plus the statute line that keeps the
 * catalog honest (§6: menu for judgment, never a rule). Server component; the
 * cards are the interactive islands.
 */
export const SuggestionsPanel = ({
  titleId,
  suggestions,
  activeCount,
  showMunicipality = false,
  resolveAction,
  emptyState,
  readOnly = false,
  children,
}: {
  titleId: string
  suggestions: readonly SuggestionCardData[]
  /** Total triggered in scope — the header says when the list below is a cut. */
  activeCount: number
  showMunicipality?: boolean
  resolveAction: ComponentProps<typeof SuggestionCard>['resolveAction']
  emptyState: ReactNode
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): cards render without decision actions. */
  readOnly?: boolean
  /** Dashboard appends the silence strip here. */
  children?: ReactNode
}) => (
  <section aria-labelledby={titleId} className="flex flex-col gap-4 rounded-xl border p-4">
    <div className="flex flex-wrap items-center gap-x-1 gap-y-2">
      <h2 id={titleId} className="text-base font-medium">
        Sugestões
      </h2>
      <CampaignInfoHint label="Sobre as sugestões">
        <div className="flex flex-col gap-2">
          <p>
            O produto vigia os municípios e dispara os <strong>padrões dado→decisão</strong> do
            catálogo da campanha, ordenados pela triagem (nível 1 = estoque em risco; nível 5 =
            otimização). Cada card traz a leitura provável, os fatos observados e o menu de ações —
            do barato ao caro.
          </p>
          <p>
            A decisão é sempre humana: aceitar, adiar ou descartar fica registrado para o backtest —
            inclusive a leitura alternativa de um descarte.
          </p>
          <Link
            href={campaignConceptHref('triagem-de-sugestoes')}
            className="font-medium text-primary underline underline-offset-4"
          >
            Como a triagem ordena a fila
          </Link>
          <Link
            href={CAMPAIGN_CONCEPTS_PATH}
            className="font-medium text-primary underline underline-offset-4"
          >
            Todos os conceitos
          </Link>
        </div>
      </CampaignInfoHint>
      {activeCount > 0 ? (
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          {suggestions.length < activeCount
            ? `${suggestions.length} de ${activeCount} ativas`
            : activeCount === 1
              ? '1 ativa'
              : `${activeCount} ativas`}
        </span>
      ) : null}
    </div>

    {suggestions.length ? (
      <ul className="m-0 flex list-none flex-col gap-3 p-0 [&>li]:mt-0">
        {suggestions.map(
          ({
            municipalityID,
            municipalityName,
            municipalitySlug,
            patternId,
            triageLevel,
            factors,
          }) => (
            <li key={`${municipalityID}:${patternId}`}>
              <SuggestionCard
                // Picked field by field: the loader's view model also carries the
                // snapshot `metrics`, which only the server action reads — spreading
                // the whole object would serialize them into the RSC payload.
                suggestion={{
                  municipalityID,
                  municipalityName,
                  municipalitySlug,
                  patternId,
                  triageLevel,
                  factors,
                }}
                showMunicipality={showMunicipality}
                resolveAction={resolveAction}
                readOnly={readOnly}
              />
            </li>
          ),
        )}
      </ul>
    ) : (
      emptyState
    )}

    {children}

    <p className="text-xs text-muted-foreground">{SUGGESTION_STATUTE}</p>
  </section>
)

/**
 * "Pauta do silêncio" (§6.4): the prioritized municípios where NOTHING fired
 * and nothing was recorded for a month. A list of questions, not of tasks —
 * each chip opens the município so the answer starts with the registry.
 */
export const SuggestionSilenceStrip = ({
  entries,
}: {
  entries: readonly MunicipalitySilenceEntry[]
}) => {
  if (entries.length === 0) return null
  const shown = entries.slice(0, 6)

  return (
    <section aria-labelledby="suggestion-silence-title" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 id="suggestion-silence-title" className="text-sm font-medium">
          Pauta do silêncio
        </h3>
        <span className="text-xs text-muted-foreground tabular-nums">
          {entries.length === 1 ? '1 município' : `${entries.length} municípios`}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Priorizados sem nenhum gatilho e sem sinal há mais de um mês — silêncio é pergunta, não
        conforto. A resposta começa auditando o registro, nunca despachando agenda.
      </p>
      <ul className="m-0 flex list-none flex-wrap items-center gap-2 p-0 [&>li]:mt-0">
        {shown.map((entry) => (
          <li key={entry.municipalityID}>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={`/campanha/municipios/${entry.municipalitySlug}`}>
                {entry.municipalityName}
                <span className="sr-only">, {formatSilenceAgeLabel(entry.lastSignalAgeDays)}</span>
              </Link>
            </Button>
          </li>
        ))}
        {entries.length > shown.length ? (
          <li className="text-sm text-muted-foreground tabular-nums">
            +{entries.length - shown.length}
          </li>
        ) : null}
      </ul>
    </section>
  )
}
