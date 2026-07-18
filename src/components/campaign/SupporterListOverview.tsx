import type { SupporterListOverviewViewModel } from '@/utilities/supporterViewModels'

const numberFormatter = new Intl.NumberFormat('pt-BR')

export const SupporterListOverview = ({
  view,
}: {
  view: SupporterListOverviewViewModel
}) => (
  <section aria-labelledby="supporter-list-overview" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <h2 id="supporter-list-overview" className="sr-only">
      Indicadores dos apoiadores filtrados
    </h2>
    <div className="rounded-[6px] border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums">{numberFormatter.format(view.total)}</p>
      <p className="text-sm text-muted-foreground">Total</p>
    </div>
    <div className="rounded-[6px] border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums text-estimate-confirmed-foreground">
        {numberFormatter.format(view.certoAndTende)}
      </p>
      <p className="text-sm text-muted-foreground">Certo + Tende</p>
    </div>
    <div className="rounded-[6px] border bg-card p-4 text-center">
      <p className="text-2xl font-bold tabular-nums text-estimate-pending-foreground">
        {numberFormatter.format(view.indeciso)}
      </p>
      <p className="text-sm text-muted-foreground">Indecisos</p>
    </div>
  </section>
)
