import Link from 'next/link'

import { buildAcervoSourceHref, type AcervoSource } from '@/lib/acervoSource'
import { cn } from '@/lib/utils'

const SOURCE_TABS = [
  { source: 'camara', label: 'Falas da Câmara', shortLabel: 'Câmara' },
  { source: 'enviadas', label: 'Gravações enviadas', shortLabel: 'Enviadas' },
  { source: 'internet', label: 'Falas na internet', shortLabel: 'Internet' },
] as const satisfies readonly { source: AcervoSource; label: string; shortLabel: string }[]

/**
 * C199/C216 — the acervo source switcher. Navigation, not a tab widget: three
 * links with `aria-current="page"` on the active one, keeping the pill
 * appearance of the approved design. Mobile takes the three-column short-label
 * grid (C216 scene 03); desktop keeps the long labels inline.
 */
export const AcervoSourceToggle = ({ source }: { source: AcervoSource }) => (
  <nav
    aria-label="Fonte do acervo"
    className="grid w-full grid-cols-3 rounded-lg bg-secondary p-1 text-center text-sm md:inline-flex md:w-auto md:text-left"
  >
    {SOURCE_TABS.map((tab) => {
      const active = tab.source === source
      return (
        <Link
          key={tab.source}
          href={buildAcervoSourceHref(tab.source)}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'rounded-md px-1 py-2 md:px-3',
            active
              ? 'bg-card font-medium text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground',
          )}
        >
          <span className="md:hidden">{tab.shortLabel}</span>
          <span className="max-md:hidden">{tab.label}</span>
        </Link>
      )
    })}
  </nav>
)
