import Link from 'next/link'

import { CampaignLogoLink } from '@/components/CampaignLogoLink'

import { ARCHIVE_PHOTO_FOCUS } from './archivePhotoClasses'

const NAV_LINK = `rounded-sm text-sm font-bold text-white underline-offset-4 hover:underline ${ARCHIVE_PHOTO_FOCUS}`

/**
 * C233 — the album bar (artefato: cena 01): the negative logo over the campaign
 * red (crop contract in `CampaignLogoLink`, single owner S36) and the site nav
 * on desktop — "Fotos" carries the yellow underline of the current page;
 * mobile keeps the section name alone. "Conteúdos" only appears while the
 * Central has something published, the same discovery rule as the footer.
 */
export const ArchivePhotoPageHeader = ({ showConteudos }: { showConteudos: boolean }) => (
  <header className="bg-[#ae1603]">
    <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-16 sm:px-8">
      <CampaignLogoLink className={ARCHIVE_PHOTO_FOCUS} />
      <nav aria-label="Navegação principal" className="hidden items-center gap-6 sm:flex">
        <Link href="/" className={NAV_LINK}>
          Início
        </Link>
        <Link
          href="/fotos"
          aria-current="page"
          className="border-b-2 border-(--pt-yellow) py-2 text-sm font-bold text-white"
        >
          Fotos
        </Link>
        {showConteudos ? (
          <Link href="/conteudos" className={NAV_LINK}>
            Conteúdos
          </Link>
        ) : null}
      </nav>
      <span className="text-sm font-bold text-white sm:hidden">Fotos</span>
    </div>
  </header>
)
