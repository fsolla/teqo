'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { CopyLinkButton } from '@/components/CopyLinkButton'
import { WhatsAppIcon } from '@/components/socialIcons'
import type { ContentPiecePublicItem } from '@/lib/contentPieceCatalog'
import {
  buildContentPieceWhatsAppUrl,
  contentPieceShareLink,
  contentPieceVoteMessage,
} from '@/lib/contentPieceShare'
import { cn } from '@/lib/utils'

import {
  CONTENT_PIECE_FOCUS,
  CONTENT_PIECE_OUTLINE_BUTTON,
  CONTENT_PIECE_PRIMARY_BUTTON,
} from './contentPieceClasses'

/**
 * S27 — the share sheet (artefato: cenas 03/08): the vote message prefilled and
 * EDITABLE, then `wa.me` of the sender's own WhatsApp — no recipient, nothing
 * sent by the system. "A mídia" opens the native share sheet with the file
 * where the device supports it and downloads the same file where it does not
 * (never pretending the file was attached). The sheet portals to the body so
 * no card overflow can clip it.
 */
export const ContentPieceShareSheet = ({
  item,
  onClose,
}: {
  item: ContentPiecePublicItem
  onClose: () => void
}) => {
  const [mounted, setMounted] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const shareLink = contentPieceShareLink(item, window.location.origin)
  const [message, setMessage] = useState(() =>
    contentPieceVoteMessage(item.type, item.title, shareLink),
  )

  useEffect(() => {
    setMounted(true)
    // Focus moves into the dialog on open and back to the trigger on close.
    const previousFocus = document.activeElement as HTMLElement | null
    textareaRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previousFocus?.focus?.()
    }
  }, [onClose])

  const shareMedia = async () => {
    const mediaFile = item.file
    if (!mediaFile || preparing) return
    setPreparing(true)
    const path = mediaFile.path

    try {
      const response = await fetch(path)
      if (!response.ok) throw new Error('fetch failed')
      const blob = await response.blob()
      const file = new File([blob], mediaFile.downloadFilename, {
        type: blob.type || 'application/octet-stream',
      })

      if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: item.title })
          return
        } catch (error) {
          // A cancelled share sheet is not a failure: never download instead.
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
    } catch {
      // The honest fallback below is the download of the same file.
    } finally {
      setPreparing(false)
    }

    const anchor = document.createElement('a')
    anchor.href = `${path}?download=1`
    anchor.download = mediaFile.downloadFilename
    anchor.click()
  }

  if (!mounted) return null

  return createPortal(
    // The portal lands outside the `campaign-site` layout, so the sheet carries
    // its own theme: without it every campaign token resolves to nothing (the
    // default `:root` foreground is near-white) and the panel fades away.
    <div data-theme="campaign-site" className="fixed inset-0 z-50 text-(--campaign-ink)">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fechar compartilhamento"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/12"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Compartilhar peça"
        className={cn(
          'absolute inset-x-0 bottom-0 rounded-t-2xl border border-black/12 bg-white p-4 shadow-[0_-12px_35px_rgb(0_0_0/12%)]',
          'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[430px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-5 sm:shadow-[0_20px_55px_rgb(0_0_0/22%)]',
        )}
      >
        <div
          aria-hidden="true"
          className="mx-auto mb-3 h-1 w-10 rounded-full bg-stone-300 sm:hidden"
        />
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="border-0 pb-0 font-[family-name:var(--font-exo2)] text-xl font-black">
              Peça esse voto no WhatsApp
            </h2>
            <p className="mt-1 text-xs text-(--campaign-muted)">
              A mensagem é sua: revise antes de abrir.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full border border-black/10 text-lg text-(--campaign-muted) hover:text-black',
              CONTENT_PIECE_FOCUS,
            )}
          >
            ×
          </button>
        </div>

        <label className="sr-only" htmlFor="content-piece-share-message">
          Mensagem para compartilhar
        </label>
        <textarea
          id="content-piece-share-message"
          ref={textareaRef}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          className="mt-4 min-h-32 w-full resize-none rounded-[10px] border border-black/18 bg-white p-3 text-sm leading-5 text-black focus-visible:border-(--pt-red) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red)"
        />

        <a
          href={buildContentPieceWhatsAppUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${CONTENT_PIECE_PRIMARY_BUTTON} mt-3 w-full`}
        >
          <WhatsAppIcon className="size-4" />
          Abrir no WhatsApp
        </a>

        <div className={cn('mt-3 grid gap-2', item.file ? 'grid-cols-2' : 'grid-cols-1')}>
          {item.file ? (
            <button
              type="button"
              onClick={() => void shareMedia()}
              disabled={preparing}
              className={cn(CONTENT_PIECE_OUTLINE_BUTTON, 'disabled:opacity-70')}
            >
              {preparing ? 'Preparando…' : 'A mídia'}
            </button>
          ) : null}
          <CopyLinkButton url={shareLink} className={CONTENT_PIECE_OUTLINE_BUTTON} />
        </div>

        <p className="mt-3 text-center text-[11px] leading-4 text-(--campaign-muted)">
          Sem destinatário e sem envio automático.
          {item.file ? ' Se o aparelho não compartilhar o arquivo, ele será baixado.' : ''}
        </p>
      </aside>
    </div>,
    document.body,
  )
}
