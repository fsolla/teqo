'use client'

import { Trash2Icon } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

import {
  useActivePeopleSavedFilter,
  usePeopleSavedFilters,
} from '@/components/campaign/shared/usePeopleSavedFilters'
import {
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/Sidebar'
import { cn } from '@/lib/utils'
import {
  removePeopleSavedFilter,
  savePeopleSavedFilter,
  type PeopleSavedFilter,
} from '@/utilities/people/peopleSavedFilters'

const PEOPLE_SAVED_FILTERS_LABEL = 'Filtros salvos de Pessoas'

/**
 * The saved filters of `/campanha/pessoas` (B18 pattern, 2nd call site), in
 * the same two homes as the municipality submenu: the sidebar sub-list under
 * the Pessoas nav item, and the mobile "Mais" drawer (overflow). Always
 * visible when entries exist; one save repaints both homes.
 */
export const PeopleNavSavedFilters = ({
  variant = 'sidebar',
  onNavigate,
}: {
  variant?: 'sidebar' | 'overflow'
  onNavigate: () => void
}) => {
  const savedFilters = usePeopleSavedFilters()
  const activeFilter = useActivePeopleSavedFilter()

  if (!savedFilters.length) return null

  /** Where keyboard focus lands after a removal, resolved BEFORE the row the
   * button sits on unmounts (same contract as the municipality submenu). */
  const resolveSuccessor = (row: HTMLLIElement | null): HTMLElement | null | undefined => {
    const siblingRow = row?.nextElementSibling ?? row?.previousElementSibling
    if (variant === 'sidebar') {
      const menuItem = row?.closest('[data-sidebar="menu-item"]')
      return (
        siblingRow?.querySelector<HTMLElement>('[data-sidebar="menu-sub-button"]') ??
        menuItem?.querySelector<HTMLElement>('a')
      )
    }
    const section = row?.closest('[data-saved-filters="overflow"]')
    return (
      siblingRow?.querySelector<HTMLElement>('a') ??
      section?.nextElementSibling?.querySelector<HTMLElement>('a') ??
      section?.previousElementSibling?.querySelector<HTMLElement>('a:last-of-type')
    )
  }

  const handleRemove = (entry: PeopleSavedFilter, row: HTMLLIElement | null) => {
    const successor = resolveSuccessor(row)

    removePeopleSavedFilter(entry.href)
    successor?.focus()

    // Undo instead of a confirmation: the entry restores to the same name and
    // the same alphabetical slot, so the cheap path is reversal, not a prompt.
    toast.success(`Filtro “${entry.name}” apagado.`, {
      action: {
        label: 'Desfazer',
        onClick: () => {
          if (savePeopleSavedFilter(entry) !== 'saved') {
            toast.error('Não foi possível restaurar o filtro.')
          }
        },
      },
    })
  }

  if (variant === 'overflow') {
    return (
      <div data-saved-filters="overflow" className="border-t border-border pb-1 pt-3">
        <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">
          {PEOPLE_SAVED_FILTERS_LABEL}
        </p>
        <ul className="flex flex-col gap-0.5">
          {savedFilters.map((entry) => {
            const isActive = entry.href === activeFilter?.href

            return (
              <li key={entry.href} className="flex items-center gap-1">
                <Link
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  title={entry.name}
                  className={cn(
                    'flex min-w-0 flex-1 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground outline-none',
                    'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                    isActive && 'bg-muted text-primary',
                  )}
                >
                  <span className="truncate">{entry.name}</span>
                </Link>
                <button
                  type="button"
                  onClick={(event) => handleRemove(entry, event.currentTarget.closest('li'))}
                  aria-label={`Apagar o filtro salvo ${entry.name}`}
                  className="mr-1 shrink-0 rounded-md p-2.5 text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Trash2Icon aria-hidden className="size-4" />
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  return (
    <SidebarMenuSub aria-label={PEOPLE_SAVED_FILTERS_LABEL} className="-mt-0.5 py-0">
      {savedFilters.map((entry) => {
        const isActive = entry.href === activeFilter?.href

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
              onClick={(event) => handleRemove(entry, event.currentTarget.closest('li'))}
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
