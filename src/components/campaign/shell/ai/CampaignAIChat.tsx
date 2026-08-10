'use client'

import { Bot, Mic, Send, Square, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { InputGroup, InputGroupButton } from '@/components/ui/input-group'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Spinner } from '@/components/ui/Spinner'
import { externalLinkTarget } from '@/lib/ai/markdownLinks'
import { cn } from '@/lib/utils'

import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'
import { ChatChipGroup } from '@/components/campaign/shell/ai/ChatChipGroup'
import { useMicTranscript } from '@/components/campaign/shell/ai/useMicTranscript'
import { getSollinhaOpeningQuestions } from '@/lib/sollinhaOpeningQuestions'
import { splitSollinhaFollowUpBlock } from '@/lib/sollinhaFollowUpSuggestions'

/**
 * B187+B188 — links in the assistant's markdown must look like links: brand
 * primary color + always-visible underline, hover thickens the underline and
 * keyboard focus shows a ring (BubbleContent's own `[button,a]:focus-visible:*`
 * only applies when the bubble content ITSELF is the anchor). External http(s)
 * links open in a new tab; app-internal destinations — the B162 link catalog
 * only ever emits `/campanha…` paths — navigate through `next/link` (B188), so
 * following a Sollinha link keeps the layout (and the conversation) mounted
 * instead of reloading the page. Anything else keeps the plain anchor.
 */
const APP_INTERNAL_LINK = /^\/campanha(?:\/|$)/

/** B192 — narrower drawer surface: fewer follow-up chips than on desktop. */
const FOLLOW_UP_MOBILE_LIMIT = 2

const markdownComponents: Components = {
  a: ({ node: _node, href, children, ...rest }) => {
    const external = typeof href === 'string' ? externalLinkTarget(href) : null
    if (typeof href === 'string' && APP_INTERNAL_LINK.test(href)) {
      return (
        <Link href={href} {...rest}>
          {children}
        </Link>
      )
    }
    return (
      <a href={href} {...rest} {...external}>
        {children}
      </a>
    )
  },
}

