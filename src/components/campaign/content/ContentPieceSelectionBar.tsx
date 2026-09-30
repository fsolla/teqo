'use client'

import { BookmarkIcon, CheckIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'

import { useContentPieceSelection } from '@/components/campaign/content/ContentPieceSelectionProvider'
import { CampaignDeleteDialog } from '@/components/campaign/shared/CampaignDeleteDialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import {
  CONTENT_PIECE_BATCH_DELETE_IRREVERSIBLE_MESSAGE,
  CONTENT_PIECE_BATCH_DELETE_LINKS_MESSAGE,
  CONTENT_PIECE_BATCH_ERROR_MESSAGE,
  contentPieceBatchDeleteTitle,
  contentPieceSelectionLabel,
  type ContentPieceBatchAction,
} from '@/lib/contentPieceBatch'

/**
 * C236 — the batch action bar (approved design scenes 2, 3b and 6): it exists
 * only while something is selected, floats at the footer of the content and
 * owns the three verbs. `Publicar`/`Despublicar` are the reversible kill switch
 * and act on the spot, with the receipt in the list; `Apagar` always opens the
 * one confirmation machine (the C222 chrome) with the link warning when the
 * selection carries published pieces. While the loop runs every target blocks:
 * `aria-busy` on the bar, spinner on the clicked verb, the rest disabled.
 */
export const ContentPieceSelectionBar = () => {
  const router = useRouter()
  const { selectedCount, selectedPublishedPaths, pendingAction, exitSelection, runBatch } =
    useContentPieceSelection()

  if (selectedCount === 0) return null

  const pending = pendingAction !== null
  const barButtonClassName = 'min-h-11 px-1 text-xs sm:px-3 sm:text-sm'

  const run = async (action: ContentPieceBatchAction) => {
    const result = await runBatch(action)
    if (result.ok) router.refresh()
  }

  const description = (() => {
    if (selectedPublishedPaths.length === 0) return CONTENT_PIECE_BATCH_DELETE_IRREVERSIBLE_MESSAGE
    if (selectedCount > 1) return CONTENT_PIECE_BATCH_DELETE_LINKS_MESSAGE
    return (
      <>
        O link público{' '}
        <span className="font-medium text-foreground">{selectedPublishedPaths[0]}</span> deixa de
        funcionar para quem já recebeu. Esta ação não pode ser desfeita.
      </>
    )
  })()

  const deleteTrigger = (
    <Button type="button" variant="destructive" className={barButtonClassName} disabled={pending}>
      {pendingAction === 'apagar' ? (
        <Spinner data-icon="inline-start" aria-hidden="true" />
      ) : (
        <Trash2Icon data-icon="inline-start" aria-hidden="true" />
      )}
      Apagar
    </Button>
  )

  return (
    <div className="sticky bottom-32 z-20 mt-4 md:bottom-4 md:mr-16">
      <div
        aria-busy={pending}
        className="flex flex-col rounded-xl border border-border bg-card p-3 shadow-[0_10px_34px_rgb(28_25_23_/_0.16)] sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-3 sm:py-2.5"
      >
        <div className="flex items-center justify-between gap-2 sm:justify-start">
          <p
            role="status"
            aria-live="polite"
            className={
              pending
                ? 'text-sm font-medium tabular-nums text-muted-foreground'
                : 'text-sm font-medium tabular-nums'
            }
          >
            {contentPieceSelectionLabel(selectedCount)}
          </p>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 sm:hidden"
            aria-label="Sair da seleção"
            disabled={pending}
            onClick={exitSelection}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </div>

        <div className="mt-2 grid grid-cols-3 gap-2 sm:mt-0 sm:flex sm:items-center">
          <Button
            type="button"
            className={barButtonClassName}
            disabled={pending}
            onClick={() => void run('publicar')}
          >
            {pendingAction === 'publicar' ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <CheckIcon data-icon="inline-start" aria-hidden="true" />
            )}
            Publicar
          </Button>
          <Button
            type="button"
            variant="outline"
            className={barButtonClassName}
            disabled={pending}
            onClick={() => void run('despublicar')}
          >
            {pendingAction === 'despublicar' ? (
              <Spinner data-icon="inline-start" aria-hidden="true" />
            ) : (
              <BookmarkIcon data-icon="inline-start" aria-hidden="true" />
            )}
            Despublicar
          </Button>
          <CampaignDeleteDialog
            errorMessage={CONTENT_PIECE_BATCH_ERROR_MESSAGE}
            title={contentPieceBatchDeleteTitle(selectedCount)}
            titleClassName="border-b-0 pb-0"
            contentClassName="max-w-sm"
            description={description}
            confirmLabel="Apagar"
            trigger={deleteTrigger}
            onConfirm={async () => {
              const result = await runBatch('apagar')
              return result.ok ? { ok: true } : { ok: false, message: result.message }
            }}
          />
        </div>
      </div>
    </div>
  )
}
