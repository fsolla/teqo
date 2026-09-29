'use client'

import {
  CalendarDaysIcon,
  CalendarXIcon,
  CheckIcon,
  CircleAlertIcon,
  InstagramIcon,
  SearchIcon,
  TriangleAlertIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef, useState, type KeyboardEvent } from 'react'

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
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/Progress'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import {
  CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_CREATE_HREF,
  CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_HREF,
} from '@/lib/campaignPaths'
import {
  formatBahiaCivilDate,
  formatCivilDateLabel,
  subtractBahiaCivilDays,
  subtractBahiaCivilMonths,
} from '@/lib/campaignTime'
import type { ContentPieceProfileLinkOnlyReason } from '@/lib/contentPiece'
import {
  CONTENT_PIECE_PROFILE_IMPORT_LARGE_WINDOW_THRESHOLD,
  contentPieceProfilePeriodError,
  contentPieceProfileWindowLabel,
  type ContentPieceProfileWindow,
} from '@/lib/contentPieceProfileWindow'
import { cn } from '@/lib/utils'
import { buildContentPieceListHref } from '@/utilities/content/contentPieceListUrl'

const GENERIC_ERROR_MESSAGE = 'Não foi possível concluir a importação. Tente novamente.'

const PROFILE_HANDLE = '@depjorgesolla'

type ImportPhase = 'window' | 'confirm' | 'running' | 'done' | 'empty' | 'error'

type WindowMode = 'recent' | 'period'

type ImportResult = {
  created: number
  existing: number
  failed: number
  /** The created peças-link, one entry per publication, with the honest reason. */
  linkOnly: ContentPieceProfileLinkOnlyReason[]
  /** First non-generic failure message of the loop, shown in the receipt. */
  failureMessage: string | null
  /** The official API did not reach the window start (design scene 06d). */
  truncated: boolean
  /** "Período · 01/08/2026 → hoje" in period mode; null for the recency slice. */
  windowLabel: string | null
}

type ImportListing = Extract<ContentPieceProfileImportCandidatesResponse, { status: 'success' }>

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

const plural = (count: number, singular: string, pluralForm: string): string =>
  count === 1 ? singular : pluralForm

