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
import { readSollinhaChatSession, writeSollinhaChatSession } from '@/lib/sollinhaChatSession'

type AISidebarContextValue = {
  /** The chat is showing — single source of truth across panel (desktop) and drawer (mobile). */
  open: boolean
  isMobile: boolean
  /** The first matchMedia measurement has landed (false during the hydration frame). */
  measured: boolean
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
  panelRef,
  children,
}: {
  panelRef: MutableRefObject<PanelImperativeHandle | null>
  children: ReactNode
}) => {
  const [open, setOpen] = useState(false)
  const { isMobile, measured } = useIsMobileMeasured()

  const chat = useChat({
    id: 'campaign-sollinha',
    transport: useMemo(() => new DefaultChatTransport({ api: '/campanha/api/ai-chat' }), []),
  })
  // `setMessages` is a stable `useCallback` over the chat instance — safe as
  // the single dependency of the mount-only restore effect.
  const { messages, setMessages, status } = chat

  // B188: restore the conversation and the open state from the tab's
  // `sessionStorage` after mount — never during SSR, where restored messages
  // would diverge from the server-rendered chat on the hydration frame.
  // `sessionRestored` gates the persist effect so the mount commit (empty
  // pre-restore values) cannot overwrite a stored session.
  const [sessionRestored, setSessionRestored] = useState(false)
  useEffect(() => {
    const session = readSollinhaChatSession()
    if (session) {
      setMessages(session.messages)
      setOpen(session.open)
    }
    setSessionRestored(true)
  }, [setMessages])

  // B188: persist the conversation only once the chat has settled — writing
  // during streaming would freeze a half-received message in the session
  // (a reload mid-stream loses only that in-flight turn). `open` changes made
  // mid-stream are picked up by the settle that follows.
  useEffect(() => {
    if (!sessionRestored || status !== 'ready') return
    writeSollinhaChatSession(messages, open)
  }, [sessionRestored, status, messages, open])

  // The chat has two surfaces keyed by viewport — the desktop panel and the
  // mobile drawer — and both derive from the SAME `open` flag. Crossing the
  // breakpoint therefore needs no migration of its own: the surface that renders
  // just follows `open && viewport`. The only work is keeping `open` truthful:
  // on the desktop settle the panel starts at its RRP default (25%) while `open`
  // begins false — reconcile `open` to the panel's real visibility so a visible
  // chat is "open" (makes close work and the drawer open on resize). A fresh
  // mobile visit keeps `open` false (no spontaneous chat).
  const settledRef = useRef(false)
  useEffect(() => {
    if (settledRef.current) return
    settledRef.current = measured
    if (measured && !isMobile && !panelRef.current?.isCollapsed()) {
      setOpen(true)
    }
  }, [measured, isMobile, panelRef])

  const toggle = useCallback(() => setOpen(!open), [open])

  const value = useMemo(
    () => ({
      open,
      isMobile,
      measured,
      messages: chat.messages,
      status: chat.status,
      sendMessage: chat.sendMessage,
      setOpen,
      toggle,
    }),
    [open, isMobile, measured, chat.messages, chat.status, chat.sendMessage, setOpen, toggle],
  )

  return <AISidebarContext.Provider value={value}>{children}</AISidebarContext.Provider>
}

export const useAISidebar = (): AISidebarContextValue | null => {
  return useContext(AISidebarContext)
}
