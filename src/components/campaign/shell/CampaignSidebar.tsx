'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type FormEvent } from 'react'

import { logoutCampaign } from '@/app/(campaign)/campanha/actions/auth'
import { CampaignScopeBadge } from '@/components/campaign/shared/CampaignScopeBadge'
import { CampaignUserAvatar } from '@/components/campaign/shared/CampaignUserAvatar'
import { CampaignLogo } from '@/components/campaign/shell/campaign-logo'
import {
  getCampaignNav,
  getCampaignSecondaryNav,
  isCampaignNavActive,
  type CampaignNavItem,
} from '@/components/campaign/shell/nav'
import { Button } from '@/components/ui/button'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/Sidebar'
import { Spinner } from '@/components/ui/Spinner'
import { clearCampaignPwaCaches } from '@/utilities/campaignPwaClient'
import type { CampaignUserShellView } from '@/utilities/campaignUserProfile'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import { clearRecentVisits } from '@/utilities/recentVisits'

export type CampaignSidebarUser = CampaignUserShellView

const CampaignSidebarLink = ({
  item,
  isActive,
  onNavigate,
}: {
  item: CampaignNavItem
  isActive: boolean
  onNavigate: () => void
}) => (
  <SidebarMenuItem>
    <SidebarMenuButton asChild isActive={isActive}>
      <Link href={item.href} onClick={onNavigate}>
        <item.icon />
        <span>{item.title}</span>
      </Link>
    </SidebarMenuButton>
  </SidebarMenuItem>
)

export const CampaignSidebar = ({ user }: { user: CampaignSidebarUser }) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const secondaryNav = getCampaignSecondaryNav(user.role)

  const closeMobileSidebar = () => {
    if (isMobile) setOpenMobile(false)
  }

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isLoggingOut) return
    setIsLoggingOut(true)
    clearRecentVisits()
    await clearCampaignPwaCaches()
    // logoutCampaign redirects — no need to reset the pending flag on success.
    await logoutCampaign()
  }

  return (
    <Sidebar
      collapsible="none"
      className="h-svh shrink-0 border-r border-sidebar-border print:hidden"
    >
      <SidebarHeader className="border-b border-sidebar-border">
        <Link
          href="/campanha"
          className="block w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <CampaignLogo />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <CampaignScopeBadge className="mb-3 w-fit">
            {campaignRoleLabels[user.role]}
          </CampaignScopeBadge>
          <SidebarGroupContent>
            <SidebarMenu>
              {getCampaignNav(user.role).map((item) => (
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
        <Link
          href="/campanha/perfil"
          className="flex min-w-0 items-center gap-3 rounded-md px-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <CampaignUserAvatar name={user.name} avatarUrl={user.avatarUrl} size="sm" />
          <div className="flex min-w-0 flex-col gap-0.5 leading-none">
            <span className="truncate text-sm font-medium text-sidebar-foreground">
              {user.name}
            </span>
            <span className="truncate text-xs text-muted-foreground">Meu perfil</span>
          </div>
        </Link>
        <form onSubmit={handleLogout}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            disabled={isLoggingOut}
            className="min-h-11 w-full border-sidebar-border bg-sidebar font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {isLoggingOut ? <Spinner aria-hidden="true" /> : null}
            {isLoggingOut ? 'Saindo…' : 'Sair'}
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
