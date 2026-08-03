import Link from 'next/link'
import type { ReactNode } from 'react'

import { CampaignHoverTooltip } from '@/components/campaign/shared/CampaignHoverTooltip'
import { Badge } from '@/components/ui/Badge'
import { campaignHoverExplanationClassName } from '@/lib/campaignHoverTooltip'
import { campaignConceptHref, type CampaignConceptId } from '@/lib/campaignIntelligenceConcepts'
import { cn } from '@/lib/utils'
import {
  formatTerritorialClassWhy,
  territorialClassBadgeVariant,
  territorialClassLabels,
} from '@/utilities/municipality/municipalityLabels'
import type { MunicipalityTerritorialClassification } from '@/utilities/municipality/municipalityTerritorialClass'

export const CampaignConceptMetricExplanation = ({
  lead,
  formula,
  conceptID,
}: {
  lead: ReactNode
  formula?: ReactNode
  conceptID: CampaignConceptId
}) => (
  <div className="flex flex-col gap-1">
    <p>{lead}</p>
    {formula ? <p className="text-background/70">{formula}</p> : null}
    <Link
      href={campaignConceptHref(conceptID)}
      className="font-medium underline underline-offset-2"
    >
      Saiba mais
    </Link>
  </div>
)

/**
 * E10 — classe territorial com fatores dominantes (research §6.4).
 */
export const MunicipalityTerritorialClassRow = ({
  territorialClass,
}: {
  territorialClass: MunicipalityTerritorialClassification
}) => {
  const why = formatTerritorialClassWhy(territorialClass.factors)

  return (
    <div className="flex flex-col gap-0.5">
      <CampaignHoverTooltip
        content={
          <CampaignConceptMetricExplanation
            lead={
              <>
                <strong>Classe</strong> resume o que este município pede: defender (Reduto), abrir
                rede (Expansão), manter o padrão (Manutenção) ou não gastar perna (Marginal). Sem
                série do TSE, a classe fica em Sem base.
              </>
            }
            formula="Leitura relativa: o desempenho aqui contra o padrão estadual do próprio candidato, cruzado com quanto da votação dele vem daqui e quanto voto do campo segue sem captura. É sugestão, não sentença."
            conceptID="classe-territorial"
          />
        }
        side="right"
        align="start"
        sideOffset={8}
      >
        <button
          type="button"
          aria-label={`Classe: ${territorialClassLabels[territorialClass.class]}. Mais informações`}
          className="flex min-h-11 w-fit items-center gap-2 rounded-md px-1.5 py-1 text-left outline-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className={cn('text-xs text-muted-foreground', campaignHoverExplanationClassName)}>
            Classe
          </span>
          <Badge variant={territorialClassBadgeVariant[territorialClass.class]}>
            {territorialClassLabels[territorialClass.class]}
          </Badge>
        </button>
      </CampaignHoverTooltip>
      <p className="px-1.5 text-xs text-muted-foreground">{why}</p>
    </div>
  )
}
