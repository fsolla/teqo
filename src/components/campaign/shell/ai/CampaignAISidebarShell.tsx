'use client'

import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from 'react'
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelImperativeHandle,
} from 'react-resizable-panels'

import {
  CHAT_MIN_PX,
  getSavedChatWidthPx,
  resolveChatPanelWidthPx,
  saveChatWidthPx,
} from '@/lib/sollinhaChatPanelWidth'
import { cn } from '@/lib/utils'

import { CampaignAIDrawer } from '@/components/campaign/shell/ai/CampaignAIDrawer'
import { CampaignAIFab } from '@/components/campaign/shell/ai/CampaignAIFab'
import { CampaignAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebar'
import {
  CampaignAISidebarProvider,
  useAISidebar,
} from '@/components/campaign/shell/ai/CampaignAISidebarContext'

const CHAT_DEFAULT_PCT = '25'
const MAIN_MIN_PCT = '35'

export const CampaignAISidebarShell = ({ children }: { children: ReactNode }) => {
  const panelRef = usePanelRef()

  return (
    <CampaignAISidebarProvider panelRef={panelRef}>
      <CampaignAIFab />
      <AISidebarSurfaces panelRef={panelRef}>{children}</AISidebarSurfaces>
    </CampaignAISidebarProvider>
  )
}

/**
 * The chat Panel (and its Separator) stay mounted at every viewport — changing
 * `react-resizable-panels`' panel count on breakpoint crossing forces a full
 * page navigation in this app (B167). Its footprint is driven purely by CSS: a
 * class on the Panel's OUTER element zeroes the flex space while `react-resizable-panels`
 * would otherwise keep writing `display:flex` inline there. RRP routes its own
 * className/style props to the nested content wrapper specifically so they
 * cannot break the flex layout, so the class is toggled through `elementRef`
 * (attached to the root div) and wins via `display:none !important` (see
 * styles.css), surviving RRP's own async, viewport-driven re-layouts. The panel
 * is deliberately NOT `collapsible` — RRP's auto-collapse of a `display:none`
 * (0-width) panel left it collapsed on the desktop side of a crossing, which no
 * expand could reliably undo. Hiding and showing are entirely CSS-driven, so the
 * panel always keeps a real RRP size (default 25% / the width the user chose and
 * B166 remembers) whenever it is visible. The mobile Drawer portals over the
 * content as a Group sibling.
 */
const AISidebarSurfaces = ({
  panelRef,
  children,
}: {
  panelRef: MutableRefObject<PanelImperativeHandle | null>
  children: ReactNode
}) => {
  const { open, isMobile, measured } = useAISidebar()!
  const groupRef = useRef<HTMLDivElement | null>(null)
  const chatPanelElementRef = useRef<HTMLDivElement | null>(null)

  // B166: once the user resizes the panel, a re-render across the
  // mobile/desktop boundary (or a re-run of the sizing effect) must never
  // override the size chosen live in this session.
  const hasUserSizedRef = useRef(false)

  // Before the first viewport measurement the render must not hide the panel
  // (it would flash the main content at 100% then settle to 25% on desktop);
  // the hydration frame is treated as desktop-with-chat-open, matching the
  // panel's RRP default, and the settle reconciles `open` afterwards.
  const chatVisible = measured ? !isMobile && open : true

  // Apply the remembered — or the capped-default — width once the desktop
  // panel's layout has settled; re-applies if the device later crosses back
  // into desktop (a mobile-first load that grows to desktop still gets it).
  // The imperative `resize(px)` converts px→% from the group's measured
  // offsets, so it must not run during the first commit (transient values).
  // (B166.)
  useLayoutEffect(() => {
    if (isMobile || !measured) return
    const frame = requestAnimationFrame(() => {
      const group = groupRef.current
      const panel = panelRef.current
      if (!group || !panel || hasUserSizedRef.current || panel.isCollapsed()) return
      const groupWidth = group.getBoundingClientRect().width
      if (groupWidth <= 0) return
      panel.resize(resolveChatPanelWidthPx(groupWidth, getSavedChatWidthPx()))
    })
    return () => cancelAnimationFrame(frame)
  }, [isMobile, measured, panelRef])

  // The class carries `display:none !important`, which beats the `display:flex`
  // RRP writes inline on the Panel element on every (incl. async resize) render
  // — so the zeroed footprint survives RRP's own re-layouts.
  useLayoutEffect(() => {
    chatPanelElementRef.current?.classList.toggle('b167-ai-chat-hidden', !chatVisible)
  }, [chatVisible])

  // A keyboard user mid-conversation in the mobile drawer lands on the desktop
  // panel when the window grows; move focus into the chat so the task survives
  // the surface swap instead of dropping to <body>.
  const prevIsMobileRef = useRef(isMobile)
  useEffect(() => {
    const prev = prevIsMobileRef.current
    prevIsMobileRef.current = isMobile
    if (prev && !isMobile && open) {
      chatPanelElementRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()
    }
  }, [isMobile, open])

  const onLayoutChanged = (_layout: unknown, meta: { isUserInteraction: boolean }) => {
    if (!meta.isUserInteraction) return
    const panel = panelRef.current
    if (!panel || panel.isCollapsed()) return
    const { inPixels } = panel.getSize()
    if (inPixels < CHAT_MIN_PX) return
    hasUserSizedRef.current = true
    saveChatWidthPx(inPixels)
  }

  return (
    <>
      <Group
        id="campaign-ai-shell"
        orientation="horizontal"
        className="min-h-0 flex-1"
        elementRef={groupRef}
        onLayoutChanged={onLayoutChanged}
      >
        {/* Main content */}
        <Panel defaultSize="75" minSize={MAIN_MIN_PCT}>
          <div className="[contain:layout_paint] h-full">
            <div className="flex h-full flex-col">{children}</div>
          </div>
        </Panel>

        {/* Resize handle — only meaningful while the chat panel is visible */}
        {/*
          Double-click resets the panel to its raw `defaultSize` (uncapped 25%);
          the product default is the capped min(25%, 360px), so the stale
          reset affordance would reopen wider than allowed — disable it. (B166.)
        */}
        <Separator
          disableDoubleClick
          className={cn(
            'w-3 shrink-0 cursor-col-resize items-center justify-center transition-colors focus:outline-none group/separator data-[resize-handle-active]:bg-primary/20',
            chatVisible ? 'flex' : 'hidden',
          )}
        >
          <div className="h-full w-px bg-border transition-colors group-hover/separator:bg-primary/50 group-data-[resize-handle-active]/separator:bg-primary/50" />
        </Separator>

        {/* AI chat sidebar — footprint hidden while the chat is closed or on mobile */}
        <Panel
          id="ai-chat-panel"
          panelRef={panelRef}
          elementRef={chatPanelElementRef}
          defaultSize={CHAT_DEFAULT_PCT}
          minSize={CHAT_MIN_PX}
        >
          {chatVisible ? <CampaignAISidebar /> : null}
        </Panel>
      </Group>

      {/* Mobile chat surface — mounted outside the Group so the main content owns the full width */}
      {isMobile ? <CampaignAIDrawer /> : null}
    </>
  )
}
