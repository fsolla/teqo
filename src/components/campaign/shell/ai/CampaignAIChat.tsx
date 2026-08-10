'use client'

import { Bot, Mic, Send, Square, User } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { InputGroup, InputGroupButton } from '@/components/ui/input-group'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

import { useAISidebar } from '@/components/campaign/shell/ai/CampaignAISidebarContext'
import { useMicTranscript } from '@/components/campaign/shell/ai/useMicTranscript'

/**
 * B188: app-internal destinations — the B162 link catalog only ever emits
 * `/campanha…` paths — navigate through `next/link`, so following a Sollinha
 * link keeps the layout (and the conversation) mounted instead of reloading
 * the page. Anything else keeps the plain anchor's default behavior.
 */
const APP_INTERNAL_LINK = /^\/campanha(?:\/|$)/

const MarkdownLink = ({
  href,
  children,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & { node?: unknown }) => {
  if (typeof href === 'string' && APP_INTERNAL_LINK.test(href)) {
    return (
      <Link href={href} {...props}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} {...props}>
      {children}
    </a>
  )
}

export const CampaignAIChat = ({ className }: { className?: string }) => {
  const ctx = useAISidebar()
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const mic = useMicTranscript()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const messages = useMemo(() => ctx?.messages ?? [], [ctx])

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

  const { sendMessage, status } = ctx
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
                          return (
                            <div
                              key={index}
                              className="prose prose-sm max-w-none dark:prose-invert [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-sm [&_h1]:font-semibold [&_h2]:font-semibold [&_table]:text-xs [&_th]:text-xs [&_td]:text-xs [&_th]:px-2 [&_th]:py-1 [&_td]:px-2 [&_td]:py-1"
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{ a: MarkdownLink }}
                              >
                                {part.text}
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
