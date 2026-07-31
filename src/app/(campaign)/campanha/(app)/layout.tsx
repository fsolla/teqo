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
import { CampaignMobileTopBar } from '@/components/campaign/shell/CampaignMobileTopBar'
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
import { getCampaignUser } from '@/utilities/campaignAuth'
import { campaignUserShellView } from '@/utilities/campaignUserProfile'
import { loadCampaignPasskeys } from '@/utilities/webauthn/campaignWebAuthnCeremony'
import { resolveCampaignWebAuthnRelyingParty } from '@/utilities/webauthn/campaignWebAuthnConfig'

export default async function CampaignAppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCampaignUser()

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
          <CampaignListPendingBoundary>
            <CampaignMobileTopBar />
            <header className="hidden min-h-11 shrink-0 items-center gap-2 border-b border-border px-4 md:flex print:hidden">
              <SidebarTrigger />
            </header>
            <div
              data-slot="campaign-content-scroll"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 md:p-6 print:h-auto print:overflow-visible print:p-0"
            >
              <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
            </div>
            <Toaster position="top-center" />
            <InstallPwaToast />
            {biometricEnrollment ? <BiometricEnrollmentToast {...biometricEnrollment} /> : null}
          </CampaignListPendingBoundary>
        </CampaignWizardChromeProvider>
      </SidebarInset>
    </SidebarProvider>
  )
}
