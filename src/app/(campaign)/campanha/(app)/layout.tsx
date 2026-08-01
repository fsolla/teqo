import config from '@payload-config'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import React from 'react'

import { CampaignListPendingBoundary } from '@/components/campaign/shared/CampaignListPending'
import {
  BiometricEnrollmentToast,
  type BiometricEnrollmentOffer,
} from '@/components/campaign/shell/BiometricEnrollmentToast'
import { CampaignAppScrollChrome } from '@/components/campaign/shell/CampaignAppScrollChrome'
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
import { CampaignNotificationBellSlot } from '@/components/campaign/shell/CampaignNotificationBellSlot'
import { CampaignQuickActionContextProvider } from '@/components/campaign/shell/CampaignQuickActionContext'
import { CampaignSidebar } from '@/components/campaign/shell/CampaignSidebar'
import { CampaignSidebarViewportDefault } from '@/components/campaign/shell/CampaignSidebarViewportDefault'
import { CampaignWizardChromeProvider } from '@/components/campaign/shell/CampaignWizardChromeContext'
import { InstallPwaToast } from '@/components/campaign/shell/InstallPwaToast'
import {
  SIDEBAR_COOKIE_NAME,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/Sidebar'
import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { deviceLabelFromUserAgent } from '@/lib/deviceLabel'
import { getCampaignUserWithAvatar } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'
import { loadCampaignPasskeys } from '@/utilities/webauthn/campaignWebAuthnCeremony'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUserWithAvatar()

  if (!user) {
    redirect('/campanha/login')
  }

  const cookieStore = await cookies()
  const sidebarStateCookie = cookieStore.get(SIDEBAR_COOKIE_NAME)
  const hasSidebarCookie = sidebarStateCookie !== undefined
  const defaultOpen = sidebarStateCookie ? sidebarStateCookie.value === 'true' : true

  // B40 discovery. The relying party is decided from headers alone, so it is
  // resolved first and this layout — which runs on every authenticated
  // navigation — reads no passkeys at all on an origin that cannot host a
  // ceremony. Whether THIS device is already enrolled is a question only the
  // browser can answer, so the island finishes the decision.
  const relyingParty = await resolveCampaignWebAuthnRelyingParty()
  let biometricEnrollment: BiometricEnrollmentOffer | null = null
  if (relyingParty) {
    const payload = await getPayload({ config })
    const [passkeys, requestHeaders] = await Promise.all([
      loadCampaignPasskeys(payload, user.id),
      headers(),
    ])
    biometricEnrollment = {
      // Only the emptiness crosses the boundary: the device labels have no
      // business in the RSC payload of every page.
      hasEnrolledPasskeys: passkeys.length > 0,
      suggestedDeviceLabel: deviceLabelFromUserAgent(requestHeaders.get('user-agent')),
    }
  }

  return (
    // print: unlock the h-svh/overflow-hidden shells and drop the app chrome,
    // otherwise only the first page of the municipality dossier prints (E16).
    <SidebarProvider
      defaultOpen={defaultOpen}
      className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible"
    >
      <CampaignSidebarViewportDefault hasSidebarCookie={hasSidebarCookie} />
      <CampaignSidebar user={campaignUserShellView(user)} />
      <SidebarInset className="h-svh min-h-0 overflow-hidden print:h-auto print:overflow-visible">
        <CampaignWizardChromeProvider>
          <CampaignQuickActionContextProvider>
            <CampaignListPendingBoundary>
              <CampaignMobileTopBar
                notificationBell={<CampaignNotificationBellSlot user={user} />}
              />
              <header className="hidden min-h-11 shrink-0 items-center gap-2 border-b border-border px-4 md:flex print:hidden">
                <SidebarTrigger />
                <div className="ml-auto">
                  <CampaignNotificationBellSlot user={user} />
                </div>
              </header>
              {/*
                Provider must wrap CampaignAppScrollChrome, not only page children:
                the mobile quick-actions drawer (B91/B100) mounts as a sibling of
                the scrollport and renders search hits with CampaignHoverTooltip
                (priority flag). Nested only around {children} left focus→suggest
                without a provider and crashed the page (B102).
              */}
              <TooltipProvider delayDuration={300}>
                <CampaignAppScrollChrome role={user.role}>{children}</CampaignAppScrollChrome>
              </TooltipProvider>
              <Toaster position="top-center" />
              <InstallPwaToast />
              {biometricEnrollment ? <BiometricEnrollmentToast {...biometricEnrollment} /> : null}
            </CampaignListPendingBoundary>
          </CampaignQuickActionContextProvider>
        </CampaignWizardChromeProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
