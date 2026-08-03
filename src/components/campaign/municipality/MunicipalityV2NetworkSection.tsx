import { PlusIcon } from 'lucide-react'
import Link from 'next/link'

import { MunicipalityV2NetworkList } from '@/components/campaign/municipality/MunicipalityV2NetworkList'
import { Button } from '@/components/ui/button'
import { formatElectionNumber } from '@/lib/electionFormat'
import type { MunicipalityV2NetworkViewModel } from '@/utilities/municipality/municipalityV2NetworkView'

type MunicipalityV2NetworkSectionProps = {
  network: MunicipalityV2NetworkViewModel
}

export const MunicipalityV2NetworkSection = ({ network }: MunicipalityV2NetworkSectionProps) => {
  const seeAllHref = `/campanha/municipios/${network.slug}?tab=leaderships`
  const createHref = `/campanha/liderancas/nova?municipality=${network.municipalityID}`

  return (
    <section aria-labelledby="municipio-v2-rede-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="municipio-v2-rede-title" className="text-base font-medium text-muted-foreground">
            Rede
            {network.totalCount > 0
              ? ` (${formatElectionNumber(network.totalCount)})`
              : ''}
          </h2>
          <p className="text-sm text-muted-foreground">
            Quem segura o município — ajuste declarado e estimado sem trocar de aba.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {network.totalCount > network.rows.length ? (
            <Button asChild variant="outline" className="min-h-11">
              <Link href={seeAllHref}>Ver todas</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline" className="min-h-11">
            <Link href={createHref}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Nova liderança
            </Link>
          </Button>
        </div>
      </div>

      <MunicipalityV2NetworkList network={network} />
    </section>
  )
}