/**
 * C230/C235 — "Importar do perfil": the assessoria brings the publications of
 * the official profile into the Central. The dialog drives the two phases for
 * real — the listing (Graph API, own profile only, dedupe by post identity)
 * and one creation per novelty through the C220 pipeline. C235 adds the window
 * choice: Recents stays the default single-click gesture; a period is an
 * explicit gesture that shows the honest size (new · already there · total)
 * before creating. Nothing is published: every novelty lands as Rascunho.
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
  const [phase, setPhase] = useState<ImportPhase>('window')
  const [mode, setMode] = useState<WindowMode>('recent')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [windowError, setWindowError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [listing, setListing] = useState<ImportListing | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const recentRadioRef = useRef<HTMLButtonElement>(null)
  const periodRadioRef = useRef<HTMLButtonElement>(null)

  const today = formatBahiaCivilDate(new Date())

  const selectWindowMode = (next: WindowMode) => {
    setMode(next)
    setWindowError(null)
  }

  // WAI-ARIA radiogroup: arrows move the selection and the focus (roving
  // tabindex), so the two window options behave like one control.
  const handleWindowChoiceKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(event.key)) return
    event.preventDefault()
    const next = mode === 'recent' ? 'period' : 'recent'
    selectWindowMode(next)
    ;(next === 'recent' ? recentRadioRef : periodRadioRef).current?.focus()
  }

  const reset = () => {
    setPhase('window')
    setMode('recent')
    setSince('')
    setUntil('')
    setWindowError(null)
    setSearching(false)
    setListing(null)
    setProgress({ done: 0, total: 0 })
    setResult(null)
    setError(null)
  }

  const periodWindow = (): ContentPieceProfileWindow => ({
    mode: 'period',
    since,
    until: until || undefined,
  })

  const requestWindow = (): ContentPieceProfileWindow =>
    mode === 'recent' ? { mode: 'recent' } : periodWindow()

  const requestLabel = (request: ContentPieceProfileWindow): string | null =>
    request.mode === 'period' ? `Período · ${contentPieceProfileWindowLabel(request)}` : null

  const runCreationLoop = async (window: ContentPieceProfileWindow, listed: ImportListing) => {
    setPhase('running')
    setProgress({ done: 0, total: listed.candidates.length })

    let created = 0
    let existing = listed.existingCount
    let failed = 0
    let failureMessage: string | null = null
    const linkOnly: ContentPieceProfileLinkOnlyReason[] = []

    for (const [index, candidate] of listed.candidates.entries()) {
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
      setProgress({ done: index + 1, total: listed.candidates.length })
    }

    setResult({
      created,
      existing,
      failed,
      linkOnly,
      failureMessage,
      truncated: listed.truncated,
      windowLabel: requestLabel(window),
    })
    setPhase('done')
    router.refresh()
  }

  const runSearch = async () => {
    const request = requestWindow()
    if (request.mode === 'period') {
      const message = contentPieceProfilePeriodError({
        since: request.since,
        until: request.until ?? null,
        today,
      })
      if (message) {
        setWindowError(message)
        return
      }
    }

    setWindowError(null)
    setError(null)
    setListing(null)
    setPhase('running')
    setSearching(true)
    setProgress({ done: 0, total: 0 })

    let found: ImportListing
    try {
      const { ok, payload } = await postCampaignJson<ContentPieceProfileImportCandidatesResponse>(
        CAMPAIGN_CONTENT_PIECE_PROFILE_IMPORT_HREF,
        request,
      )
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
        setPhase('error')
        return
      }
      found = payload
    } catch {
      setError(GENERIC_ERROR_MESSAGE)
      setPhase('error')
      return
    }

    setListing(found)
    setSearching(false)

    if (request.mode === 'recent') {
      await runCreationLoop(request, found)
      return
    }
    if (found.found === 0) {
      setPhase('empty')
      return
    }
    if (found.candidates.length === 0) {
      setResult({
        created: 0,
        existing: found.existingCount,
        failed: 0,
        linkOnly: [],
        failureMessage: null,
        truncated: found.truncated,
        windowLabel: requestLabel(request),
      })
      setPhase('done')
      return
    }
    setPhase('confirm')
  }

  const linkOnlyRows = result ? countByReason(result.linkOnly) : []
  const progressPercent =
    progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const largeWindow =
    listing !== null &&
    listing.candidates.length > CONTENT_PIECE_PROFILE_IMPORT_LARGE_WINDOW_THRESHOLD

  const windowStep = (
    <>
      <DialogHeader>
        <div className="mb-4 grid size-10 place-items-center rounded-full bg-red-50 text-primary">
          <InstagramIcon className="size-5" aria-hidden="true" />
        </div>
        <DialogTitle className="border-b-0 pb-0">Importar do perfil</DialogTitle>
        <DialogDescription>
          Escolha quais publicações de <b className="text-foreground">{PROFILE_HANDLE}</b> procurar.
          Só as que ainda não estão na Central entram, sempre como rascunho.
        </DialogDescription>
      </DialogHeader>

      <div className="mt-5">
        <p className="text-sm font-semibold">Qual janela de publicações?</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          O recorte usa a data de publicação do post.
        </p>

        <div
          className="mt-3 space-y-2"
          role="radiogroup"
          aria-label="Janela de publicações"
          onKeyDown={handleWindowChoiceKeyDown}
        >
          <div className="overflow-hidden rounded-lg border">
            <button
              ref={recentRadioRef}
              type="button"
              role="radio"
              aria-checked={mode === 'recent'}
              tabIndex={mode === 'recent' ? 0 : -1}
              onClick={() => selectWindowMode('recent')}
              className={cn(
                'flex w-full items-start gap-3 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'recent' ? 'bg-stone-50' : 'bg-white hover:bg-stone-50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-4 shrink-0 rounded-full border-2',
                  mode === 'recent'
                    ? 'border-primary bg-primary ring-2 ring-white ring-inset'
                    : 'border-stone-300',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <b className="text-sm">Recentes</b>
                  <Badge variant="secondary">Padrão</Badge>
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  As publicações mais novas do perfil. É o comportamento de sempre.
                </span>
              </span>
            </button>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <button
              ref={periodRadioRef}
              type="button"
              role="radio"
              aria-checked={mode === 'period'}
              tabIndex={mode === 'period' ? 0 : -1}
              onClick={() => selectWindowMode('period')}
              className={cn(
                'flex w-full items-start gap-3 p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === 'period' ? 'bg-stone-50' : 'bg-white hover:bg-stone-50',
              )}
            >
              <span
                className={cn(
                  'mt-0.5 size-4 shrink-0 rounded-full border-2',
                  mode === 'period'
                    ? 'border-primary bg-primary ring-2 ring-white ring-inset'
                    : 'border-stone-300',
                )}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <b className="text-sm">Período</b>
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  Escolha desde uma data; a data final é opcional.
                </span>
              </span>
            </button>

            {mode === 'period' ? (
              <div className="border-t bg-white px-3.5 py-3">
                <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">Desde</span>
                    <Input
                      type="date"
                      className="mt-1 min-h-11"
                      value={since}
                      max={today}
                      onChange={(event) => {
                        setSince(event.target.value)
                        setWindowError(null)
                      }}
                    />
                  </label>
                  <label className="block">
                    <span className="text-xs font-medium text-muted-foreground">
                      Até (opcional)
                    </span>
                    <Input
                      type="date"
                      className="mt-1 min-h-11"
                      value={until}
                      max={today}
                      placeholder="dd/mm/aaaa"
                      onChange={(event) => {
                        setUntil(event.target.value)
                        setWindowError(null)
                      }}
                    />
                  </label>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="min-h-8 rounded-full border px-2.5 text-xs font-medium hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setSince(subtractBahiaCivilDays(today, 30))
                      setUntil('')
                      setWindowError(null)
                    }}
                  >
                    Últimos 30 dias
                  </button>
                  <button
                    type="button"
                    className="min-h-8 rounded-full border px-2.5 text-xs font-medium hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    onClick={() => {
                      setSince(subtractBahiaCivilMonths(today, 6))
                      setUntil('')
                      setWindowError(null)
                    }}
                  >
                    Últimos 6 meses
                  </button>
                  <button
                    type="button"
                    className="min-h-8 rounded-full border px-2.5 text-xs font-medium hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-sm:hidden"
                    onClick={() => {
                      setSince(`${today.slice(0, 4)}-01-01`)
                      setUntil('')
                      setWindowError(null)
                    }}
                  >
                    Este ano
                  </button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Deixe “Até” em branco para buscar até hoje.
                </p>
              </div>
            ) : null}
          </div>
        </div>

        {windowError ? (
          <p className="mt-2 text-xs font-medium text-red-700" role="alert">
            {windowError}
          </p>
        ) : null}
      </div>

      <div className="mt-4 space-y-2 rounded-lg border bg-stone-50 p-3.5 text-xs leading-5 text-muted-foreground">
        <p className="flex gap-2">
          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b className="text-foreground">Somente novidades</b> — o que já está é reconhecido, sem
            cópias.
          </span>
        </p>
        <p className="flex gap-2">
          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b className="text-foreground">Tudo entra como Rascunho</b> — nada é publicado
            automaticamente.
          </span>
        </p>
        <p className="flex gap-2">
          <CheckIcon className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
          <span>
            <b className="text-foreground">Só o perfil oficial, pela API oficial</b> — sem scraping.
          </span>
        </p>
      </div>

      <DialogFooter className="max-sm:flex-col-reverse">
        <Button
          type="button"
          variant="outline"
          className="min-h-11 max-sm:w-full"
          onClick={() => {
            setOpen(false)
            reset()
          }}
        >
          Cancelar
        </Button>
        <Button type="button" className="min-h-11 max-sm:w-full" onClick={() => void runSearch()}>
          <SearchIcon data-icon="inline-start" aria-hidden="true" />
          Buscar publicações
        </Button>
      </DialogFooter>
    </>
  )

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
                  ? `Nenhuma novidade na ${
                      result.windowLabel ? 'janela escolhida' : 'janela recente'
                    } — a Central já estava em dia.`
                  : 'As novidades já estão na Central como rascunho. Nada foi publicado.'}
              </DialogDescription>
              {result.windowLabel ? (
                <p className="text-xs text-muted-foreground">{result.windowLabel}</p>
              ) : null}
            </DialogHeader>

            {result.truncated ? (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
                <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <div>
                  <b className="text-sm">A janela pedida é maior do que a via oficial alcança.</b> O
                  Instagram entrega as <b>10K mídias mais recentes</b>; importamos o que foi
                  possível neste recorte. Reexecutar a mesma janela continua de onde parou, sem
                  duplicar.
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-3 gap-2">
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
              <div className="mt-4 overflow-hidden rounded-lg border text-xs">
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

            <DialogFooter className="max-sm:flex-col-reverse">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 max-sm:w-full"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Fechar
              </Button>
              <Button asChild className="min-h-11 max-sm:w-full">
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
        ) : phase === 'confirm' && listing ? (
          <>
            <DialogHeader>
              <div className="mb-4 grid size-10 place-items-center rounded-full bg-red-50 text-primary">
                <InstagramIcon className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="border-b-0 pb-0">Importar do perfil</DialogTitle>
              <DialogDescription>
                A janela escolhida tem <b className="text-foreground">{listing.found}</b>{' '}
                {plural(listing.found, 'publicação', 'publicações')}. Confira o tamanho antes de
                criar os rascunhos.
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 space-y-3">
              <div className="flex items-center gap-2 rounded-lg border bg-stone-50 px-3.5 py-2.5 text-xs">
                <CalendarDaysIcon
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="font-medium">Período</span>
                <span className="text-muted-foreground">
                  {contentPieceProfileWindowLabel(periodWindow())}
                </span>
                <button
                  type="button"
                  className="ml-auto text-xs font-medium text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setPhase('window')}
                >
                  Trocar
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <b className="block text-xl tabular-nums text-green-800">
                    {listing.candidates.length}
                  </b>
                  <span className="text-xs font-medium text-green-800">novas a criar</span>
                </div>
                <div className="rounded-lg border bg-stone-50 p-3">
                  <b className="block text-xl tabular-nums">{listing.existingCount}</b>
                  <span className="text-xs font-medium text-muted-foreground">já estavam</span>
                </div>
                <div className="rounded-lg border p-3">
                  <b className="block text-xl tabular-nums">{listing.found}</b>
                  <span className="text-xs font-medium text-muted-foreground">total na janela</span>
                </div>
              </div>

              {largeWindow ? (
                <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-xs leading-5 text-amber-900">
                  <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div>
                    <b className="text-sm">Janela grande.</b> {listing.candidates.length} rascunhos
                    serão criados de uma vez. Nada é publicado — tudo entra como rascunho para
                    revisão na lista.
                  </div>
                </div>
              ) : null}

              <p className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
                Reexecutar a mesma janela não duplica: o que já está é reconhecido pela identidade
                do post. Pode demorar um pouco em janelas grandes.
              </p>
            </div>

            <DialogFooter className="max-sm:flex-col-reverse">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 max-sm:w-full"
                onClick={() => setPhase('window')}
              >
                Voltar
              </Button>
              <Button
                type="button"
                className="min-h-11 max-sm:w-full"
                onClick={() => void runCreationLoop(periodWindow(), listing)}
              >
                Importar {listing.candidates.length}{' '}
                {plural(listing.candidates.length, 'publicação', 'publicações')}
              </Button>
            </DialogFooter>
          </>
        ) : phase === 'empty' ? (
          <>
            <DialogHeader>
              <div className="mb-4 grid size-10 place-items-center rounded-full border bg-stone-50 text-stone-600">
                <CalendarXIcon className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="border-b-0 pb-0">
                Nenhuma publicação neste período
              </DialogTitle>
              <DialogDescription>
                Nada de <b className="text-foreground">{PROFILE_HANDLE}</b> foi publicado entre{' '}
                <b className="text-foreground">{formatCivilDateLabel(since)}</b> e{' '}
                <b className="text-foreground">{until ? formatCivilDateLabel(until) : 'hoje'}</b>.
              </DialogDescription>
            </DialogHeader>
            <p className="mt-4 rounded-lg border bg-stone-50 p-3.5 text-xs leading-5 text-muted-foreground">
              O recorte está vazio. Confira as datas ou importe as publicações recentes do perfil.
            </p>
            <DialogFooter className="max-sm:flex-col-reverse">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 max-sm:w-full"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Fechar
              </Button>
              <Button
                type="button"
                className="min-h-11 max-sm:w-full"
                onClick={() => setPhase('window')}
              >
                Escolher outra janela
              </Button>
            </DialogFooter>
          </>
        ) : phase === 'error' ? (
          <>
            <DialogHeader>
              <div className="mb-4 grid size-10 place-items-center rounded-full bg-red-50 text-primary">
                <InstagramIcon className="size-5" aria-hidden="true" />
              </div>
              <DialogTitle className="border-b-0 pb-0">Importar do perfil</DialogTitle>
              <DialogDescription>
                {mode === 'period' ? (
                  <>
                    A janela de{' '}
                    <b className="text-foreground">
                      {contentPieceProfileWindowLabel(periodWindow())}
                    </b>{' '}
                    não pôde ser buscada agora.
                  </>
                ) : (
                  <>As publicações recentes não puderam ser buscadas agora.</>
                )}
              </DialogDescription>
            </DialogHeader>
            <Alert variant="destructive" className="mt-4 py-2">
              <CircleAlertIcon aria-hidden="true" />
              <AlertDescription className="text-xs">
                <b>Não foi possível buscar as publicações.</b>{' '}
                {error ?? 'A API oficial não respondeu.'} Nada foi criado.
              </AlertDescription>
            </Alert>
            <DialogFooter className="max-sm:flex-col-reverse">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 max-sm:w-full"
                onClick={() => {
                  setOpen(false)
                  reset()
                }}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                className="min-h-11 max-sm:w-full"
                onClick={() => void runSearch()}
              >
                Tentar de novo
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
                    searching ? 'bg-stone-100 text-stone-500' : 'bg-green-100 text-green-700',
                  )}
                >
                  {searching ? (
                    <Spinner className="size-3.5" />
                  ) : (
                    <CheckIcon className="size-3.5" aria-hidden="true" />
                  )}
                </div>
                <div>
                  <b className="text-sm">
                    {searching
                      ? mode === 'period'
                        ? 'Buscando as publicações do período…'
                        : 'Buscando as publicações recentes…'
                      : mode === 'period' && listing
                        ? `Janela encontrada · ${listing.found} avaliadas`
                        : 'Publicações recentes encontradas'}
                  </b>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {searching
                      ? `Consultando ${PROFILE_HANDLE} pela API oficial.`
                      : mode === 'period' && listing
                        ? `${listing.candidates.length} novas · ${listing.existingCount} já estavam. A busca foi feita em ${PROFILE_HANDLE} pela API oficial.`
                        : `A busca foi feita em ${PROFILE_HANDLE} pela API oficial.`}
                  </p>
                </div>
              </div>

              {!searching && progress.total > 0 ? (
                <>
                  <div className="my-3 ml-3 h-5 border-l border-dashed" />
                  <div className="flex items-start gap-3">
                    <Spinner className="mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <b className="text-sm">
                        Importando {Math.min(progress.done + 1, progress.total)} de {progress.total}
                        …
                      </b>
                      {mode === 'period' ? (
                        <Progress
                          className="mt-2 h-2"
                          value={progressPercent}
                          aria-label="Progresso da importação"
                        />
                      ) : null}
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Criando apenas as novidades como rascunho e reconhecendo o que já estava na
                        Central.
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </div>

            <p className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              {mode === 'period' ? (
                <>
                  <b className="text-foreground">Pode demorar</b> — a janela é grande e cada mídia é
                  preparada uma a uma. O resultado final separa novas, já existentes e falhas;
                  nenhuma falha fica escondida.
                </>
              ) : (
                <>
                  Algumas mídias podem levar mais tempo para serem preparadas. O resultado final
                  separa novas, já existentes e falhas — nenhuma falha fica escondida.
                </>
              )}
            </p>

            <DialogFooter>
              <Button type="button" variant="secondary" className="min-h-11" disabled>
                <Spinner data-icon="inline-start" aria-hidden="true" />
                Importando…
              </Button>
            </DialogFooter>
          </>
        ) : (
          windowStep
        )}
      </DialogContent>
    </Dialog>
  )
}
