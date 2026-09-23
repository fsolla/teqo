'use client'

import { CircleAlertIcon, LinkIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ReactNode } from 'react'

import type { ContentPieceLinkResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { CAMPAIGN_CONTENT_PIECE_LINK_HREF } from '@/lib/campaignPaths'
import { CONTENT_PIECE_LINK_INVALID_MESSAGE } from '@/lib/schemas/contentPiece'
import { cn } from '@/lib/utils'

const GENERIC_ERROR_MESSAGE = 'Não foi possível adicionar a peça. Tente novamente.'

/**
 * C211 — "Adicionar por link" (approved design scene 3): the assessoria pastes
 * an Instagram/YouTube publication and the piece enters the same catalogue. The
 * panel states the product rule up front — no scraping; when the platform
 * offers no official path the piece circulates by link and the original can be
 * attached.
 */
export const AddContentPieceLinkDialog = ({
  triggerClassName,
  triggerLabel = 'Adicionar por link',
}: {
  triggerClassName?: string
  /** A node so the page can shorten the label on mobile ("Link"). */
  triggerLabel?: ReactNode
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    const trimmed = url.trim()
    if (!trimmed) {
      setError(CONTENT_PIECE_LINK_INVALID_MESSAGE)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { ok, payload } = await postCampaignJson<ContentPieceLinkResponse>(
        CAMPAIGN_CONTENT_PIECE_LINK_HREF,
        { url: trimmed },
      )
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
        return
      }
      setUrl('')
      setOpen(false)
      router.refresh()
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (submitting) return
        setOpen(next)
        if (!next) {
          setUrl('')
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className={cn('min-h-11', triggerClassName)}>
          <LinkIcon data-icon="inline-start" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="border-b-0 pb-0">Adicionar por link</DialogTitle>
          <DialogDescription>
            Instagram ou YouTube. Conteúdo próprio é extraído somente quando a plataforma oferece
            caminho oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="content-piece-link">Link da publicação</Label>
            <Input
              id="content-piece-link"
              value={url}
              onChange={(event) => {
                setUrl(event.target.value)
                if (error) setError(null)
              }}
              placeholder="https://www.instagram.com/reel/…"
              className="mt-1.5 min-h-11"
              aria-invalid={error ? true : undefined}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  void submit()
                }
              }}
            />
          </div>

          <div className="rounded-lg border bg-white p-4 text-xs leading-5 text-muted-foreground">
            <b className="text-foreground">Sem scraping.</b>
            <br />
            Se não houver acesso oficial à mídia, a peça continua pelo link e o arquivo original
            pode ser anexado.
          </div>

          <ul className="space-y-2 text-xs leading-5 text-muted-foreground">
            <li>
              <b className="text-foreground">Mídia encontrada na conta oficial:</b> o arquivo entra
              na peça e passa pelo mesmo processamento do envio.
            </li>
            <li>
              <b className="text-foreground">Sem caminho oficial:</b> a peça nasce como peça-link e
              a assessoria pode anexar o arquivo original. Mídia de terceiro nunca é baixada.
            </li>
          </ul>

          {error ? (
            <Alert variant="destructive" className="py-2" role="alert">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            onClick={() => {
              setOpen(false)
              setUrl('')
              setError(null)
            }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={submitting}
            onClick={() => void submit()}
          >
            {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            {submitting ? 'Adicionando…' : 'Adicionar e catalogar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
