'use client'

import { CircleAlertIcon, PaperclipIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState, type ChangeEvent } from 'react'

import type { ContentPieceAttachResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/conteudos/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
import { campaignContentPieceFileHref } from '@/lib/campaignPaths'
import {
  CONTENT_PIECE_ACCEPT,
  CONTENT_PIECE_MAX_BYTES,
  contentPieceTooLargeMessage,
} from '@/lib/contentPiece'

const GENERIC_ERROR_MESSAGE = 'Não foi possível anexar o arquivo. Tente novamente.'

/**
 * C211 — "Anexar arquivo original" of a peça-link (approved design scene 3): the
 * assessoria supplies the file when the platform offered no official path, and
 * the piece runs the same processing as an upload. Raw body via XHR, like the
 * batch dialog — the same route that serves the file accepts the POST.
 */
export const ContentPieceAttachFileButton = ({
  contentPieceId,
  className,
}: {
  contentPieceId: number
  className?: string
}) => {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null
    if (inputRef.current) inputRef.current.value = ''
    if (!file) return

    if (file.size > CONTENT_PIECE_MAX_BYTES) {
      setError(contentPieceTooLargeMessage(file.size))
      return
    }

    const params = new URLSearchParams({ filename: file.name })
    const xhr = new XMLHttpRequest()
    setSubmitting(true)
    setError(null)

    xhr.open('POST', `${campaignContentPieceFileHref(contentPieceId)}?${params.toString()}`)
    xhr.setRequestHeader('Accept', 'application/json')
    xhr.addEventListener('load', () => {
      setSubmitting(false)
      try {
        const payload = JSON.parse(xhr.responseText) as ContentPieceAttachResponse
        if (xhr.status >= 200 && xhr.status < 300 && payload.status === 'success') {
          router.refresh()
          return
        }
        setError(payload.status === 'error' ? payload.message : GENERIC_ERROR_MESSAGE)
      } catch {
        setError(GENERIC_ERROR_MESSAGE)
      }
    })
    xhr.addEventListener('error', () => {
      setSubmitting(false)
      setError(GENERIC_ERROR_MESSAGE)
    })
    xhr.send(file)
  }

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept={CONTENT_PIECE_ACCEPT}
        className="sr-only"
        onChange={onFileChange}
      />
      <Button
        type="button"
        variant="outline"
        className="min-h-11"
        disabled={submitting}
        onClick={() => inputRef.current?.click()}
      >
        {submitting ? (
          <Spinner data-icon="inline-start" aria-hidden="true" />
        ) : (
          <PaperclipIcon data-icon="inline-start" aria-hidden="true" />
        )}
        {submitting ? 'Anexando…' : 'Anexar arquivo original'}
      </Button>
      {error ? (
        <Alert variant="destructive" className="mt-2 py-2">
          <CircleAlertIcon aria-hidden="true" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
