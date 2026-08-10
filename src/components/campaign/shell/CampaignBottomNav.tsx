'use client'

import { LogOutIcon, UserIcon } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { logoutCampaign } from '@/app/(campaign)/campanha/actions/auth'
import { PeopleNavSavedFilters } from '@/components/campaign/people/PeopleNavSavedFilters'
import { MunicipalityNavSavedFilters } from '@/components/campaign/shell/MunicipalityNavSavedFilters'
import {
  getCampaignBottomNav,
  getCampaignOverflowNav,
  isCampaignNavActive,
} from '@/components/campaign/shell/nav'
import { Button } from '@/components/ui/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Spinner } from '@/components/ui/Spinner'
import { clearLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { CAMPAIGN_PROFILE_HOME } from '@/lib/campaignPaths'
import { cn } from '@/lib/utils'
import { clearCampaignPwaCaches } from '@/utilities/campaignPwaClient'
import { type CampaignUserShellView } from '@/utilities/campaignUserProfile'
import { clearMunicipalitySavedFilters } from '@/utilities/municipality/municipalitySavedFilters'
import { clearPeopleSavedFilters } from '@/utilities/people/peopleSavedFilters'
import { clearRecentVisits } from '@/utilities/recentVisits'

export const CampaignBottomNav = ({ user }: { user: CampaignUserShellView }) => {
  const pathname = usePathname()
  const navItems = getCampaignBottomNav(user.role)
  const overflowNav = getCampaignOverflowNav(user.role)
  const [overflowOpen, setOverflowOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoggingOut) return
    setIsLoggingOut(true)
    clearRecentVisits()
    clearLastActedMunicipality()
    clearMunicipalitySavedFilters()
    clearPeopleSavedFilters()
    await clearCampaignPwaCaches()
    await logoutCampaign()
  }

  return (
    <>
      <nav
        aria-label="Navegação principal"
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 grid w-full',
          'grid-cols-[repeat(5,minmax(0,1fr))]',
          'border-t bg-background',
          'pt-2.5 pb-[env(safe-area-inset-bottom)]',
          'md:hidden print:hidden',
        )}
      >
        {navItems.map((item) => {
          const active = item.href === '' ? overflowOpen : isCampaignNavActive(pathname, item.href)
          if (item.href === '') {
            return (
              <button
                key="Mais"
                type="button"
                aria-haspopup="dialog"
                aria-expanded={overflowOpen}
                aria-label="Mais"
                onClick={() => setOverflowOpen(true)}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] whitespace-nowrap font-medium text-muted-foreground outline-none',
                  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active && 'text-primary',
                )}
              >
                <item.icon aria-hidden="true" className="size-5 shrink-0" />
                <span>{item.title}</span>
              </button>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] whitespace-nowrap font-medium text-muted-foreground outline-none',
                'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                active && 'text-primary',
              )}
            >
              <item.icon aria-hidden="true" className="size-5 shrink-0" />
              <span>{item.title}</span>
            </Link>
          )
        })}
      </nav>

      <Drawer
        open={overflowOpen}
        onOpenChange={setOverflowOpen}
        showSwipeHandle
        swipeDirection="down"
        modal={true}
      >
        <DrawerContent
          id="CampaignBottomNavOverflow"
          className="max-h-[85dvh] border-t border-border bg-background"
        >
          <DrawerHeader>
            <DrawerTitle>Navegação</DrawerTitle>
            <DrawerDescription>Destinos da campanha</DrawerDescription>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2">
            <div className="flex flex-col gap-1">
              {overflowNav.map((item) => {
                const active = isCampaignNavActive(pathname, item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOverflowOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground outline-none',
                      'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
                      active && 'bg-muted text-primary',
                    )}
                  >
                    <item.icon aria-hidden="true" className="size-5 shrink-0" />
                    <span>{item.title}</span>
                  </Link>
                )
              })}
            </div>
            {/* C102: the sheet is gone for staff on mobile — B18's saved filters
                move into the overflow drawer, the new home of secondary nav. */}
            <MunicipalityNavSavedFilters
              variant="overflow"
              onNavigate={() => setOverflowOpen(false)}
            />
            <PeopleNavSavedFilters variant="overflow" onNavigate={() => setOverflowOpen(false)} />
          </div>

          <DrawerFooter>
            <Link
              href={CAMPAIGN_PROFILE_HOME}
              onClick={() => setOverflowOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-foreground outline-none',
                'hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring',
              )}
            >
              <UserIcon aria-hidden="true" className="size-5 shrink-0" />
              <span>Perfil</span>
            </Link>
            <form onSubmit={handleLogout} className="w-full">
              <Button
                type="submit"
                variant="ghost"
                disabled={isLoggingOut}
                className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
              >
                {isLoggingOut ? (
                  <Spinner aria-hidden="true" className="size-5" />
                ) : (
                  <LogOutIcon aria-hidden="true" className="size-5" />
                )}
                <span>Sair</span>
              </Button>
            </form>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
