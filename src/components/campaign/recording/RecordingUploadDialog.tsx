'use client'

import { CircleAlertIcon, FileIcon, UploadIcon, VideoIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'

import type {
  RecordingChunkResponse,
  RecordingUploadStartResponse,
} from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/types'
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
import {
  CAMPAIGN_RECORDING_UPLOAD_HREF,
  campaignRecordingUploadSessionHref,
} from '@/lib/campaignPaths'
import {
  formatRecordingFileSize,
  RECORDING_FILE_REQUIRED_MESSAGE,
  RECORDING_FILE_TYPE_MESSAGE,
  RECORDING_TITLE_MAX_LENGTH,
  RECORDING_TITLE_REQUIRED_MESSAGE,
  RECORDING_UPLOAD_REJECTED_MESSAGE,
  recordingFileTypeAllowed,
} from '@/lib/recording'
import { cn } from '@/lib/utils'

const GENERIC_ERROR_MESSAGE = 'Não foi possível enviar a gravação. Tente novamente.'

type UploadPhase = 'idle' | 'uploading' | 'error'

type RecordingUploadDialogProps = {
  /** Layout of the trigger ("Enviar gravação" in the header and the empty state). */
  triggerClassName?: string
  triggerVariant?: 'default' | 'outline'
  triggerLabel?: string
  /** Icon-only triggers (mobile header row) still need an accessible name. */
  triggerAriaLabel?: string
}

/**
 * C199/C199-fix — the one upload surface of the recordings source. Starts a
 * session and sends the file in parts (the production edge refuses a single
 * request body above ~100 MB with a 413 before the app sees it), with XHR for a
 * real `upload.onprogress` per part and the metadata in the query string; the
 * dialog stays open and unclosable while the file is in flight, per the
 * approved design.
 */
export const RecordingUploadDialog = ({
  triggerClassName,
  triggerVariant = 'default',
  triggerLabel = 'Enviar gravação',
  triggerAriaLabel,
}: RecordingUploadDialogProps) => {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const xhrRef = useRef<XMLHttpRequest | null>(null)
  const uploadIdRef = useRef<number | null>(null)

  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [phase, setPhase] = useState<UploadPhase>('idle')
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const uploading = phase === 'uploading'

  // A failed or abandoned upload must not linger as a phantom "Enviando": the
  // abort endpoint discards the row AND its temp session, and only while the
  // row is still `uploading` — a final part whose response was lost keeps the
  // finalized recording. Best-effort; the reaper backstops a crash, and
  // `keepalive` lets the DELETE survive a navigation.
  const discardSession = () => {
    const uploadId = uploadIdRef.current
    uploadIdRef.current = null
    if (uploadId === null) return
    void fetch(campaignRecordingUploadSessionHref(uploadId), {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      keepalive: true,
    }).catch(() => undefined)
  }

  // Navigating away unmounts the dialog: abort the in-flight part instead of
  // leaving an invisible multi-GB upload running, and discard the session.
  useEffect(
    () => () => {
      xhrRef.current?.abort()
      xhrRef.current = null
      discardSession()
    },
    [],
  )

  const reset = () => {
    setFile(null)
    setTitle('')
    setRecordedAt('')
    setPhase('idle')
    setProgress(0)
    setFileError(null)
    setTitleError(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.files?.[0] ?? null
    setFileError(null)
    if (!next) {
      setFile(null)
      return
    }
    // The refused file stays visible with its name/size; the error below the
    // picker explains the refusal and blocks the submit (approved scene 10).
    setFile(next)
    if (!recordingFileTypeAllowed(next.type)) {
      setFileError(RECORDING_FILE_TYPE_MESSAGE)
    }
  }

  const fail = (message: string) => {
    setPhase('error')
    setError(message)
    discardSession()
  }

  const parseJson = <T,>(text: string): T | null => {
    try {
      return JSON.parse(text) as T
    } catch {
      return null
    }
  }

  const submit = async () => {
    const nextTitle = title.trim()
    setTitleError(null)
    setError(null)

    if (!file) {
      setFileError(RECORDING_FILE_REQUIRED_MESSAGE)
      return
    }
    if (fileError) return
    if (!nextTitle) {
      setTitleError(RECORDING_TITLE_REQUIRED_MESSAGE)
      return
    }
    const selectedFile = file

    const params = new URLSearchParams({
      title: nextTitle,
      filename: selectedFile.name,
      size: String(selectedFile.size),
    })
    if (recordedAt) params.set('recordedAt', recordedAt)

    setPhase('uploading')
    setProgress(0)

    // 1) Start the session: visible row + temp file the parts will grow.
    let started: { id: number; chunkSize: number }
    try {
      const response = await fetch(`${CAMPAIGN_RECORDING_UPLOAD_HREF}?${params.toString()}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      })
      const payload = parseJson<RecordingUploadStartResponse>(await response.text())
      if (!response.ok || !payload || payload.status !== 'success') {
        fail(payload && payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
        return
      }
      started = { id: payload.recording.id, chunkSize: payload.chunkSize }
    } catch {
      fail(GENERIC_ERROR_MESSAGE)
      return
    }

    uploadIdRef.current = started.id
    const totalChunks = Math.max(1, Math.ceil(selectedFile.size / started.chunkSize))

    // 2) Send the parts strictly in order; the last one finalizes the upload.
    const sendChunk = (index: number) => {
      const start = index * started.chunkSize
      const chunk = selectedFile.slice(
        start,
        Math.min(start + started.chunkSize, selectedFile.size),
      )
      const xhr = new XMLHttpRequest()
      xhrRef.current = xhr

      xhr.open('POST', `${campaignRecordingUploadSessionHref(started.id)}?index=${index}`)
      xhr.setRequestHeader('Accept', 'application/json')
      xhr.upload.addEventListener('progress', (event) => {
        if (selectedFile.size === 0) return
        const loaded = start + (event.lengthComputable ? event.loaded : 0)
        setProgress(Math.min(99, Math.round((loaded / selectedFile.size) * 100)))
      })
      xhr.addEventListener('load', () => {
        xhrRef.current = null
        // A 413 comes from a proxy/edge, not from the app: the body never
        // arrived and no JSON envelope exists.
        if (xhr.status === 413) {
          fail(RECORDING_UPLOAD_REJECTED_MESSAGE)
          return
        }
        const payload = parseJson<RecordingChunkResponse>(xhr.responseText)
        if (xhr.status < 200 || xhr.status >= 300 || !payload || payload.status !== 'success') {
          fail(payload && payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
          return
        }
        if (payload.done) {
          uploadIdRef.current = null
          setProgress(100)
          reset()
          setOpen(false)
          router.refresh()
          return
        }
        if (index + 1 >= totalChunks) {
          // The server did not reach the declared size: the file is not the
          // same the dialog measured.
          fail(GENERIC_ERROR_MESSAGE)
          return
        }
        sendChunk(index + 1)
      })
      xhr.addEventListener('error', () => {
        xhrRef.current = null
        fail(GENERIC_ERROR_MESSAGE)
      })
      xhr.send(chunk)
    }

    sendChunk(0)
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
          {/* The frontend prose base styles every `h2` with a bottom border;
              the approved dialog header is a single block (scene 4). */}
          <DialogTitle className="border-b-0 pb-0">
            {uploading ? 'Enviando gravação' : 'Enviar gravação'}
          </DialogTitle>
          <DialogDescription>
            {uploading
              ? 'Mantenha esta janela aberta até concluir.'
              : 'Adicione um arquivo local ao acervo.'}
          </DialogDescription>
        </DialogHeader>

        {uploading ? (
          <div className="rounded-lg border bg-stone-50 p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white text-muted-foreground ring-1 ring-border">
                <VideoIcon className="size-5" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{file?.name}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {title.trim()}
                  {recordedAt ? ` · ${recordedAt.split('-').reverse().join('/')}` : ''}
                </p>
              </div>
              <span className="ml-auto text-sm font-semibold tabular-nums">{progress}%</span>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-muted"
              aria-label={`${progress}% enviado`}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="mt-2 flex justify-between text-xs text-muted-foreground">
              <span>Enviando arquivo…</span>
              <span>{progress}%</span>
            </div>
            <p className="mt-4 rounded-lg bg-muted/70 p-3 text-xs leading-5 text-muted-foreground">
              Quando o envio terminar, a gravação aparecerá na lista como “Processando”.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <Label htmlFor="recording-file">Arquivo de vídeo</Label>
              <input
                ref={fileInputRef}
                id="recording-file"
                type="file"
                accept="video/*,.mkv,.mov,.mp4"
                className="sr-only"
                onChange={onFileChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'mt-1.5 flex min-h-28 w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 text-center transition-colors',
                  fileError
                    ? 'border-destructive bg-red-50/40'
                    : 'border-input bg-stone-50 hover:bg-stone-100',
                )}
              >
                {file ? (
                  <>
                    <FileIcon
                      className={cn(
                        'size-6',
                        fileError ? 'text-destructive' : 'text-muted-foreground',
                      )}
                      aria-hidden="true"
                    />
                    <span className="mt-2 text-sm font-medium">{file.name}</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      {formatRecordingFileSize(file.size)}
                    </span>
                  </>
                ) : (
                  <>
                    <UploadIcon className="size-6 text-muted-foreground" aria-hidden="true" />
                    <span className="mt-2 text-sm font-medium">Selecionar arquivo local</span>
                    <span className="mt-1 text-xs text-muted-foreground">
                      MP4, MOV, MKV e formatos compatíveis
                    </span>
                  </>
                )}
              </button>
              {fileError ? (
                <>
                  <Alert variant="destructive" className="mt-2 py-2">
                    <CircleAlertIcon aria-hidden="true" />
                    <AlertDescription className="text-xs">{fileError}</AlertDescription>
                  </Alert>
                  <p className="mt-2 text-xs text-muted-foreground">
                    MP4, MOV, MKV e formatos compatíveis
                  </p>
                </>
              ) : null}
            </div>

            <div
              className={cn('flex flex-col gap-4', fileError && 'pointer-events-none opacity-60')}
              aria-disabled={fileError ? true : undefined}
            >
              <div>
                <Label htmlFor="recording-title">
                  Título <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="recording-title"
                  value={title}
                  maxLength={RECORDING_TITLE_MAX_LENGTH}
                  onChange={(event) => {
                    setTitle(event.target.value)
                    if (titleError) setTitleError(null)
                  }}
                  placeholder="Título da gravação"
                  className="mt-1.5 min-h-11"
                  aria-invalid={titleError ? true : undefined}
                />
                {titleError ? (
                  <p role="alert" className="mt-1 text-xs text-destructive">
                    {titleError}
                  </p>
                ) : null}
              </div>

              <div>
                <Label htmlFor="recording-date">Data da gravação</Label>
                <Input
                  id="recording-date"
                  type="date"
                  value={recordedAt}
                  onChange={(event) => setRecordedAt(event.target.value)}
                  className="mt-1.5 min-h-11"
                />
              </div>
            </div>
          </div>
        )}

        {error ? (
          <Alert variant="destructive" className="py-2" role="alert">
            <CircleAlertIcon aria-hidden="true" />
            <AlertDescription className="text-xs">{error}</AlertDescription>
          </Alert>
        ) : null}

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
                disabled={Boolean(fileError)}
                onClick={submit}
              >
                <UploadIcon data-icon="inline-start" aria-hidden="true" />
                Enviar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