export const CampaignAIChat = ({ className }: { className?: string }) => {
  const ctx = useAISidebar()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const mic = useMicTranscript()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = useMemo(() => ctx?.messages ?? [], [ctx])

  // B192 — follow-up suggestions of the LATEST assistant message (the final
  // response of the turn — older answers never feed the slot). Derived before
  // the `ctx` early return so the hooks stay unconditional; only rendered once
  // the chat is idle (during streaming the input is locked, so dead chips
  // would confuse; the new ones appear the moment the answer lands).
  const latestAssistantSuggestionText = useMemo(() => {
    if (ctx?.status !== 'ready' || messages.length === 0) return null
    const lastAssistant = [...messages].reverse().find((message) => message.role === 'assistant')
    return lastAssistant?.parts.filter((part) => part.type === 'text').at(-1)?.text ?? null
  }, [messages, ctx?.status])

  const followUpSuggestions = useMemo(() => {
    if (!latestAssistantSuggestionText) return []
    const { suggestions } = splitSollinhaFollowUpBlock(latestAssistantSuggestionText)
    // Viewport cap mirrors the opening catalog: fewer chips on narrow surfaces.
    return suggestions.slice(0, ctx?.isMobile ? FOLLOW_UP_MOBILE_LIMIT : suggestions.length)
  }, [latestAssistantSuggestionText, ctx?.isMobile])

  const showFollowUpChips = followUpSuggestions.length > 0

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // A completed transcript becomes an editable draft in the input — never an
  // auto-sent message (voices mishear proper nouns; the person reviews first).
  useEffect(() => {
    if (!mic.transcript) return
    setInput(mic.transcript)
    textareaRef.current?.focus()
  }, [mic.transcript])

  if (!ctx) return null

  const { sendMessage, status, role, isMobile } = ctx
  const busy = status !== 'ready'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    sendMessage({ text: input })
    setInput('')
  }

  const isRecording = mic.status === 'recording'
  const isTranscribing = mic.status === 'transcribing'
  const micDisabled = busy || isTranscribing

  // B191 — the empty conversation offers curated opening questions as chips
  // above the input. They disappear on the first send because `messages` grows
  // past zero (the slot renders only while empty).
  const showOpeningChips = messages.length === 0 && status === 'ready'
  const openingQuestions = getSollinhaOpeningQuestions(role, isMobile)

  return (
    <div className={cn('grid min-h-0 grid-rows-[1fr_auto]', className)}>
      {/* Messages area */}
      <div className="min-h-0 overflow-y-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div className="max-w-xs space-y-3">
              <Bot className="mx-auto size-10 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Olá! Eu sou o Sollinha, assistente virtual da campanha. Pergunte sobre votações,
                municípios, dobradinhas, lideranças e muito mais.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {messages.map((message) => (
              <Message key={message.id} align={message.role === 'user' ? 'end' : 'start'}>
                <MessageAvatar>
                  {message.role === 'user' ? (
                    <User className="size-4" />
                  ) : (
                    <Bot className="size-4" />
                  )}
                </MessageAvatar>
                <MessageContent>
                  <Bubble
                    variant={message.role === 'user' ? 'default' : 'secondary'}
                    align={message.role === 'user' ? 'end' : 'start'}
                  >
                    <BubbleContent className="overflow-x-auto">
                      {message.parts.map((part, index) => {
                        if (part.type === 'text') {
                          if (message.role === 'user') {
                            return (
                              <span key={index} className="whitespace-pre-wrap">
                                {part.text}
                              </span>
                            )
                          }
                          // B192 — the follow-up block is a format directive
                          // for the chip slot, never chat content: strip it
                          // BEFORE markdown/link rendering so it never shows
                          // as prose (fail-closed: no marker → unchanged).
                          const { body } = splitSollinhaFollowUpBlock(part.text)
                          return (
                            <div
                              key={index}
                              className="prose prose-sm max-w-none dark:prose-invert [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_table]:text-xs [&_th]:text-xs [&_td]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 [&_a]:hover:decoration-2 [&_a]:focus-visible:outline-none [&_a]:focus-visible:ring-2 [&_a]:focus-visible:ring-ring"
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={markdownComponents}
                              >
                                {body}
                              </ReactMarkdown>
                            </div>
                          )
                        }
                        if (part.type === 'tool-invocation') {
                          return (
                            <span key={index} className="text-xs opacity-60">
                              🔍 Buscando dados...
                            </span>
                          )
                        }
                        return null
                      })}
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            ))}

            {busy && messages.length > 0 && (
              <Message align="start">
                <MessageAvatar>
                  <Bot className="size-4" />
                </MessageAvatar>
                <MessageContent>
                  <Bubble variant="secondary">
                    <BubbleContent>
                      <Spinner className="size-4" />
                    </BubbleContent>
                  </Bubble>
                </MessageContent>
              </Message>
            )}

            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 border-t border-border px-3 py-3">
        {/* B191+B192 — one chip slot above the input, fed by two sources: the
            curated opening catalog while the conversation is empty, and the
            follow-ups extracted from the latest answer afterwards. */}
        {(showOpeningChips || showFollowUpChips) && (
          <ChatChipGroup
            questions={
              showOpeningChips
                ? openingQuestions
                : followUpSuggestions.map((text) => ({ text }))
            }
            onPick={({ text }) => {
              if (busy) return
              sendMessage({ text })
            }}
            className="mb-2"
          />
        )}
        <form onSubmit={handleSubmit}>
          <InputGroup className="h-auto min-h-10">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder={isRecording ? 'Ouvindo...' : 'Pergunte para o Sollinha...'}
              disabled={busy}
              rows={1}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={isRecording ? 'Parar gravação' : 'Falar pergunta (voz)'}
              aria-pressed={isRecording}
              disabled={micDisabled}
              onClick={() => (isRecording ? mic.stop() : void mic.start())}
            >
              {isTranscribing ? (
                <Spinner className="size-4" />
              ) : isRecording ? (
                <Square className="size-4 fill-current" />
              ) : (
                <Mic className="size-4" />
              )}
              <span className="sr-only">{isRecording ? 'Parar gravação' : 'Falar'}</span>
            </InputGroupButton>
            <InputGroupButton
              type="submit"
              variant="default"
              size="icon-sm"
              disabled={busy || !input.trim()}
            >
              <Send className="size-4" />
              <span className="sr-only">Enviar</span>
            </InputGroupButton>
          </InputGroup>
        </form>
        <div className="mt-2">
          {isRecording && (
            <Marker variant="default">
              <MarkerContent>
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className="size-1.5 animate-pulse rounded-full bg-destructive"
                    aria-hidden
                  />
                  Ouvindo... {mic.elapsed}s — toque no quadrado para finalizar.
                </span>
              </MarkerContent>
            </Marker>
          )}
          {mic.status === 'error' && mic.errorMessage && (
            <Marker variant="default">
              <MarkerContent>
                {mic.errorMessage}{' '}
                <button
                  type="button"
                  className="underline underline-offset-2"
                  onClick={mic.dismissError}
                >
                  Dispensar
                </button>
              </MarkerContent>
            </Marker>
          )}
          {!isRecording && mic.status !== 'error' && (
            <Marker>
              <MarkerContent>
                Sollinha pode cometer erros. Verifique informações importantes.
              </MarkerContent>
            </Marker>
          )}
        </div>
      </div>
    </div>
  )
}
