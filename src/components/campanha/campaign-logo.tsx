import { cn } from '@/lib/utils'

type CampaignLogoProps = {
  className?: string
}

/**
 * Jorge Solla mark for the light campaign shell.
 * Recolors the white SVG via CSS mask (see `.campaign-logo` in styles.css)
 * so it reads as brand primary on the light sidebar.
 */
export function CampaignLogo({ className }: CampaignLogoProps) {
  return (
    <div
      role="img"
      aria-label="Jorge Solla"
      className={cn('campaign-logo w-full shrink-0 bg-sidebar-primary', className)}
    />
  )
}
