'use client'

import { Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

import { useMunicipalitySavedFilters } from '@/components/campaign/shared/useMunicipalitySavedFilters'
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/Sidebar'
import { isSameListHref } from '@/lib/listQueryMatch'
import {
  removeMunicipalitySavedFilter,
  saveMunicipalitySavedFilter,
  type MunicipalitySavedFilter,
} from '@/utilities/municipality/municipalitySavedFilters'

/** A page is a position inside a recorte, not part of it. */
const IGNORED_PARAMS = ['page']

/**
 * The saved filters of `/campanha/municipios` (B18), hung under that nav item.
 *
 * Renders only the sub-list: the nav link above it stays the one
 * `CampaignSidebarLink` every other item uses. Always visible when entries exist
 * (B124 — no disclosure).
 */
export const MunicipalityNavSavedFilters = ({ onNavigate }: { onNavigate: () => void }) => {
  const savedFilters = useMunicipalitySavedFilters()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const query = searchParams.toString()
  const currentHref = query ? `${pathname}?${query}` : pathname
  const activeHref = savedFilters.find((entry) =>
    isSameListHref(currentHref, entry.href, IGNORED_PARAMS),
  )?.href

  if (!savedFilters.length) return null

  const handleRemove = (entry: MunicipalitySavedFilter, row: HTMLLIElement | null) => {
    // The button about to vanish is the one holding focus, which would drop to
    // <body> and strand a keyboard user at the top of the page. Resolve the
    // survivor BEFORE the removal: emptying the group unmounts this whole
    // component, so the fallback has to be the nav link.
    const menuItem = row?.closest('[data-sidebar="menu-item"]')
    const successor =
      savedFilters.length > 1
        ? (row?.nextElementSibling ?? row?.previousElementSibling)?.querySelector<HTMLElement>(
            '[data-sidebar="menu-sub-button"]',
          ) ?? menuItem?.querySelector<HTMLElement>('a')
        : menuItem?.querySelector<HTMLElement>('a')

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
    <SidebarMenuSub aria-label="Filtros salvos de Municípios" className="-mt-0.5 py-0">
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
              onClick={(event) =>
                handleRemove(entry, event.currentTarget.closest('li'))
              }
              aria-label={`Apagar o filtro salvo ${entry.name}`}
              className="top-1 group-focus-within/menu-sub-item:opacity-100 group-hover/menu-sub-item:opacity-100 md:opacity-0"
            >
              <Trash2Icon aria-hidden="true" />
            </SidebarMenuAction>
          </SidebarMenuSubItem>
        )
      })}
    </SidebarMenuSub>
  )
}
