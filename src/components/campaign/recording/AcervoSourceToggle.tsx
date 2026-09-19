import Link from 'next/link'

import { cn } from '@/lib/utils'
import { buildAcervoSourceHref, type AcervoSource } from '@/utilities/recordings/recordingListUrl'

const SOURCE_TABS = [
  { source: 'camara', label: 'Falas da Câmara' },
  { source: 'enviadas', label: 'Gravações enviadas' },
] as const satisfies readonly { source: AcervoSource; label: string }[]

/**
 * C199 — the acervo source switcher. Navigation, not a tab widget: two links
 * with `aria-current="page"` on the active one, keeping the pill appearance of
 * the approved design.
 */
export const AcervoSourceToggle = ({ source }: { source: AcervoSource }) => (
  <nav
    aria-label="Fonte do acervo"
    className="inline-flex self-start rounded-lg bg-secondary p-1 text-sm"
  >
    {SOURCE_TABS.map((tab) => {
      const active = tab.source === source
      return (
        <Link
          key={tab.source}
          href={buildAcervoSourceHref(tab.source)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'rounded-md px-3 py-2',
            active
              ? 'bg-card font-medium text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground',
          )}
        >
          {tab.label}
        </Link>
      )
    })}
  </nav>
)
