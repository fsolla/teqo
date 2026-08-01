import type { ReactNode } from 'react'

import { OpsListView, type OpsListViewProps } from '@/components/campaign/shared/OpsListView'

export type OpsListPageProps = OpsListViewProps

/**
 * CL3 — casca server da factory de listas unificadas.
 *
 * Reencaminha slots para `OpsListView`. Nome estável para as pages/CL8 pins;
 * lógica de offline (OH12) vive na rota (`OfflineBoundary`), não aqui.
 */
export const OpsListPage = ({
  overview,
  toolbar,
  table,
  empty,
  footer,
}: OpsListPageProps): ReactNode => (
  <OpsListView overview={overview} toolbar={toolbar} table={table} empty={empty} footer={footer} />
)
