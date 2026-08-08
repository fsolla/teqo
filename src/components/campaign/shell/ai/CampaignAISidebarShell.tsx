'use client'

import { type ReactNode, useLayoutEffect, useRef } from 'react'
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels'

import { CampaignAIFab } from '@/components/campaign/shell/ai/CampaignAIFab'
import { CampaignAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebar'
import { CampaignAISidebarProvider } from '@/components/campaign/shell/ai/CampaignAISidebarContext'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  CHAT_MIN_PX,
  getSavedChatWidthPx,
  resolveChatPanelWidthPx,
  saveChatWidthPx,
} from '@/lib/sollinhaChatPanelWidth'

const CHAT_DEFAULT_PCT = '25'
const MAIN_MIN_PCT = '35'

export const CampaignAISidebarShell = ({ children }: { children: ReactNode }) => {
  const panelRef = usePanelRef()
  const groupRef = useRef<HTMLDivElement | null>(null)
  const isMobile = useIsMobile()

  // Once the user resizes the panel, a re-render across the mobile/desktop
  // boundary (or a re-run of the sizing effect) must never override the
  // size chosen live in this session.
  const hasUserSizedRef = useRef(false)

  // Apply the remembered — or the capped-default — width once the desktop
  // panel's layout has settled; re-applies if the device later crosses back
  // into desktop (a mobile-first load that grows to desktop still gets it).
  // The imperative `resize(px)` converts px→% from the group's measured
  // offsets, so it must not run during the first commit (transient values).
  useLayoutEffect(() => {
    if (isMobile) return
    const frame = requestAnimationFrame(() => {
      const group = groupRef.current
      const panel = panelRef.current
      if (!group || !panel || hasUserSizedRef.current || panel.isCollapsed()) return
      const groupWidth = group.getBoundingClientRect().width
      if (groupWidth <= 0) return
      panel.resize(resolveChatPanelWidthPx(groupWidth, getSavedChatWidthPx()))
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobile, panelRef])

  return (
    <CampaignAISidebarProvider panelRef={panelRef}>
      <CampaignAIFab />
      <Group
        id="campaign-ai-shell"
        orientation="horizontal"
        className="min-h-0 flex-1"
        elementRef={groupRef}
        onLayoutChanged={(_layout, meta) => {
          if (!meta.isUserInteraction) return
          const panel = panelRef.current
          if (!panel || panel.isCollapsed()) return
          const { inPixels } = panel.getSize()
          if (inPixels < CHAT_MIN_PX) return
          hasUserSizedRef.current = true
          saveChatWidthPx(inPixels)
        }}
      >
        {/* Main content */}
        <Panel defaultSize="75" minSize={MAIN_MIN_PCT}>
          <div className="[contain:layout_paint] h-full">
            <div className="flex h-full flex-col">{children}</div>
          </div>
        </Panel>

        {/* Resize handle */}
        {/*
          Double-click resets the panel to its raw `defaultSize` (uncapped 25%);
          the product default is the capped min(25%, 360px), so the stale
          reset affordance would reopen wider than allowed — disable it.
        */}
        <Separator
          disableDoubleClick
          className="hidden w-3 shrink-0 cursor-col-resize transition-colors focus:outline-none md:flex items-center justify-center group/separator data-[resize-handle-active]:bg-primary/20"
        >
          <div className="h-full w-px bg-border transition-colors group-hover/separator:bg-primary/50 group-data-[resize-handle-active]/separator:bg-primary/50" />
        </Separator>

        {/* AI chat sidebar — collapsible, controlled by context */}
        <Panel
          id="ai-chat-panel"
          panelRef={panelRef}
          defaultSize={CHAT_DEFAULT_PCT}
          minSize={CHAT_MIN_PX}
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
