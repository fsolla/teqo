import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * S21/S29 — the campaign-site bar of the public pages that live outside the
 * home chrome (`/jingles`, the share-link announcement): the full positive logo
 * linking home plus an optional status badge. Extracted from the jingles header
 * so both pages share one chrome; the badge is desktop-only by design (mobile
 * keeps the logo alone).
 */
export const CampaignPageHeader = ({ badge }: { badge?: ReactNode }) => (
  <header className="border-b border-black/10 bg-(--campaign-cream)">
    <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 sm:h-[92px] sm:px-8 sm:py-0">
      <Link
        href="/"
        aria-label="Início — Jorge Solla 1313"
        className="rounded-md focus-visible:shadow-[0_0_0_2px_var(--pt-red-dark)] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-yellow)"
      >
        <Image
          src="/campaign-kit/marca-positiva-completa.png"
          alt="Jorge Solla 1313 — Mais Saúde, Mais Futuro"
          width={1037}
          height={595}
          priority
          className="h-[66px] w-auto object-contain sm:h-[74px]"
        />
      </Link>
      {badge ? (
        <span className="hidden rounded-full bg-(--pt-red) px-4 py-2 font-[family-name:var(--font-exo2)] text-xs font-black tracking-[0.08em] text-white uppercase sm:inline-block">
          {badge}
        </span>
      ) : null}
    </div>
  </header>
)
