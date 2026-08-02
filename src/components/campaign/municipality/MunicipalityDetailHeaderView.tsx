import { Badge } from '@/components/ui/Badge'
import type { MunicipalityDetailHeaderViewModel } from '@/lib/campaignOps/municipalityDetailHeaderView'
import {
  formatMunicipalityGeographyLabel,
  municipalityKindLabels,
} from '@/utilities/municipality/municipalityLabels'

const dateFormatter = new Intl.DateTimeFormat('pt-BR')

type MunicipalityDetailHeaderAdvisorSummary = {
  name: string
}

type MunicipalityDetailHeaderViewProps = {
  view: MunicipalityDetailHeaderViewModel
  advisorSummaries: ReadonlyArray<MunicipalityDetailHeaderAdvisorSummary>
  /**
   * Mirror has advisor IDs but no campaignUser rows — cannot resolve names offline.
   * When true, the assessoria line is the honest offline copy regardless of summaries.
   */
  advisorsUnavailable?: boolean
}

export const MunicipalityDetailHeaderView = ({
  view,
  advisorSummaries,
  advisorsUnavailable = false,
}: MunicipalityDetailHeaderViewProps) => {
  const advisorLine = advisorsUnavailable
    ? 'Assessoria: indisponível offline'
    : advisorSummaries.length
      ? `Assessoria: ${advisorSummaries.map((advisor) => advisor.name).join(', ')}`
      : 'Sem assessor designado.'

  return (
    <header className="flex flex-col gap-2 print:hidden">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">{view.name}</h1>
        <Badge variant="scope">{municipalityKindLabels[view.kind]}</Badge>
      </div>
      <p className="text-muted-foreground">{formatMunicipalityGeographyLabel(view)}</p>
      <p className="text-sm text-muted-foreground">
        {advisorLine}
        {view.lastUpdateAt
          ? ` · Última atualização em ${dateFormatter.format(new Date(view.lastUpdateAt))}`
          : ''}
      </p>
    </header>
  )
}
