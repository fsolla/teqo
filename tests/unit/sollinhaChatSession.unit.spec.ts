import { afterEach, describe, expect, it } from 'vitest'

import type { UIMessage } from 'ai'

import {
  SOLLINHA_CHAT_MAX_BYTES,
  SOLLINHA_CHAT_MAX_MESSAGES,
  SOLLINHA_CHAT_SESSION_STORAGE_KEY,
  pruneSollinhaChatMessages,
  readSollinhaChatSession,
  writeSollinhaChatSession,
} from '@/lib/sollinhaChatSession'

const makeMessage = (id: string, role: UIMessage['role'], text = `msg ${id}`): UIMessage => ({
  id,
  role,
  parts: [{ type: 'text', text }],
})

describe('sollinhaChatSession storage', () => {
  afterEach(() => {
    window.sessionStorage.clear()
  })

  it('returns null when storage is missing or invalid (fail-closed)', () => {
    expect(readSollinhaChatSession()).toBeNull()
    window.sessionStorage.setItem(SOLLINHA_CHAT_SESSION_STORAGE_KEY, 'not-json')
    expect(readSollinhaChatSession()).toBeNull()
    window.sessionStorage.setItem(
      SOLLINHA_CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 2, messages: [], open: false }),
    )
    expect(readSollinhaChatSession()).toBeNull()
    window.sessionStorage.setItem(
      SOLLINHA_CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, messages: 'nope', open: false }),
    )
    expect(readSollinhaChatSession()).toBeNull()
    window.sessionStorage.setItem(
      SOLLINHA_CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, messages: [{ id: 1, role: 'user' }], open: false }),
    )
    expect(readSollinhaChatSession()).toBeNull()
    window.sessionStorage.setItem(
      SOLLINHA_CHAT_SESSION_STORAGE_KEY,
      JSON.stringify({ version: 1, messages: [], open: 'yes' }),
    )
    expect(readSollinhaChatSession()).toBeNull()
  })

  it('round-trips messages and open state', () => {
    const messages = [makeMessage('1', 'user'), makeMessage('2', 'assistant')]
    writeSollinhaChatSession(messages, true)
    const session = readSollinhaChatSession()
    expect(session?.messages).toEqual(messages)
    expect(session?.open).toBe(true)
  })

  it('prunes to the message-count guardrail keeping the newest', () => {
    const messages = Array.from({ length: SOLLINHA_CHAT_MAX_MESSAGES + 5 }, (_, index) =>
      makeMessage(String(index), index % 2 === 0 ? 'user' : 'assistant'),
    )
    const pruned = pruneSollinhaChatMessages(messages)
    expect(pruned).toHaveLength(SOLLINHA_CHAT_MAX_MESSAGES)
    expect(pruned[0]?.id).toBe('5')
    expect(pruned.at(-1)?.id).toBe(String(SOLLINHA_CHAT_MAX_MESSAGES + 4))
  })

  it('prunes to the byte guardrail dropping the oldest until it fits', () => {
    const big = 'x'.repeat(SOLLINHA_CHAT_MAX_BYTES)
    const pruned = pruneSollinhaChatMessages([
      makeMessage('1', 'user'),
      makeMessage('2', 'assistant', big),
      makeMessage('3', 'user'),
    ])
    expect(pruned).toHaveLength(1)
    expect(pruned[0]?.id).toBe('3')
  })

  it('writes the pruned session, never the raw messages', () => {
    const messages = Array.from({ length: SOLLINHA_CHAT_MAX_MESSAGES + 5 }, (_, index) =>
      makeMessage(String(index), index % 2 === 0 ? 'user' : 'assistant'),
    )
    writeSollinhaChatSession(messages, false)
    const session = readSollinhaChatSession()
    expect(session?.messages).toHaveLength(SOLLINHA_CHAT_MAX_MESSAGES)
    expect(session?.messages[0]?.id).toBe('5')
    expect(session?.open).toBe(false)
  })

  it('keeps tool outputs intact so the restored history round-trips to the model', () => {
    const messages = [
      makeMessage('1', 'user'),
      // The lib treats `parts` opaquely — the shape here mirrors what a real
      // settled stream produces (tool part with its output) without depending
      // on the SDK's tool-typed part union.
      {
        id: '2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-invocation',
            toolCallId: 'call-1',
            toolName: 'calculate',
            state: 'output-available',
            input: { expression: '1+1' },
            output: 2,
          },
          { type: 'text', text: 'O resultado é 2.' },
        ],
      },
    ] as unknown as UIMessage[]
    writeSollinhaChatSession(messages, true)
    expect(readSollinhaChatSession()?.messages).toEqual(messages)
  })
})
