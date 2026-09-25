'use client'

import { CampaignDeleteDialog } from '@/components/campaign/shared/CampaignDeleteDialog'
import { Button } from '@/components/ui/button'
import { campaignSpeechCutDeleteHref } from '@/lib/campaignPaths'
import type { SpeechCutStatus } from '@/lib/speechCut'
import { cn } from '@/lib/utils'

type SpeechCutDeleteDialogProps = {
  cutId: number
  status: SpeechCutStatus
  publicPath: string
  /** Layout of the trigger (list card right-aligns; detail/mobile goes full width). */
  triggerClassName?: string
  /** Detail page: the row is gone after the delete, so leave the page. */
  redirectTo?: string
}

const DELETE_ERROR_MESSAGE = 'Não foi possível apagar o corte.'

/**
 * C183 — the one delete confirmation of the cut surfaces. The warning grows only
 * when there is a public link: a `published` cut names the `/corte/<id>` that
 * stops working for whoever already received it. The machine lives in
 * `CampaignDeleteDialog`; here is the cut's policy only.
 */
export const SpeechCutDeleteDialog = ({
  cutId,
  status,
  publicPath,
  triggerClassName,
  redirectTo,
}: SpeechCutDeleteDialogProps) => (
  <CampaignDeleteDialog
    endpoint={campaignSpeechCutDeleteHref(cutId)}
    errorMessage={DELETE_ERROR_MESSAGE}
    title="Apagar este corte?"
    description={
      status === 'published' ? (
        <>
          O link público <span className="font-medium text-foreground">{publicPath}</span> deixa de
          funcionar para quem já recebeu. Esta ação não pode ser desfeita.
        </>
      ) : (
        'Esta ação não pode ser desfeita.'
      )
    }
    confirmLabel="Apagar"
    redirectTo={redirectTo}
    trigger={
      <Button
        type="button"
        variant="ghost"
        className={cn('text-destructive hover:bg-red-50', triggerClassName)}
      >
        Apagar
      </Button>
    }
  />
)
