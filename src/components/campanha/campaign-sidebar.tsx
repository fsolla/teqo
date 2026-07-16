'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { logoutCampaign } from '@/app/(campanha)/campanha/actions/auth'
import { CampaignLogo } from '@/components/campanha/campaign-logo'
import { campaignNav, isCampaignNavActive } from '@/components/campanha/nav'
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
} from '@/components/ui/sidebar'

export type CampaignSidebarUser = {
  name: string
  email: string
}

export function CampaignSidebar({ user }: { user: CampaignSidebarUser }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="none" className="h-svh border-r border-sidebar-border">
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
          <SidebarGroupContent>
            <SidebarMenu>
              {campaignNav.map((item) => (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isCampaignNavActive(pathname, item.href)}>
                    <Link href={item.href}>
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
          <span className="truncate text-xs text-muted-foreground">{user.email}</span>
        </div>
        <form action={logoutCampaign}>
          <Button
            type="submit"
            variant="outline"
            size="sm"
            className="w-full border-sidebar-border bg-sidebar font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            Sair
          </Button>
        </form>
      </SidebarFooter>
    </Sidebar>
  )
}
