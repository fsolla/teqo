'use client'

import { CircleAlertIcon, FileIcon, UploadIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import type { ContentPieceUploadResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
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
import { Spinner } from '@/components/ui/Spinner'
import { CAMPAIGN_CONTENT_PIECE_UPLOAD_HREF } from '@/lib/campaignPaths'
import {
  CONTENT_PIECE_ACCEPT,
  CONTENT_PIECE_BATCH_HELP,
  CONTENT_PIECE_BATCH_LIMIT_MESSAGE,
  CONTENT_PIECE_BATCH_MAX_FILES,
  CONTENT_PIECE_MAX_BYTES,
  CONTENT_PIECE_MAX_SIZE_LABEL,
  contentPieceTooLargeMessage,
  contentPieceTypeFromMime,
} from '@/lib/contentPiece'
import { formatRecordingFileSize } from '@/lib/recording'
import { cn } from '@/lib/utils'

const GENERIC_ERROR_MESSAGE = 'Não foi possível enviar a peça. Tente novamente.'

/** Two uploads in flight at once: real progress per file without saturating the box. */
const MAX_CONCURRENT_UPLOADS = 2

type FilePhase = 'queued' | 'uploading' | 'uploaded' | 'failed'

type BatchFile = {
  /** Stable key: the File object identity survives a state update. */
  id: string
  file: File
  phase: FilePhase
  progress: number
  error: string | null
}

const newId = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`

/**
 * C211 — the batch upload surface of the Central (approved design scenes 2 and
 * 5): each picked file becomes an independent draft, uploads run two at a time
 * with real `upload.onprogress`, and a failed file never stops the others. The
 * same raw-body route as the C199 recording upload, one request per file.
 */
export const ContentPieceUploadDialog = ({
  triggerClassName,
  triggerVariant = 'default',
  triggerLabel = 'Enviar peças',
  triggerAriaLabel,
}: {
  triggerClassName?: string
  triggerVariant?: 'default' | 'outline'
  triggerLabel?: string
  triggerAriaLabel?: string
}) => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrsRef = useRef(new Map<string, XMLHttpRequest>())
  const queueRef = useRef<string[]>([])
  const filesRef = useRef<BatchFile[]>([])

  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<BatchFile[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const uploading = files.some((entry) => entry.phase === 'uploading')

  useEffect(() => {
    filesRef.current = files
  }, [files])

  // Navigating away unmounts the dialog: abort the in-flight uploads instead of
  // leaving invisible multi-GB transfers running.
  useEffect(
    () => () => {
      for (const xhr of xhrsRef.current.values()) xhr.abort()
      xhrsRef.current.clear()
    },
    [],
  )

  const updateFile = (id: string, patch: Partial<BatchFile>) => {
    setFiles((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    )
  }

  const reset = () => {
    for (const xhr of xhrsRef.current.values()) xhr.abort()
    xhrsRef.current.clear()
    queueRef.current = []
    setFiles([])
    setNotice(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const drainQueue = () => {
    while (xhrsRef.current.size < MAX_CONCURRENT_UPLOADS && queueRef.current.length > 0) {
      const nextId = queueRef.current.shift()
      if (!nextId) return
      const entry = filesRef.current.find((item) => item.id === nextId)
      if (entry && entry.phase === 'queued') uploadOne(entry)
    }
  }

  const uploadOne = (entry: BatchFile) => {
    const params = new URLSearchParams({ filename: entry.file.name })
    const xhr = new XMLHttpRequest()
    xhrsRef.current.set(entry.id, xhr)
    updateFile(entry.id, { phase: 'uploading', progress: 0, error: null })

    xhr.open('POST', `${CAMPAIGN_CONTENT_PIECE_UPLOAD_HREF}?${params.toString()}`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && event.total > 0) {
        updateFile(entry.id, { progress: Math.round((event.loaded / event.total) * 100) })
      }
    })
    const settle = (patch: Partial<BatchFile>) => {
      xhrsRef.current.delete(entry.id)
      updateFile(entry.id, patch)
      drainQueue()
    }
    xhr.addEventListener('load', () => {
      try {
        const payload = JSON.parse(xhr.responseText) as ContentPieceUploadResponse
        if (xhr.status >= 200 && xhr.status < 300 && payload.status === 'success') {
          settle({ phase: 'uploaded', progress: 100, error: null })
        } else {
          settle({
            phase: 'failed',
            error: payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE,
          })
        }
      } catch {
        settle({ phase: 'failed', error: GENERIC_ERROR_MESSAGE })
      }
    })
    const onTransportError = () => settle({ phase: 'failed', error: GENERIC_ERROR_MESSAGE })
    xhr.addEventListener('error', onTransportError)
    xhr.addEventListener('abort', onTransportError)
    xhr.send(entry.file)
  }

  const retry = (entry: BatchFile) => {
    queueRef.current.push(entry.id)
    updateFile(entry.id, { phase: 'queued', progress: 0, error: null })
    window.setTimeout(() => drainQueue(), 0)
  }

  const onFilesChange = (event: ChangeEvent<HTMLInputElement>) => {
    setNotice(null)
    const picked = [...(event.target.files ?? [])]
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (picked.length === 0) return
    if (filesRef.current.length + picked.length > CONTENT_PIECE_BATCH_MAX_FILES) {
      setNotice(CONTENT_PIECE_BATCH_LIMIT_MESSAGE)
      return
    }

    const accepted: BatchFile[] = []
    let refusedReason: string | null = null
    for (const file of picked) {
      if (contentPieceTypeFromMime(file.type, file.name) === null) {
        refusedReason ??= 'Alguns arquivos foram ignorados: envie vídeo, áudio, foto ou texto.'
        continue
      }
      if (file.size > CONTENT_PIECE_MAX_BYTES) {
        refusedReason ??= contentPieceTooLargeMessage(file.size)
        continue
      }
      accepted.push({ id: newId(), file, phase: 'queued', progress: 0, error: null })
    }

    setFiles((current) => [...current, ...accepted])
    if (refusedReason) setNotice(refusedReason)
    for (const entry of accepted) queueRef.current.push(entry.id)
    // Let the state commit before the queue reads it.
    window.setTimeout(() => drainQueue(), 0)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (uploading) return
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant={triggerVariant}
          className={cn('min-h-11', triggerClassName)}
          aria-label={triggerAriaLabel}
        >
          <UploadIcon data-icon="inline-start" aria-hidden="true" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        onInteractOutside={(event) => {
          if (uploading) event.preventDefault()
        }}
        onEscapeKeyDown={(event) => {
          if (uploading) event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="border-b-0 pb-0">Enviar peças</DialogTitle>
          <DialogDescription>{CONTENT_PIECE_BATCH_HELP}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div>
            <input
              ref={fileInputRef}
              id="content-piece-files"
              type="file"
              multiple
              accept={CONTENT_PIECE_ACCEPT}
              className="sr-only"
              onChange={onFilesChange}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed border-input bg-stone-50 px-4 text-center transition-colors hover:bg-stone-100"
            >
              <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
              <span className="mt-2 text-sm font-medium">Selecionar arquivos</span>
              <span className="mt-1 text-xs text-muted-foreground">
                Vídeo, foto, áudio, texto ou card · até {CONTENT_PIECE_MAX_SIZE_LABEL} cada
              </span>
            </button>
            {notice ? (
              <Alert variant="destructive" className="mt-2 py-2" role="alert">
                <CircleAlertIcon aria-hidden="true" />
                <AlertDescription className="text-xs">{notice}</AlertDescription>
              </Alert>
            ) : null}
          </div>

          {files.length > 0 ? (
            <ul className="max-h-72 space-y-3 overflow-y-auto">
              {files.map((entry) => (
                <li
                  key={entry.id}
                  className={cn(
                    'rounded-lg border p-3',
                    entry.phase === 'failed' && 'border-red-200 bg-red-50',
                  )}
                >
                  {entry.phase === 'uploading' ? (
                    <>
                      <div className="flex justify-between gap-3 text-sm">
                        <b className="min-w-0 truncate">{entry.file.name}</b>
                        <b className="tabular-nums">{entry.progress}%</b>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-[width]"
                          style={{ width: `${entry.progress}%` }}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <FileIcon
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        <div className="min-w-0">
                          <b className="block truncate text-sm">{entry.file.name}</b>
                          {entry.phase === 'failed' ? (
                            <p className="mt-0.5 text-xs text-red-800">
                              {entry.error ?? GENERIC_ERROR_MESSAGE} Os outros continuam.
                            </p>
                          ) : (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {formatRecordingFileSize(entry.file.size)} ·{' '}
                              {entry.phase === 'queued' ? 'na fila' : 'enviado'}
                            </p>
                          )}
                        </div>
                      </div>
                      {entry.phase === 'failed' ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 shrink-0 md:min-h-9"
                          onClick={() => retry(entry)}
                        >
                          Tentar de novo
                        </Button>
                      ) : entry.phase === 'uploaded' ? (
                        <span className="inline-flex shrink-0 items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-800">
                          Enviado
                        </span>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : null}

          {uploading ? (
            <p className="rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              Cada arquivo vira um rascunho independente. Mantenha esta janela aberta até concluir.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          {uploading ? (
            <Button type="button" className="min-h-11 min-w-36" disabled>
              <Spinner data-icon="inline-start" aria-hidden="true" />
              Enviando…
            </Button>
          ) : (
            <>
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
              <Button
                type="button"
                className="min-h-11"
                disabled={files.length === 0}
                onClick={() => {
                  reset()
                  setOpen(false)
                  router.refresh()
                }}
              >
                Concluir lote
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
