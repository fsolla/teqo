'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import {
  ARCHIVE_PHOTO_ALBUM_FACETS,
  ARCHIVE_PHOTO_ALBUM_PATH,
  archivePhotoAlbumFacetLabels,
  type ArchivePhotoAlbumFacets,
  type ArchivePhotoAlbumParams,
} from '@/lib/archivePhotoPublicCatalog'
import { cn } from '@/lib/utils'

import {
  ARCHIVE_PHOTO_CHIP,
  ARCHIVE_PHOTO_FOCUS,
  ARCHIVE_PHOTO_PRIMARY_BUTTON,
} from './archivePhotoClasses'

const SELECT_CLASS =
  'mt-1.5 h-11 w-full rounded-[10px] border border-black/20 bg-white px-3 font-normal focus-visible:border-(--pt-red) focus-visible:outline-[3px] focus-visible:outline-offset-[2px] focus-visible:outline-(--pt-red)'

const FOCUSABLE = 'a[href]:not([tabindex="-1"]), button:not([disabled]), select:not([disabled])'

const ANY_LABELS = {
  data: 'Qualquer data',
  municipio: 'Qualquer município',
  atividade: 'Todas as atividades',
  pessoa: 'Qualquer pessoa',
} as const

/**
 * C233 — the mobile facet sheet (artefato: cena 02): the "Filtros" trigger opens
 * a bottom sheet with one select per facet and a GET submit ("Ver fotos"), the
 * URL staying the state. The panel portals to the body with its own
 * `campaign-site` theme — same contract as the share sheet — and the trigger is
 * the only piece of this surface that needs JS; the sheet never traps the page
 * without it (the album still reads and paginates).
 */
export const ArchivePhotoFiltersSheet = ({
  params,
  facets,
  activeCount,
}: {
  params: ArchivePhotoAlbumParams
  facets: ArchivePhotoAlbumFacets
  activeCount: number
}) => {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)
  const firstFieldRef = useRef<HTMLSelectElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => setMounted(true), [])

  const close = useCallback(() => {
    setOpen(false)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    firstFieldRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
        return
      }
      if (event.key !== 'Tab') return

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
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
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, open])

  const fields = ARCHIVE_PHOTO_ALBUM_FACETS.map((facet) => ({
    facet,
    label: archivePhotoAlbumFacetLabels[facet],
    anyLabel: ANY_LABELS[facet],
    options: facets[facet],
  }))

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className={ARCHIVE_PHOTO_CHIP}
      >
        <SlidersHorizontal aria-hidden="true" className="size-4" />
        Filtros{activeCount > 0 ? ` · ${activeCount}` : ''}
      </button>

      {mounted && open
        ? createPortal(
            // The portal lands outside the `campaign-site` layout, so the sheet
            // carries its own theme (same reason as the share sheet).
            <div data-theme="campaign-site" className="fixed inset-0 z-50 text-(--campaign-ink)">
              <button
                type="button"
                tabIndex={-1}
                aria-label="Fechar filtros"
                onClick={close}
                className="absolute inset-0 h-full w-full cursor-default bg-black/12"
              />
              <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label="Filtros do álbum"
                className={cn(
                  'absolute inset-x-0 bottom-0 overscroll-contain rounded-t-2xl border border-black/12 bg-white px-5 pt-4 pb-7 shadow-[0_-16px_44px_rgb(0_0_0/18%)]',
                  'sm:inset-x-auto sm:top-1/2 sm:bottom-auto sm:left-1/2 sm:w-[430px] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6 sm:shadow-[0_20px_55px_rgb(0_0_0/22%)]',
                )}
              >
                <div
                  aria-hidden="true"
                  className="mx-auto mb-4 h-1 w-10 rounded-full bg-stone-300 sm:hidden"
                />
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-black tracking-[0.08em] text-(--pt-red) uppercase">
                      Filtros
                    </p>
                    <h2 className="font-[family-name:var(--font-exo2)] text-xl font-black">
                      Refine sua busca
                    </h2>
                  </div>
                  <button
                    type="button"
                    aria-label="Fechar"
                    onClick={close}
                    className={`grid size-11 place-items-center rounded-full bg-(--campaign-band) ${ARCHIVE_PHOTO_FOCUS}`}
                  >
                    <X aria-hidden="true" className="size-4" />
                  </button>
                </div>

                <form action={ARCHIVE_PHOTO_ALBUM_PATH} method="get" className="mt-5">
                  <input type="hidden" name="q" value={params.q} />
                  <div className="grid gap-4">
                    {fields.map((field) => (
                      <label key={field.facet} className="text-sm font-bold">
                        {field.label}
                        <select
                          ref={field.facet === 'data' ? firstFieldRef : undefined}
                          name={field.facet}
                          defaultValue={params[field.facet] ?? ''}
                          className={SELECT_CLASS}
                        >
                          <option value="">{field.anyLabel}</option>
                          {field.options.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                  <button type="submit" className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} mt-6 w-full`}>
                    Ver fotos
                  </button>
                  <Link
                    href={ARCHIVE_PHOTO_ALBUM_PATH}
                    className={`mt-3 inline-flex min-h-11 w-full items-center justify-center text-sm font-extrabold text-[#184e92] underline-offset-4 hover:underline ${ARCHIVE_PHOTO_FOCUS}`}
                  >
                    Limpar filtros
                  </Link>
                </form>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  )
}
