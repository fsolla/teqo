'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { logoutCampaign } from '@/app/(campaign)/campanha/actions/auth'
import { CampaignLogo } from '@/components/campaign/campaign-logo'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { CampaignUserAvatar } from '@/components/campaign/CampaignUserAvatar'
import { getCampaignNav, isCampaignNavActive } from '@/components/campaign/nav'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'
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
import type { CampaignUserShellView } from '@/utilities/campaignUserProfile'
import { campaignRoleLabels } from '@/utilities/campaignUserProfile'
import { clearCampaignPwaCaches } from '@/utilities/campaignPwaClient'
import { clearRecentVisits } from '@/utilities/recentVisits'

export type CampaignSidebarUser = CampaignUserShellView

export const CampaignSidebar = ({ user }: { user: CampaignSidebarUser }) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()
  const [isLoggingOut, setIsLoggingOut] = useState(false)

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
    <Sidebar collapsible="none" className="h-svh shrink-0 border-r border-sidebar-border">
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
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isCampaignNavActive(pathname, item.href)}>
                    <Link
                      href={item.href}
                      onClick={() => {
                        if (isMobile) setOpenMobile(false)
                      }}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
