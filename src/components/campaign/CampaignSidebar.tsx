'use client'

import type { FormEvent } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { logoutCampaign } from '@/app/(campaign)/campanha/actions/auth'
import { CampaignLogo } from '@/components/campaign/campaign-logo'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { getCampaignNav, isCampaignNavActive } from '@/components/campaign/nav'
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
import type { CampaignUser } from '@/payload-types'
import { clearCampaignPwaCaches } from '@/utilities/campaignPwaClient'
import { clearRecentVisits } from '@/utilities/recentVisits'

export type CampaignSidebarUser = {
  name: string
  email?: string | null
  role: CampaignUser['role']
}

const roleLabels: Record<CampaignUser['role'], string> = {
  geral: 'Coordenação geral',
  coordenador: 'Coordenador',
  lideranca: 'Liderança',
}

export const CampaignSidebar = ({ user }: { user: CampaignSidebarUser }) => {
  const pathname = usePathname()
  const { isMobile, setOpenMobile } = useSidebar()

  const handleLogout = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    clearRecentVisits()
    await clearCampaignPwaCaches()
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
          <CampaignScopeBadge className="mb-3 w-fit">{roleLabels[user.role]}</CampaignScopeBadge>
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
        <div className="flex min-w-0 flex-col gap-0.5 leading-none">
          <span className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
          <span className="truncate text-xs text-muted-foreground">{roleLabels[user.role]}</span>
          {user.email ? (
            <span className="truncate text-xs text-muted-foreground">{user.email}</span>
          ) : null}
        </div>
        <form action={logoutCampaign} onSubmit={handleLogout}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="min-h-11 w-full border-sidebar-border bg-sidebar font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Sair
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
