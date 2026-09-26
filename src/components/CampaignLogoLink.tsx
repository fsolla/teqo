import Image from 'next/image'
import Link from 'next/link'

/**
 * S36/C233 — the negative campaign lockup as a home link, owner of the crop
 * contract shared by the public page-local headers: the official PNG ships with
 * a large transparent frame (canvas 1037x595, visible ink 790x285: top 162,
 * bottom 148, left 123, right 124), so the header crops the frame with a fixed
 * window instead of scaling the whole canvas. The window must have the SAME
 * aspect ratio as the ink (the frame does not); a mismatched window clips the
 * base of "SOLLA" (production report 2026-09-25). Window = ink box at the
 * /jingles reference weight: mobile 128x46 (img 167px -> ink 127.2x45.9, left
 * -19.8 / top -26.1) and desktop 144x52 (img 189px -> ink 144x51.9, left -22.4
 * / top -29.5). To recompute after a kit PNG change: `sharp(asset).trim()`
 * gives the ink box (size + trimOffset); imgWidth = inkHeight x 1037/285 and
 * the offsets are the trim offsets x imgWidth/1037. The e2e spec asserts the
 * fitted ink.
 */
export const CampaignLogoLink = ({ className }: { className?: string }) => (
  <Link href="/" aria-label="Início — Jorge Solla 1313" className={className}>
    <span className="relative block h-[46px] w-[128px] shrink-0 overflow-hidden sm:h-[52px] sm:w-[144px]">
      <Image
        src="/campaign-kit/jorge-solla-negativo.png"
        alt="Jorge Solla"
        width={1037}
        height={595}
        priority
        className="absolute top-[-26.1px] left-[-19.8px] h-auto w-[167px] max-w-none sm:top-[-29.5px] sm:left-[-22.4px] sm:w-[189px]"
      />
    </span>
  </Link>
)
