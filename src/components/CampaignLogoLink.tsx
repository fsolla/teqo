import Image from 'next/image'
import Link from 'next/link'

/**
 * S36/C233 — the name-only campaign lockup as a home link, owner of the crop
 * contract shared by the public chrome (home/internal headers and the footer):
 * the official PNG ships with a large transparent frame (canvas 1037x595,
 * visible ink 790x285: top 162, bottom 148, left 123, right 124), so the header
 * crops the frame with a fixed window instead of scaling the whole canvas. The
 * window must have the SAME aspect ratio as the ink (the frame does not); a
 * mismatched window clips the base of "SOLLA" (production report 2026-09-25).
 * Window = ink box at the /jingles reference weight: mobile 128x46 (img 167px
 * -> ink 127.2x45.9, left -19.8 / top -26.1), desktop 144x52 for the negative
 * lockup (img 189px) and 160x58 for the positive one (img 209px). To recompute
 * after a kit PNG change: `sharp(asset).trim()` gives the ink box (size +
 * trimOffset); imgWidth = inkHeight x 1037/285 and the offsets are the trim
 * offsets x imgWidth/1037. The e2e spec asserts the fitted ink.
 *
 * S47 — the positive lockup is the internal-page mark; the negative one stays
 * on the red home/announcement chrome and the footer. Neither reads the
 * `marca-*-completa` assets, so the electoral number never reaches the surface.
 */
type CampaignLogoLinkProps = {
  className?: string
  tone?: 'negative' | 'positive'
  priority?: boolean
}

const NEGATIVE_SRC = '/campaign-kit/jorge-solla-negativo.png'
const POSITIVE_SRC = '/campaign-kit/jorge-solla-positivo.png'

export const CampaignLogoLink = ({
  className,
  tone = 'negative',
  priority = true,
}: CampaignLogoLinkProps) => {
  const isPositive = tone === 'positive'
  const windowClassName = isPositive
    ? 'h-[46px] w-[128px] sm:h-[58px] sm:w-[160px]'
    : 'h-[46px] w-[128px] sm:h-[52px] sm:w-[144px]'
  const imageClassName = isPositive
    ? 'absolute top-[-26.1px] left-[-19.8px] h-auto w-[167px] max-w-none sm:top-[-32.6px] sm:left-[-24.8px] sm:w-[209px]'
    : 'absolute top-[-26.1px] left-[-19.8px] h-auto w-[167px] max-w-none sm:top-[-29.5px] sm:left-[-22.4px] sm:w-[189px]'

  return (
    <Link href="/" aria-label="Início — Jorge Solla" className={className}>
      <span className={`relative block shrink-0 overflow-hidden ${windowClassName}`}>
        <Image
          src={isPositive ? POSITIVE_SRC : NEGATIVE_SRC}
          alt="Jorge Solla — Deputado Federal"
          width={1037}
          height={595}
          priority={priority}
          className={imageClassName}
        />
      </span>
    </Link>
  )
}
