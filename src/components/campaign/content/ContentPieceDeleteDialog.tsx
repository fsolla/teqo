'use client'

import { Trash2Icon } from 'lucide-react'

import { CampaignDeleteDialog } from '@/components/campaign/shared/CampaignDeleteDialog'
import { Button } from '@/components/ui/button'
import { campaignContentPieceDeleteHref } from '@/lib/campaignPaths'
import type { ContentPieceStatus } from '@/lib/contentPiece'
import { cn } from '@/lib/utils'

const DELETE_ERROR_MESSAGE = 'Não foi possível apagar a peça.'

/**
 * C222 — the delete confirmation of a content piece, used on the list (desktop
 * row and mobile card) and on the ficha. The warning names the public
 * `/conteudos/<slug>` only when it will actually break (published piece with a
 * slug); every other state keeps the irreversible-only copy. The machine lives
 * in `CampaignDeleteDialog`; here is the piece's policy only.
 */
export const ContentPieceDeleteDialog = ({
  contentPieceId,
  status,
  publicPath,
  triggerClassName,
  redirectTo,
}: {
  contentPieceId: number
  status: ContentPieceStatus
  /** The public path of the piece; null when it never got a slug. */
  publicPath: string | null
  /** Layout of the trigger (list right-aligns; mobile card/detail goes full width). */
  triggerClassName?: string
  /** Ficha: the row is gone after the delete, so leave the page. */
  redirectTo?: string
}) => (
  <CampaignDeleteDialog
    endpoint={campaignContentPieceDeleteHref(contentPieceId)}
    errorMessage={DELETE_ERROR_MESSAGE}
    title="Apagar esta peça?"
    titleClassName="border-b-0 pb-0"
    description={
      status === 'publicado' && publicPath ? (
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
        className={cn('min-h-11 text-destructive hover:bg-red-50', triggerClassName)}
      >
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
        Apagar
      </Button>
    }
  />
)
