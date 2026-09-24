import { cn } from '@/lib/utils'
import type { WebSpeechPlatform } from '@/lib/webSpeech'

/**
 * C216 — the platform pill of the web speeches (design scene 05): one color
 * pair per known platform and a neutral, bordered fallback for an unclassified
 * row. The same pill identifies the row in the list and in the detail.
 */
const PLATFORM_CLASSES: Record<WebSpeechPlatform, string> = {
  youtube: 'bg-red-50 text-primary',
  instagram: 'bg-fuchsia-50 text-fuchsia-800',
  radio: 'bg-blue-50 text-blue-800',
  audio: 'bg-amber-50 text-amber-800',
}

export const WebSpeechPlatformPill = ({
  platform,
  label,
  className,
}: {
  platform: WebSpeechPlatform | null
  label: string
  className?: string
}) => (
  <span
    className={cn(
      'inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold',
      platform ? PLATFORM_CLASSES[platform] : 'border border-border bg-muted text-muted-foreground',
      className,
    )}
  >
    {label}
  </span>
)
