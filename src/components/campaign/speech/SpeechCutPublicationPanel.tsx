'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { SpeechCutPublicationResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/cortes/[id]/types'
import { SpeechCutStatusBadge } from '@/components/campaign/speech/SpeechCutStatusBadge'
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
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import type { SpeechCutStatus } from '@/lib/speechCut'

type SpeechCutPublicationPanelProps = {
  cutId: number
  status: SpeechCutStatus
}

const UNPUBLISH_WARNING =
  'O link público deixa de funcionar para quem já recebeu. Você pode publicar de novo quando quiser.'

/**
 * C168 — the kill switch on the detail page. Publishing restores the same
 * public link; unpublishing asks for confirmation with the product copy and
 * takes it off the air. A cut without a stored file cannot be published.
 */
export const SpeechCutPublicationPanel = ({ cutId, status }: SpeechCutPublicationPanelProps) => {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setPublished = async (published: boolean) => {
    setSubmitting(true)
    setError(null)

    try {
      const { ok, payload } = await postCampaignJson<SpeechCutPublicationResponse>(
        `/campanha/comunicacao/acervo/cortes/${cutId}/publicacao`,
        { cutId, published },
      )

      if (!ok || payload.status !== 'success') {
        setError(
          payload.status === 'error' ? payload.message : 'Não foi possível atualizar a publicação.',
        )
        return
      }

      router.refresh()
    } catch {
      setError('Não foi possível atualizar a publicação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="rounded-xl border p-4">
      <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Publicação</h2>

      <div className="mt-2">
        <SpeechCutStatusBadge status={status} />
      </div>

      {status === 'published' ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">{UNPUBLISH_WARNING}</p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                className="mt-3 min-h-11 w-full"
                disabled={submitting}
              >
                Despublicar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Despublicar este corte?</AlertDialogTitle>
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
          <p className="mt-2 text-xs text-muted-foreground">
            Despublicado, o link público não responde. Publique para reativar o mesmo link.
          </p>
          <Button
            type="button"
            className="mt-3 min-h-11 w-full"
            disabled={submitting}
            onClick={() => void setPublished(true)}
          >
            {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Publicar corte
          </Button>
        </>
      ) : null}

      {status === 'processing' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          O corte ainda está sendo preparado. Assim que o arquivo ficar pronto, publique por aqui.
        </p>
      ) : null}

      {status === 'failed' ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Não foi possível preparar o arquivo. Tente novamente sem refazer o corte.
        </p>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="mt-3 py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  )
}
