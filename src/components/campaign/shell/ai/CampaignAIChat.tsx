'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Bot, Send, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { Bubble, BubbleContent } from '@/components/ui/bubble'
import { InputGroup, InputGroupButton } from '@/components/ui/input-group'
import { Marker, MarkerContent } from '@/components/ui/marker'
import { Message, MessageAvatar, MessageContent } from '@/components/ui/message'
import { Spinner } from '@/components/ui/Spinner'
import { cn } from '@/lib/utils'

export const CampaignAIChat = ({ className }: { className?: string }) => {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/campanha/api/ai-chat' }),
  })
  const [input, setInput] = useState('')
  const viewportRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const busy = status !== 'ready'

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || busy) return
    sendMessage({ text: input })
    setInput('')
  }

  return (
    <div className={cn('grid min-h-0 grid-rows-[1fr_auto]', className)}>
      {/* Messages area */}
      <div
        ref={viewportRef}
        className="min-h-0 overflow-y-auto px-4 py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
      >
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
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Pergunte para a Sollinha..."
              disabled={busy}
              rows={1}
              className="min-h-0 flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-50"
            />
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
        <Marker className="mt-2">
          <MarkerContent>
            Sollinha pode cometer erros. Verifique informações importantes.
          </MarkerContent>
        </Marker>
      </div>
    </div>
  )
}
