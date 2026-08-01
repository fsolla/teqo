import type { ReactNode } from 'react'

import {
  OpsListView,
  type OpsListViewProps,
} from '@/components/campaign/shared/OpsListView'

export type OpsListPageProps = OpsListViewProps

/**
 * CL3 — casca server da factory de listas unificadas.
 *
 * Hoje só reencaminha slots para `OpsListView`. Ponto de extensão para OH12
 * (`OfflineBoundary` → Local vs RSC) sem mudar as pages de domínio.
 */
export const OpsListPage = ({
  overview,
  toolbar,
  table,
  empty,
  footer,
}: OpsListPageProps): ReactNode => (
  <OpsListView
    overview={overview}
    toolbar={toolbar}
    table={table}
    empty={empty}
    footer={footer}
  />
)
