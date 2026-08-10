'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type FormEvent, type ReactNode } from 'react'

import { LogOutIcon } from 'lucide-react'

import { logoutCampaign } from '@/app/(campaign)/campanha/actions/auth'
import { PeopleNavSavedFilters } from '@/components/campaign/people/PeopleNavSavedFilters'
import { CampaignUserAvatar } from '@/components/campaign/shared/CampaignUserAvatar'
import { MunicipalityNavSavedFilters } from '@/components/campaign/shell/MunicipalityNavSavedFilters'
import {
  getCampaignNav,
  getCampaignSecondaryNav,
  isCampaignNavActive,
  MUNICIPALITY_NAV_HREF,
  PEOPLE_NAV_HREF,
  type CampaignNavItem,
} from '@/components/campaign/shell/nav'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/Sidebar'
import { Spinner } from '@/components/ui/Spinner'
import { clearLastActedMunicipality } from '@/lib/campaignLastActedMunicipality'
import { isStaffCampaignRole } from '@/lib/campaignRoles'
import { clearCampaignPwaCaches } from '@/utilities/campaignPwaClient'
import type { CampaignUserShellView } from '@/utilities/campaignUserProfile'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import { clearMunicipalitySavedFilters } from '@/utilities/municipality/municipalitySavedFilters'
import { clearPeopleSavedFilters } from '@/utilities/people/peopleSavedFilters'
import { clearRecentVisits } from '@/utilities/recentVisits'

export type CampaignSidebarUser = CampaignUserShellView

const CampaignSidebarLink = ({
  item,
  isActive,
  onNavigate,
  children,
}: {
  item: CampaignNavItem
  isActive: boolean
  onNavigate: () => void
  /** Row affordances below the link — B18's saved-filter sub-list (B124: always on). */
  children?: ReactNode
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={isActive}>
      <Link href={item.href} onClick={onNavigate} aria-current={isActive ? 'page' : undefined}>
        <item.icon />
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
    {children}
  </SidebarMenuItem>
)

export const CampaignSidebar = ({ user }: { user: CampaignSidebarUser }) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const secondaryNav = getCampaignSecondaryNav(user.role)

  // C102: on mobile the staff navigates from the bottom bar + "Mais" drawer,
  // so the nav sheet never mounts for staff — every destination lives below.
  // The leader keeps it (lockdown, no bottom nav). Desktop rail is untouched.
  if (isMobile && isStaffCampaignRole(user.role)) return null

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoggingOut) return
    setIsLoggingOut(true)
    clearRecentVisits()
    clearLastActedMunicipality()
    clearMunicipalitySavedFilters()
    clearPeopleSavedFilters()
    await clearCampaignPwaCaches()
    // logoutCampaign redirects — no need to reset the pending flag on success.
    await logoutCampaign()
  }

  return (
    <Sidebar collapsible="offcanvas" className="print:hidden">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {getCampaignNav(user.role).map((item) => (
                <CampaignSidebarLink
                  key={item.href}
                  item={item}
                  isActive={isCampaignNavActive(pathname, item.href)}
                  onNavigate={closeMobileSidebar}
                >
                  {item.href === MUNICIPALITY_NAV_HREF ? (
                    <MunicipalityNavSavedFilters onNavigate={closeMobileSidebar} />
                  ) : null}
                  {item.href === PEOPLE_NAV_HREF ? (
                    <PeopleNavSavedFilters onNavigate={closeMobileSidebar} />
                  ) : null}
                </CampaignSidebarLink>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Reference, not a destination: pinned to the foot of the nav so it
            never competes with the places the mesa works every day. */}
        {secondaryNav.length > 0 ? (
          <SidebarGroup className="mt-auto">
            <SidebarGroupContent>
              <SidebarMenu>
                {secondaryNav.map((item) => (
                  <CampaignSidebarLink
                    key={item.href}
                    item={item}
                    isActive={isCampaignNavActive(pathname, item.href)}
                    onNavigate={closeMobileSidebar}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex items-center gap-1">
          <Link
            href="/campanha/perfil"
            className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          >
            <CampaignUserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
            <div className="flex min-w-0 flex-col gap-0.5 leading-none">
              <span className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name}
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {campaignRoleLabels[user.role]}
              </span>
            </div>
          </Link>
          <form onSubmit={handleLogout} className="shrink-0">
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={isLoggingOut}
              aria-label={isLoggingOut ? 'Saindo…' : 'Sair'}
              className="size-11 text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              {isLoggingOut ? <Spinner aria-hidden="true" /> : <LogOutIcon />}
            </Button>
          </form>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
