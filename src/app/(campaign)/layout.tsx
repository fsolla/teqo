import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import React from 'react'

import { CampaignIosViewportHeal } from '@/components/campaign/shell/CampaignIosViewportHeal'
import { RegisterServiceWorker } from '@/components/campaign/shell/RegisterServiceWorker'
import { Toaster } from '@/components/ui/Toaster'
import { CAMPAIGN_PWA_MANIFEST_PATH, CAMPAIGN_PWA_THEME_COLOR } from '@/utilities/campaignPwa'

import '../(frontend)/styles.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' })

export const metadata: Metadata = {
  title: {
    default: 'Campanha',
    template: 'Solla - Campanha - %s',
  },
  robots: {
    index: false,
    follow: false,
  },
  manifest: CAMPAIGN_PWA_MANIFEST_PATH,
  appleWebApp: {
    capable: true,
    title: 'Campanha',
    statusBarStyle: 'default',
  },
  icons: {
    apple: '/campaign-icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: CAMPAIGN_PWA_THEME_COLOR,
}

export default function CampanhaRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-theme="campaign"
      className={inter.variable}
      style={{ colorScheme: 'light' }}
    >
      <body className="bg-background bg-none text-foreground antialiased">
        {children}
        {/* Outside the (app) shells on purpose: the AI panel's `contain:layout
            paint` wrapper would trap the toaster's `position: fixed` under the
            portal z-50 of sheets/drawers, making action toasts (e.g. undo)
            unclickable while a modal is open (C102). */}
        <Toaster position="top-center" />
        <RegisterServiceWorker />
        <CampaignIosViewportHeal />
      </body>
    </html>
  )
}
