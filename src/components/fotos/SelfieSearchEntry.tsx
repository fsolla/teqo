import { ChevronRight, Sparkles } from 'lucide-react'
import Link from 'next/link'

import { ARCHIVE_PHOTO_ALBUM_ENTRY_PATH } from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_PRIMARY_BUTTON } from './archivePhotoClasses'

/**
 * C234 — the entry band of the selfie search on `/fotos` (artefato: cena 01,
 * revisada): a full-width band between the hero and the facets, never a second
 * column in the hero. Rendered only while the feature flag is on and the album
 * has approved photos to find; the visual contract is the artifact's
 * `rounded-2xl border border-[#184e92]/15 bg-[#f9faff]` band.
 */
export const SelfieSearchEntry = () => (
  <aside className="grid grid-cols-1 items-center gap-4 rounded-2xl border border-[#184e92]/15 bg-[#f9faff] px-5 py-5 sm:grid-cols-[1fr_auto] sm:gap-6 sm:px-6">
    <div className="flex items-start gap-4">
      <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#184e92] text-white">
        <Sparkles aria-hidden="true" className="size-5" strokeWidth={2} />
      </div>
      <div>
        <h2 className="border-0 pb-0 font-[family-name:var(--font-exo2)] text-lg font-black sm:text-xl">
          Encontre você nas fotos
        </h2>
        <p className="mt-1 text-sm leading-6 text-(--campaign-muted)">
          <span className="sm:hidden">
            Sua selfie fica neste aparelho. A busca é para quem aderiu ao índice.
          </span>
          <span className="hidden sm:inline">
            Use uma selfie sua. A imagem não sai deste dispositivo e a busca cobre quem autorizou
            participar do índice.
          </span>
        </p>
      </div>
    </div>
    <Link
      href={ARCHIVE_PHOTO_ALBUM_ENTRY_PATH}
      className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full shrink-0 sm:w-auto`}
    >
      Começar busca por selfie
      <ChevronRight aria-hidden="true" className="size-4" />
    </Link>
  </aside>
)
