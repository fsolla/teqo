import { ArrowRightIcon } from 'lucide-react'
import Link from 'next/link'
import type { ComponentProps } from 'react'

import { MunicipalityV2NextStepsControl } from '@/components/campaign/municipality/MunicipalityV2NextStepsControl'
import { SuggestionCard } from '@/components/campaign/suggestion/SuggestionCard'
import { Button } from '@/components/ui/button'
import type { MunicipalityV2AgoraViewModel } from '@/utilities/municipality/municipalityV2AgoraView'
import { buildTourComposerHref } from '@/utilities/visit/visitPlannerUrl'

type MunicipalityV2AgoraSectionProps = {
  agora: MunicipalityV2AgoraViewModel
  resolveAction: ComponentProps<typeof SuggestionCard>['resolveAction']
}

/**
 * B150 — "o que fazer agora": encaminhamento editável, até duas sugestões, visita
 * em uma linha. Server component; os sub-blocos interativos são ilhas client.
 */
export const MunicipalityV2AgoraSection = ({
  agora,
  resolveAction,
}: MunicipalityV2AgoraSectionProps) => {
  const tourHref = buildTourComposerHref({ region: agora.visit.region })

  return (
    <section aria-labelledby="municipio-v2-agora-title" className="flex flex-col gap-6">
      <h2 id="municipio-v2-agora-title" className="text-base font-medium text-muted-foreground">
        Agora
      </h2>

      <div className="flex flex-col gap-4 rounded-xl border p-4">
        <MunicipalityV2NextStepsControl
          municipalityID={agora.municipalityID}
          municipalityName={agora.municipalityName}
          defaultValue={agora.nextSteps}
        />
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-medium">Sugestões</h3>
        {agora.suggestions.length > 0 ? (
          <div className="flex flex-col gap-4">
            {agora.suggestions.map((suggestion) => (
              <SuggestionCard
                key={`${suggestion.municipalityID}-${suggestion.patternId}`}
                suggestion={suggestion}
                resolveAction={resolveAction}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{agora.suggestionSilence}</p>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-medium">Visita do candidato</h3>
          {agora.visit.summary ? (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{agora.visit.summary.headline}</span>
              {' · '}
              {agora.visit.summary.detail}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Dados insuficientes para avaliar a elegibilidade de visita.
            </p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0">
          <Link href={tourHref}>
            Abrir compositor de giros
            <ArrowRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </Button>
      </div>
    </section>
  )
}
