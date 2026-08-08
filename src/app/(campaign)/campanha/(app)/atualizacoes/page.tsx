import { Inbox } from 'lucide-react'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'

export const metadata = campaignPageMetadataFromCatalog('atualizacoes')

/**
 * B164 placeholder — staff-only. The `Atualizações` nav item points here so
 * the bottom nav has a destination to route to; the content is an honest sign
 * that the feed is not built yet (no fake skeleton rows).
 */
export default async function CampaignUpdatesPage() {
  await requireCampaignPageActor({ gate: 'staff' })

  return (
    <CampaignPageShell className="items-center py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
          <Inbox aria-hidden="true" className="size-6 text-muted-foreground" />
        </div>
        <h1 className="text-xl font-semibold">Atualizações em breve</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          O painel de atualizações da campanha ainda está em construção. Volte depois para conferir
          as novidades.
        </p>
      </div>
    </CampaignPageShell>
  )
}
