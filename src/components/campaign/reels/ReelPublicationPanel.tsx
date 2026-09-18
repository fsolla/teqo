'use client'

import { ReelStatusBadge } from '@/components/campaign/reels/ReelStatusBadge'
import { usePublicationToggle } from '@/components/campaign/shared/usePublicationToggle'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/AlertDialog'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { campaignReelPublicationHref } from '@/lib/campaignPaths'
import type { ReelStatus } from '@/lib/reel'

type ReelPublicationPanelProps = {
  reelId: number
  status: ReelStatus
}

const UNPUBLISH_WARNING =
  'Despublicar tira este reel da lista e bloqueia o player e os downloads. Os arquivos voltam a ficar disponíveis quando o reel for republicado.'

const PUBLISH_WARNING =
  'Republicar devolve o reel à lista e libera novamente o player e os downloads.'

/**
 * C194 — the kill switch on the reel detail. Publishing puts the same row back
 * on the list and reopens the files; unpublishing takes it off the list and
 * withholds every file (C193 serves only `published`). Confirmation only on
 * the destructive direction.
 */
export const ReelPublicationPanel = ({ reelId, status }: ReelPublicationPanelProps) => {
  const { submitting, error, setPublished } = usePublicationToggle({
    href: campaignReelPublicationHref(reelId),
    buildBody: (published) => ({ reelId, published }),
  })

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
        Publicação na biblioteca
      </h2>

      <div className="mt-2">
        <ReelStatusBadge status={status} />
      </div>

      {status === 'published' ? (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{UNPUBLISH_WARNING}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11 w-full"
                disabled={submitting}
              >
                Despublicar reel
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Despublicar este reel?</AlertDialogTitle>
                <AlertDialogDescription>{UNPUBLISH_WARNING}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel type="button" className="min-h-11" disabled={submitting}>
                  Cancelar
                </AlertDialogCancel>
                <Button
                  type="button"
                  className="min-h-11"
                  disabled={submitting}
                  onClick={() => void setPublished(false)}
                >
                  {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
                  Despublicar
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : null}

      {status === 'unpublished' ? (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">{PUBLISH_WARNING}</p>
          <Button
            type="button"
            className="mt-3 min-h-11 w-full"
            disabled={submitting}
            onClick={() => void setPublished(true)}
          >
            {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Republicar reel
          </Button>
        </>
      ) : null}

      {status === 'draft' ? (
        <>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            Este reel ainda não foi publicado na biblioteca.
          </p>
          <Button
            type="button"
            className="mt-3 min-h-11 w-full"
            disabled={submitting}
            onClick={() => void setPublished(true)}
          >
            {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Publicar reel
          </Button>
        </>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-3 py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
