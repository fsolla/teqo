'use client'

import { CheckIcon, CircleAlertIcon, InstagramIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type {
  ContentPieceProfileImportCandidatesResponse,
  ContentPieceProfileImportCreateResponse,
} from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
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
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_CREATE_HREF,
  CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_HREF,
} from '@/lib/campaignPaths'
import type { ContentPieceProfileLinkOnlyReason } from '@/lib/contentPiece'
import { cn } from '@/lib/utils'
import { buildContentPieceListHref } from '@/utilities/content/contentPieceListUrl'

const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a importação. Tente novamente.'

const PROFILE_HANDLE = '@depjorgesolla'

type ImportPhase = 'intro' | 'running' | 'done'

type ImportResult = {
  created: number
  existing: number
  failed: number
  /** The created peças-link, one entry per publication, with the honest reason. */
  linkOnly: ContentPieceProfileLinkOnlyReason[]
  /** First non-generic failure message of the loop, shown in the receipt. */
  failureMessage: string | null
}

const IMPORT_STATUS: Record<
  ContentPieceProfileLinkOnlyReason,
  { title: string; description: string }
> = {
  carrossel: {
    title: 'carrossel',
    description:
      'A API oficial não ofereceu um arquivo único. A publicação entrou pelo link, com este motivo na ficha.',
  },
  indisponivel: {
    title: 'sem arquivo extraível',
    description:
      'O arquivo não pôde ser extraído pela via oficial. A publicação não foi descartada.',
  },
}

/** Counts the created peças-link per reason, in first-seen order. */
const countByReason = (
  reasons: readonly ContentPieceProfileLinkOnlyReason[],
): [ContentPieceProfileLinkOnlyReason, number][] => {
  const counts = new Map<ContentPieceProfileLinkOnlyReason, number>()
  for (const reason of reasons) counts.set(reason, (counts.get(reason) ?? 0) + 1)
  return [...counts]
}

/**
 * C230 — "Importar do perfil" (approved design scenes 2–4): the assessoria
 * brings the recent publications of the official profile into the Central.
 * The dialog drives the two phases for real — the listing (Graph API, own
 * profile only, dedupe by post identity) and one creation per novelty through
 * the C220 pipeline — so "Importando X de N…" is progress, never decoration.
 * Nothing is published: every novelty lands as Rascunho for curation.
 */
