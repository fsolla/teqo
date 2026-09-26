'use client'

import { X } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'

import type { ArchivePhotoPublicItem } from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_FOCUS, ARCHIVE_PHOTO_PRIMARY_BUTTON } from './archivePhotoClasses'

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled])'

/**
 * C233 — one photo in context (artefato: cena 03), always a dialog over the
 * grid: `?foto=<id>` is not canonical and `/fotos/<id>` keeps 404ing, so the
 * photo never gains an indexable page of its own. The whole overlay is the
 * `role="dialog"` (the back/close bar belongs to the modal tree), Tab is
 * confined to it, "Voltar ao álbum" and "Fechar" are real links to the same
 * filtered URL without `foto` (they work with JS off), focus starts on "Voltar"
 * — and returns to the card on close — and Esc runs the same client-side
 * navigation. The image is the resized public derivative through the private
 * proxy; the removal block only renders when the album has a valid channel.
 */
export const ArchivePhotoLightbox = ({
  item,
  closeHref,
  removalChannelUrl,
}: {
  item: ArchivePhotoPublicItem
  closeHref: string
  removalChannelUrl: string | null
}) => {
  const backRef = useRef<HTMLAnchorElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    backRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Esc runs the same client-side navigation as the close links.
        router.push(closeHref)
        return
      }
      if (event.key !== 'Tab') return

      const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!focusables || focusables.length === 0) return
      const first = focusables[0]!
      const last = focusables[focusables.length - 1]!
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      // Closing (link, Esc or backdrop) returns focus to the card behind.
      document.querySelector<HTMLElement>(`a[data-photo-id="${item.id}"]`)?.focus()
    }
  }, [closeHref, item.id, router])

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="album-photo-dialog-title"
      className="fixed inset-0 z-50 text-white"
    >
      <Link
        href={closeHref}
        aria-label="Fechar foto e voltar à grade"
        tabIndex={-1}
        className="absolute inset-0 cursor-default bg-[#171412]/82 backdrop-blur-[2px]"
      />
      <div className="absolute inset-0 overflow-y-auto p-4 sm:p-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link
              ref={backRef}
              href={closeHref}
              className={`inline-flex min-h-11 items-center gap-2 rounded-lg border border-(--pt-yellow) px-4 text-sm font-bold text-white ${ARCHIVE_PHOTO_FOCUS}`}
            >
              ← Voltar ao álbum
            </Link>
            <Link
              href={closeHref}
              aria-label="Fechar foto e voltar à grade"
              className={`grid size-11 place-items-center rounded-full bg-white/10 hover:bg-white/20 ${ARCHIVE_PHOTO_FOCUS}`}
            >
              <X aria-hidden="true" className="size-5" />
            </Link>
          </div>

          <div className="grid overflow-hidden rounded-2xl bg-[#211d1b] shadow-[0_28px_80px_rgb(0_0_0/40%)] sm:grid-cols-[minmax(0,1fr)_340px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- private proxy path with on-demand headers */}
            <img
              src={item.mediaPath}
              alt={item.alt}
              // The CSS box owns the layout (object-contain + max-h); the
              // attributes are the intrinsic hint for the pre-JS layout.
              width={1200}
              height={900}
              className="max-h-[60vh] w-full bg-[#171412] object-contain sm:max-h-none sm:min-h-[650px] sm:object-cover"
            />
            <aside className="flex flex-col p-5 sm:p-7">
              <p className="text-xs font-black tracking-[0.1em] text-(--pt-yellow) uppercase">
                Registro aprovado
              </p>
              <h2
                id="album-photo-dialog-title"
                className="mt-3 font-[family-name:var(--font-exo2)] text-xl leading-tight font-black sm:text-2xl"
              >
                {item.title}
              </h2>
              <dl className="mt-6 grid gap-5 text-sm">
                {item.dateLabel ? (
                  <div>
                    <dt className="font-bold text-white/55">Data</dt>
                    <dd className="mt-1">{item.dateLabel}</dd>
                  </div>
                ) : null}
                {item.municipalityName ? (
                  <div>
                    <dt className="font-bold text-white/55">Local</dt>
                    <dd className="mt-1">{item.municipalityName} · Bahia</dd>
                  </div>
                ) : null}
                {item.sceneLabel ? (
                  <div>
                    <dt className="font-bold text-white/55">Atividade</dt>
                    <dd className="mt-1">{item.sceneLabel}</dd>
                  </div>
                ) : null}
                {item.peopleLabel ? (
                  <div>
                    <dt className="font-bold text-white/55">Quem aparece</dt>
                    <dd className="mt-1">{item.peopleLabel}</dd>
                  </div>
                ) : null}
              </dl>

              <a
                href={item.downloadPath}
                download={item.downloadFilename}
                className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-7 w-full`}
              >
                Baixar foto
              </a>

              {removalChannelUrl ? (
                <div className="mt-auto border-t border-white/15 pt-5">
                  <p className="m-0 text-sm font-bold">É você nesta foto?</p>
                  <a
                    href={removalChannelUrl}
                    className={`mt-1 inline-flex min-h-11 items-center rounded-sm text-sm text-white/70 underline underline-offset-4 ${ARCHIVE_PHOTO_FOCUS}`}
                  >
                    Peça a remoção desta imagem
                  </a>
                </div>
              ) : null}
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
