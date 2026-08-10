'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type AbstractChat, type ChatStatus, type UIMessage } from 'ai'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react'
import type { PanelImperativeHandle } from 'react-resizable-panels'

import { useIsMobileMeasured } from '@/hooks/use-mobile'
import type { CampaignRole } from '@/lib/campaignRoles'
import {
  readSollinhaChatSession,
  writeSollinhaChatSession,
  type SollinhaChatSessionOpenOrigin,
} from '@/lib/sollinhaChatSession'

type AISidebarContextValue = {
  /** The chat is showing — single source of truth across panel (desktop) and drawer (mobile). */
  open: boolean
  isMobile: boolean
  /** The first matchMedia measurement has landed (false during the hydration frame). */
  measured: boolean
  /** Authenticated campaign role — drives the opening-chip curation (B191). */
  role: CampaignRole
  messages: UIMessage[]
  status: ChatStatus
  sendMessage: AbstractChat<UIMessage>['sendMessage']
  /** Opens/closes the chat. The desktop Panel and the mobile Drawer react to `open`. */
  setOpen: (open: boolean) => void
  /** Toggles the chat. */
  toggle: () => void
}

const AISidebarContext = createContext<AISidebarContextValue | null>(null)

export const CampaignAISidebarProvider = ({
  role,
  panelRef,
  children,
}: {
  role: CampaignRole
  panelRef: MutableRefObject<PanelImperativeHandle | null>
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const { isMobile, measured } = useIsMobileMeasured()

  const chat = useChat({
    id: 'campaign-sollinha',
    transport: useMemo(() => new DefaultChatTransport({ api: '/campanha/api/ai-chat' }), []),
  })
  const { messages, setMessages, status } = chat

  // B188: restore the conversation and the open state from the tab's
  // `sessionStorage` after mount — never during SSR, where restored messages
  // would diverge from the server-rendered chat on the hydration frame.
  // `sessionRestored` gates the persist effect so the mount commit (empty
  // pre-restore values) cannot overwrite a stored session.
  //
  // OPS22: the decision needs the REAL viewport, so the restore waits for the
  // first `measured` commit (where `isMobile` is already correct). A
  // settle-originated `open: true` (the desktop panel reconcile, B167) is
  // layout truth, not user intent — restoring it on a mobile viewport made
  // the drawer open "by itself" whenever a desktop tab visited a mobile page
  // in the same session (the e2e login at desktop width + mobile agenda
  // reproduced it deterministically). Only a user-originated open (FAB /
  // header button / drawer swipe) restores on mobile.
  const [sessionRestored, setSessionRestored] = useState(false)
  const restoredSessionRef = useRef(false)
  const sessionReadRef = useRef(false)
  const restoredOpenByRef = useRef<SollinhaChatSessionOpenOrigin>('settle')
  useEffect(() => {
    if (sessionReadRef.current || !measured) return
    sessionReadRef.current = true
    const session = readSollinhaChatSession()
    if (session) {
      setMessages(session.messages)
      const openBy = session.openBy ?? 'settle'
      restoredOpenByRef.current = openBy
      if (session.open && (openBy === 'user' || !isMobile)) setOpen(true)
    }
    restoredSessionRef.current = session !== null
    setSessionRestored(true)
  }, [setMessages, measured, isMobile])

  // OPS22: every user surface (FAB, header button, drawer swipe) opens/closes
  // the chat through the context `setOpen`/`toggle` — those mark the intent.
  // The restore and the B167 settle call the raw state setter instead, so a
  // layout-driven open never counts as a user action.
  const userToggledOpenRef = useRef(false)
  const requestOpen = useCallback(
    (next: boolean) => {
      userToggledOpenRef.current = true
      setOpen(next)
    },
    [setOpen],
  )

  // B188: persist the conversation only once the chat has settled — writing
  // during streaming would freeze a half-received message in the session
  // (a reload mid-stream loses only that in-flight turn). `open` changes made
  // mid-stream are picked up by the settle that follows. Empty state is still
  // written: closing an empty chat must overwrite a stored `open: true`,
  // otherwise a reload would reopen a drawer the user just closed. The
  // persisted `openBy` tells the next page whether the open was the user's
  // (restore it anywhere) or the desktop settle's (desktop-only, OPS22).
  useEffect(() => {
    if (!sessionRestored || status !== 'ready') return
    const openBy =
      userToggledOpenRef.current || restoredOpenByRef.current === 'user' ? 'user' : 'settle'
    writeSollinhaChatSession(messages, open, openBy)
  }, [sessionRestored, status, messages, open])

  // The chat has two surfaces keyed by viewport — the desktop panel and the
  // mobile drawer — and both derive from the SAME `open` flag. Crossing the
  // breakpoint therefore needs no migration of its own: the surface that renders
  // just follows `open && viewport`. The only work is keeping `open` truthful:
  // on the desktop settle the panel starts at its RRP default (25%) while `open`
  // begins false — reconcile `open` to the panel's real visibility so a visible
  // chat is "open" (makes close work and the drawer open on resize). A fresh
  // mobile visit keeps `open` false (no spontaneous chat). When a session was
  // restored, the restored `open` wins instead — a chat closed before the
  // reload must not be forced back open by the settle (B188).
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current) return
    settledRef.current = measured
    if (measured && !isMobile && !restoredSessionRef.current && !panelRef.current?.isCollapsed()) {
      setOpen(true)
    }
  }, [measured, isMobile, panelRef])

  const toggle = useCallback(() => {
    userToggledOpenRef.current = true
    setOpen(!open)
  }, [open, setOpen])

  const value = useMemo(
    () => ({
      open,
      isMobile,
      measured,
      role,
      messages,
      status,
      sendMessage: chat.sendMessage,
      setOpen: requestOpen,
      toggle,
    }),
    [open, isMobile, measured, role, messages, status, chat.sendMessage, requestOpen, toggle],
  )

  return <AISidebarContext.Provider value={value}>{children}</AISidebarContext.Provider>
}

export const useAISidebar = (): AISidebarContextValue | null => {
  return useContext(AISidebarContext)
}
