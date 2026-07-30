import { Minus, ThumbsDown, ThumbsUp, type LucideIcon } from 'lucide-react'

import { politicalTrendStatuses, type PoliticalTrendStatusValue } from '@/lib/schemas/municipality'

const politicalTrendDisplayLabels: Record<PoliticalTrendStatusValue, string> = {
  favoravel: 'Favorável',
  neutra: 'Neutra',
  desfavoravel: 'Desfavorável',
}

export type PoliticalTrendWizardMetaEntry = {
  status: PoliticalTrendStatusValue
  label: string
  changeDescription: string
  infoContent: string
  icon: LucideIcon
  tileClassName: string
}

const trendIcons: Record<PoliticalTrendStatusValue, LucideIcon> = {
  favoravel: ThumbsUp,
  neutra: Minus,
  desfavoravel: ThumbsDown,
}

const trendTileClassNames: Record<PoliticalTrendStatusValue, string> = {
  favoravel: 'border-estimate-confirmed-foreground text-estimate-confirmed-foreground',
  neutra: 'border-border text-foreground',
  desfavoravel: 'border-destructive text-destructive',
}

const trendInfoContent: Record<PoliticalTrendStatusValue, string> = {
  favoravel:
    'A leitura local favorece a campanha: aliados ativos, rede respondendo, espaço político aberto ou apoio consolidado. Use quando a equipe tem confiança de que o município está a nosso favor — não só por um evento isolado.',
  neutra:
    'Sem leitura clara de favor ou desfavor: disputa aberta, rede morna ou informação insuficiente para classificar. Use quando não há sinal forte para favorável ou desfavorável.',
  desfavoravel:
    'A leitura local pressiona a campanha: adversário ganhando espaço, rede esfriando ou apoio em risco. Use quando a equipe precisa registrar que o município está desfavorável — com o porquê na justificativa.',
}

export const politicalTrendWizardMeta: PoliticalTrendWizardMetaEntry[] = politicalTrendStatuses.map(
  (status) => ({
    status,
    label: politicalTrendDisplayLabels[status],
    changeDescription: `Mudar tendência para ${politicalTrendDisplayLabels[status]}`,
    infoContent: trendInfoContent[status],
    icon: trendIcons[status],
    tileClassName: trendTileClassNames[status],
  }),
)

export const politicalTrendWizardMetaByStatus = Object.fromEntries(
  politicalTrendWizardMeta.map((entry) => [entry.status, entry]),
) as Record<PoliticalTrendStatusValue, PoliticalTrendWizardMetaEntry>
