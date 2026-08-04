'use client'

import { type ReactNode } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

import { CampaignAIFab } from '@/components/campaign/shell/ai/CampaignAIFab'
import { CampaignAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebar'
import { CampaignAISidebarProvider } from '@/components/campaign/shell/ai/CampaignAISidebarContext'

const CHAT_MIN_PX = '280px'
const CHAT_DEFAULT_PCT = '25'
const MAIN_MIN_PCT = '35'

export const CampaignAISidebarShell = ({ children }: { children: ReactNode }) => {
  const panelRef = usePanelRef()

  return (
    <CampaignAISidebarProvider panelRef={panelRef}>
      <CampaignAIFab />
      <Group orientation="horizontal" className="min-h-0 flex-1">
        {/* Main content */}
        <Panel defaultSize="75" minSize={MAIN_MIN_PCT}>
          <div className="[contain:layout_paint] h-full">
            <div className="flex h-full flex-col">{children}</div>
          </div>
        </Panel>

        {/* Resize handle */}
        <Separator className="hidden w-3 shrink-0 cursor-col-resize transition-colors focus:outline-none md:flex items-center justify-center group/separator data-[resize-handle-active]:bg-primary/20">
          <div className="h-full w-px bg-border transition-colors group-hover/separator:bg-primary/50 group-data-[resize-handle-active]/separator:bg-primary/50" />
        </Separator>

        {/* AI chat sidebar — collapsible, controlled by context */}
        <Panel
          panelRef={panelRef}
          defaultSize={CHAT_DEFAULT_PCT}
          minSize={CHAT_MIN_PX}
          maxSize="50"
          collapsible
          collapsedSize={0}
          className="hidden md:block"
        >
          <CampaignAISidebar />
        </Panel>
      </Group>
    </CampaignAISidebarProvider>
  )
}
