'use client'

import { cn } from '@/lib/utils'

import type { SollinhaChatChip } from '@/lib/sollinhaOpeningQuestions'

/**
 * Presentational chip group for the chat's quick-question slot (B191). Renders
 * each question as a pill button; picking one sends the text through `onPick`.
 * B192 feeds follow-ups from the latest answer into this same slot/component.
 */
export const ChatChipGroup = ({
  questions,
  onPick,
  className,
}: {
  questions: readonly SollinhaChatChip[]
  onPick: (question: SollinhaChatChip) => void
  className?: string
}) => {
  if (questions.length === 0) return null

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {questions.map((question) => (
        <button
          key={question.text}
          type="button"
          onClick={() => onPick(question)}
          className="rounded-full border border-border bg-secondary/50 px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          {question.text}
        </button>
      ))}
    </div>
  )
}
