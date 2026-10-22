import Link from 'next/link'
import type { ReactNode } from 'react'

import { CampaignLogoLink } from '@/components/CampaignLogoLink'
import { CampaignMobileMenu } from '@/components/CampaignMobileMenu'
import { PUBLIC_FOCUS, PUBLIC_PATHS } from '@/lib/publicSite'
import { cn } from '@/lib/utils'

/**
 * S21/S29 — the public-site bar. S47 split it into the two approved variants:
 *
 * - `home`: the red hero field with the negative lockup and the white nav
 *   (`Mandato · Bandeiras · Fotos`), sitting directly above the thank-you hero;
 * - `internal` (default): the cream bar with the positive lockup and the red
 *   nav (`Artigos · Fotos · Início`) used by `/artigos`, `/fotos`,
 *   `/fotos/encontre`, `/potencial` and the share-link announcement.
 *
 * The badge stays desktop-only by design (the announcement page's "Ao vivo"
 * state). The mobile disclosure is its own client island; the header itself
 * stays a server component so the lockup is rendered on the server.
 */
type CampaignPageHeaderProps = {
  variant?: 'home' | 'internal'
  current?: 'artigos' | 'fotos'
  badge?: ReactNode
}

const NAV_LINK = cn('rounded-sm text-sm font-bold', PUBLIC_FOCUS)

export const CampaignPageHeader = ({
  variant = 'internal',
  current,
  badge,
}: CampaignPageHeaderProps) => {
  const isHome = variant === 'home'

  const navLinkClassName = (key?: 'artigos' | 'fotos') =>
    cn(
      NAV_LINK,
      key !== undefined && key === current
        ? 'text-(--pt-red) underline decoration-(--pt-red) decoration-2 underline-offset-8'
        : 'text-(--campaign-ink) hover:text-(--pt-red)',
    )

  return (
    <header
      className={cn(
        'relative z-20 border-b',
        isHome
          ? 'campaign-hero-field border-white/15 text-white'
          : 'border-(--campaign-line) bg-(--campaign-cream)',
      )}
    >
      <div
        className={cn(
          isHome
            ? 'mx-auto flex max-w-[1152px] items-center justify-between gap-4 px-5'
            : 'mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-5',
          isHome ? 'h-[74px] lg:h-[88px] lg:px-8' : 'h-[74px] lg:h-[92px] lg:px-10',
        )}
      >
        <CampaignLogoLink
          tone={isHome ? 'negative' : 'positive'}
          className={cn('shrink-0', PUBLIC_FOCUS)}
        />

        <div className="flex items-center gap-4">
          {badge ? (
            <span className="hidden rounded-full bg-(--pt-red) px-4 py-2 font-[family-name:var(--font-exo2)] text-xs font-black tracking-[0.08em] text-white uppercase lg:inline-block">
              {badge}
            </span>
          ) : null}

          <nav aria-label="Navegação principal" className="hidden items-center gap-8 lg:flex">
            {isHome ? (
              <>
                <Link
                  href={PUBLIC_PATHS.artigos}
                  className={cn(
                    NAV_LINK,
                    'text-white underline decoration-(--pt-yellow) decoration-2 underline-offset-8',
                  )}
                >
                  Mandato
                </Link>
                <a href="#bandeiras" className={cn(NAV_LINK, 'text-white/80 hover:text-white')}>
                  Bandeiras
                </a>
                <Link
                  href={PUBLIC_PATHS.fotos}
                  className={cn(NAV_LINK, 'text-white/80 hover:text-white')}
                >
                  Fotos
                </Link>
              </>
            ) : (
              <>
                <Link
                  href={PUBLIC_PATHS.artigos}
                  aria-current={current === 'artigos' ? 'page' : undefined}
                  className={navLinkClassName('artigos')}
                >
                  Artigos
                </Link>
                <Link
                  href={PUBLIC_PATHS.fotos}
                  aria-current={current === 'fotos' ? 'page' : undefined}
                  className={navLinkClassName('fotos')}
                >
                  Fotos
                </Link>
                <Link href={PUBLIC_PATHS.home} className={navLinkClassName()}>
                  Início
                </Link>
              </>
            )}
          </nav>

          <CampaignMobileMenu variant={variant} current={current} />
        </div>
      </div>
    </header>
  )
}
