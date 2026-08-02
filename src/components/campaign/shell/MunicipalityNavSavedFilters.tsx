'use client'

import { ChevronRightIcon, Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { toast } from 'sonner'

import { OPS_LIST_ONLINE_ONLY_MESSAGE } from '@/components/campaign/opsSync/opsListLocalCopy'
import { useBrowserOffline } from '@/components/campaign/opsSync/useBrowserOffline'
import { useMunicipalitySavedFilters } from '@/components/campaign/shared/useMunicipalitySavedFilters'
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/Sidebar'
import { isSameListHref } from '@/lib/listQueryMatch'
import {
  readMunicipalitySavedFiltersOpen,
  removeMunicipalitySavedFilter,
  saveMunicipalitySavedFilter,
  writeMunicipalitySavedFiltersOpen,
  type MunicipalitySavedFilter,
} from '@/utilities/municipality/municipalitySavedFilters'

/** A page is a position inside a recorte, not part of it. */
const IGNORED_PARAMS = ['page']

/**
 * The saved filters of `/campanha/municipios` (B18), hung under that nav item.
 *
 * Renders only the disclosure and the sub-list: the nav link above it stays the
 * one `CampaignSidebarLink` every other item uses.
 */
export const MunicipalityNavSavedFilters = ({ onNavigate }: { onNavigate: () => void }) => {
  const savedFilters = useMunicipalitySavedFilters()
  const browserOffline = useBrowserOffline()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  // Read once, not tracked: the store owns the list, this is only the
  // disclosure, and the toggle already writes it back.
  const [open, setOpen] = useState(readMunicipalitySavedFiltersOpen)
  const listId = useId()
  const disclosureRef = useRef<HTMLButtonElement>(null)

  const query = searchParams.toString()
  const currentHref = query ? `${pathname}?${query}` : pathname
  const activeHref = savedFilters.find((entry) =>
    isSameListHref(currentHref, entry.href, IGNORED_PARAMS),
  )?.href

  // Arriving at a saved filter reveals where you are, but only on a real
  // navigation into one: opening on every mount would make the persisted
  // preference unhonorable for whoever uses saved filters most, since they
  // collapse the group, reload, and find it back. The trigger is the URL
  // changing rather than `activeHref` appearing, because the store answers
  // empty until the client has read `localStorage` — a match surfacing out of
  // hydration would otherwise read as a navigation on every single load.
  const previousHref = useRef(currentHref)
  useEffect(() => {
    const navigated = previousHref.current !== currentHref
    previousHref.current = currentHref
    if (navigated && activeHref) setOpen(true)
  }, [currentHref, activeHref])

  // No group until there is something in it — and nothing to hydrate either,
  // since the store answers empty until the client reads `localStorage`.
  if (!savedFilters.length) return null

  const toggle = () => {
    const next = !open
    setOpen(next)
    writeMunicipalitySavedFiltersOpen(next)
  }

  const handleRemove = (entry: MunicipalitySavedFilter) => {
    // The button about to vanish is the one holding focus, which would drop to
    // <body> and strand a keyboard user at the top of the page. Resolve the
    // survivor BEFORE the removal: emptying the group unmounts this whole
    // component, disclosure included, so the fallback has to be the nav link.
    const disclosure = disclosureRef.current
    const successor =
      savedFilters.length > 1
        ? disclosure
        : disclosure?.closest('li')?.querySelector<HTMLElement>('a')

    removeMunicipalitySavedFilter(entry.href)
    successor?.focus()

    // Undo instead of a confirmation: the entry restores to the same name and
    // the same alphabetical slot, so the cheap path is reversal, not a prompt.
    toast.success(`Filtro “${entry.name}” apagado.`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          if (saveMunicipalitySavedFilter(entry) !== 'saved') {
            toast.error('Não foi possível restaurar o filtro.')
          }
        },
      },
    })
  }

  return (
    <>
      <SidebarMenuAction
        ref={disclosureRef}
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={`${open ? 'Ocultar' : 'Mostrar'} os filtros salvos de Municípios`}
        onClick={toggle}
        className={open ? 'rotate-90' : undefined}
      >
        <ChevronRightIcon aria-hidden="true" />
      </SidebarMenuAction>
      {/* Always mounted so `aria-controls` always resolves; `hidden` wins over
          the list's own `flex` through tailwind-merge. */}
      <SidebarMenuSub
        id={listId}
        aria-label="Filtros salvos de Municípios"
        className={open ? undefined : 'hidden'}
      >
        {savedFilters.map((entry) => {
          const isActive = entry.href === activeHref

          return (
            <SidebarMenuSubItem key={entry.href}>
              <SidebarMenuSubButton asChild isActive={isActive}>
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  title={entry.name}
                >
                  <span>{entry.name}</span>
                </Link>
              </SidebarMenuSubButton>
              <SidebarMenuAction
                type="button"
                onClick={() => {
                  if (browserOffline) return
                  handleRemove(entry)
                }}
                disabled={browserOffline}
                title={browserOffline ? OPS_LIST_ONLINE_ONLY_MESSAGE : undefined}
                aria-label={
                  browserOffline
                    ? `Apagar o filtro salvo ${entry.name} — ${OPS_LIST_ONLINE_ONLY_MESSAGE}`
                    : `Apagar o filtro salvo ${entry.name}`
                }
                className="top-1 group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 md:opacity-0"
              >
                <Trash2Icon aria-hidden="true" />
              </SidebarMenuAction>
            </SidebarMenuSubItem>
          )
        })}
      </SidebarMenuSub>
    </>
  )
}