export const ImportContentPieceProfileDialog = ({
  configured,
  triggerClassName,
}: {
  /** False hides the action behind the design's fail-closed caption/disabled button. */
  configured: boolean
  triggerClassName?: string
}) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<ImportPhase>('intro')
  const [listing, setListing] = useState(false)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPhase('intro')
    setListing(false)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    setError(null)
  }

  const runImport = async () => {
    setPhase('running')
    setListing(true)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    setError(null)

    let candidates: ContentPieceProfileImportCandidatesResponse & { status: 'success' }
    try {
      const { ok, payload } = await postCampaignJson<ContentPieceProfileImportCandidatesResponse>(
        CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_HREF,
        {},
      )
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
        setPhase('intro')
        return
      }
      candidates = payload
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
      setPhase('intro')
      return
    }

    setListing(false)
    setProgress({ done: 0, total: candidates.candidates.length })

    let created = 0
    let existing = candidates.existingCount
    let failed = 0
    let failureMessage: string | null = null
    const linkOnly: ContentPieceProfileLinkOnlyReason[] = []

    for (const [index, candidate] of candidates.candidates.entries()) {
      try {
        const { ok, payload } = await postCampaignJson<ContentPieceProfileImportCreateResponse>(
          CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_CREATE_HREF,
          { url: candidate.url },
        )
        if (ok && payload.status === 'success') {
          if (payload.outcome === 'created') {
            created += 1
            if (candidate.linkOnlyReason) linkOnly.push(candidate.linkOnlyReason)
          } else {
            existing += 1
          }
        } else {
          failed += 1
          // A safe domain message (e.g. expired session) is more honest than
          // the generic network copy; the first one names the whole receipt.
          if (payload.status === 'error') failureMessage ??= payload.message
        }
      } catch {
        failed += 1
      }
      setProgress({ done: index + 1, total: candidates.candidates.length })
    }

    setResult({ created, existing, failed, linkOnly, failureMessage })
    setPhase('done')
    router.refresh()
  }

  const linkOnlyRows = result ? countByReason(result.linkOnly) : []

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (phase === 'running') return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={cn('min-h-11', triggerClassName)}
          disabled={!configured}
        >
          <InstagramIcon data-icon="inline-start" aria-hidden="true" />
          <span className="max-sm:hidden">Importar do perfil</span>
          <span className="sm:hidden">Importar perfil</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={phase !== 'running'}
        onInteractOutside={(event) => {
          if (phase === 'running') event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (phase === 'running') event.preventDefault()
        }}
      >
        {phase === 'done' && result ? (
          <>
            <DialogHeader>
              <div className="mb-4 grid size-10 place-items-center rounded-full bg-green-100 text-green-700">
                <CheckIcon className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="border-b-0 pb-0">Importação concluída</DialogTitle>
              <DialogDescription>
                {result.created === 0 && result.failed === 0
                  ? 'Nenhuma novidade na janela recente — a Central já estava em dia.'
                  : 'As novidades já estão na Central como rascunho. Nada foi publicado.'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                <b className="block text-xl tabular-nums text-green-800">{result.created}</b>
                <span className="text-xs font-medium text-green-800">novas criadas</span>
              </div>
              <div className="rounded-lg border bg-stone-50 p-3">
                <b className="block text-xl tabular-nums">{result.existing}</b>
                <span className="text-xs font-medium text-muted-foreground">já estavam</span>
              </div>
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <b className="block text-xl tabular-nums text-red-800">{result.failed}</b>
                <span className="text-xs font-medium text-red-800">
                  {result.failed === 1 ? 'falhou' : 'falharam'}
                </span>
              </div>
            </div>

            {linkOnlyRows.length > 0 || result.failed > 0 ? (
              <div className="overflow-hidden rounded-lg border text-xs">
                {linkOnlyRows.map(([reason, count], index) => {
                  const status = IMPORT_STATUS[reason]
                  return (
                    <div
                      key={reason}
                      className={cn(
                        'flex items-start gap-3 p-3.5',
                        index < linkOnlyRows.length - 1 || result.failed > 0 ? 'border-b' : '',
                      )}
                    >
                      <Badge variant="secondary" className="shrink-0">
                        Peça-link
                      </Badge>
                      <div>
                        <b className="text-sm">
                          {count} {status.title} · criado como peça-link
                        </b>
                        <p className="mt-1 leading-5 text-muted-foreground">{status.description}</p>
                      </div>
                    </div>
                  )
                })}
                {result.failed > 0 ? (
                  <div className="flex items-start gap-3 bg-red-50 p-3.5">
                    <CircleAlertIcon
                      className="mt-0.5 size-4 shrink-0 text-red-700"
                      aria-hidden="true"
                    />
                    <div>
                      <b className="text-sm text-red-900">
                        {result.failed === 1
                          ? '1 publicação não foi importada'
                          : `${result.failed} publicações não foram importadas`}
                      </b>
                      <p className="mt-1 leading-5 text-red-800">
                        {result.failureMessage ?? 'Falha de rede ao preparar a peça.'} Tente
                        importar novamente; as peças já criadas não serão duplicadas.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Fechar
              </Button>
              <Button asChild className="min-h-11">
                <Link
                  href={buildContentPieceListHref({ page: 1, statuses: ['rascunho'] }, 1)}
                  onClick={() => {
                    setOpen(false)
                    reset()
                  }}
                >
                  Ver os rascunhos
                </Link>
              </Button>
            </DialogFooter>
          </>
        ) : phase === 'running' ? (
          <>
            <DialogHeader>
              <div className="flex items-center gap-3">
                <Spinner className="size-5 shrink-0" />
                <div>
                  <DialogTitle className="border-b-0 pb-0">Importando do perfil</DialogTitle>
                  <DialogDescription>Mantenha esta janela aberta até concluir.</DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-xl border p-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'mt-0.5 grid size-6 shrink-0 place-items-center rounded-full',
                    listing ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-700',
                  )}
                >
                  {listing ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <b className="text-sm">
                    {listing
                      ? 'Buscando as publicações recentes…'
                      : 'Publicações recentes encontradas'}
                  </b>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {listing
                      ? `Consultando ${PROFILE_HANDLE} pela API oficial.`
                      : `A busca foi feita em ${PROFILE_HANDLE} pela API oficial.`}
                  </p>
                </div>
              </div>

              {!listing && progress.total > 0 ? (
                <>
                  <div className="my-3 ml-3 h-5 border-l border-dashed" />
                  <div className="flex items-start gap-3">
                    <Spinner className="mt-0.5 shrink-0" />
                    <div>
                      <b className="text-sm">
                        Importando {Math.min(progress.done + 1, progress.total)} de {progress.total}
                        …
                      </b>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">
                        Criando apenas as novidades como rascunho e reconhecendo o que já estava na
                        Central.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <p className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              Algumas mídias podem levar mais tempo para serem preparadas. O resultado final separa
              novas, já existentes e falhas — nenhuma falha fica escondida.
            </p>

            <DialogFooter>
              <Button type="button" variant="secondary" className="min-h-11" disabled>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Importando…
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <div className="mb-4 grid size-10 place-items-center rounded-full bg-red-50 text-primary">
                <InstagramIcon className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="border-b-0 pb-0">Importar do perfil</DialogTitle>
              <DialogDescription>
                Vamos procurar as publicações recentes de{' '}
                <b className="text-foreground">{PROFILE_HANDLE}</b> que ainda não estão na Central.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col gap-4">
              <div className="space-y-3">
                <div className="flex gap-3 rounded-lg border p-3.5">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <b className="text-sm">Somente novidades da janela recente</b>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Publicações que já estão na Central serão reconhecidas e não criam cópias.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3 rounded-lg border p-3.5">
                  <CheckIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <div>
                    <b className="text-sm">Tudo entra como Rascunho</b>
                    <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                      Nada é publicado automaticamente. A assessoria revisa e decide o que publicar.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border bg-stone-50 p-4 text-xs leading-5 text-muted-foreground">
                <b className="text-foreground">Sem scraping.</b>
                <br />
                Só o perfil oficial {PROFILE_HANDLE}, pela API oficial. Carrossel ou mídia sem
                arquivo extraível continua como peça-link, com o motivo visível.
              </div>

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
                  reset()
                }}
              >
                Cancelar
              </Button>
              <Button type="button" className="min-h-11" onClick={() => void runImport()}>
                Buscar publicações
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
