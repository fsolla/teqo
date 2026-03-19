import { cn } from '@/lib/utils'
import { getCachedGlobal } from '@/utilities/globals'
import Link from 'next/link'
import { FacebookIcon, GlobeIcon, InstagramIcon, WhatsAppIcon, YoutubeIcon } from './socialIcons'

const icons = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  youtube: YoutubeIcon,
  whatsapp: WhatsAppIcon,
  custom: GlobeIcon,
} as const

const defaultA11yLabels: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  custom: 'Link externo',
}

type SocialLinksProps = {
  ariaLabel: string
  className?: string
}

export const SocialLinks = async ({ ariaLabel, className }: SocialLinksProps) => {
  const { socialLinks: links } = await getCachedGlobal('site-settings', 2)()

  if (!links?.length) return null

  return (
    <nav aria-label={ariaLabel} className={cn('flex items-center gap-3', className)}>
      {links.map((link) => {
        if (!link.enabled || !link.url) return null

        const platform = link.platform ?? 'custom'
        const Icon = icons[platform] ?? GlobeIcon
        const label = link.label?.trim() ?? defaultA11yLabels[platform] ?? defaultA11yLabels.custom

        return (
          <Link
            key={`${platform}-${link.url}`}
            href={link.url}
            aria-label={label}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <Icon />
          </Link>
        )
      })}
    </nav>
  )
}
