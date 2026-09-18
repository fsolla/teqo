'use client'

import { CheckIcon, CopyIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  copyFeedbackLabelsFor,
  copyFeedbackLiveMessagesFor,
  useCopyFeedback,
} from '@/lib/copyFeedback'

/**
 * C194 — the reel's script/narration text. DB content, not a served file: it
 * stays readable while the reel is unpublished. Each stored line is a block,
 * the same shape the production writes.
 */
export const ReelTranscriptCard = ({ transcript }: { transcript: string }) => {
  const { feedback, copy } = useCopyFeedback()
  const labels = copyFeedbackLabelsFor('text')
  const liveMessages = copyFeedbackLiveMessagesFor('text')
  const blocks = transcript
    .split(/\n+/)
    .map((block) => block.trim())
    .filter(Boolean)

  return (
    <section id="transcricao" className="scroll-mt-20 rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Transcrição / roteiro</h2>
        <Button
          type="button"
          variant="ghost"
          className="min-h-10 px-2 text-xs text-muted-foreground"
          onClick={() => void copy(transcript)}
        >
          {feedback === 'copied' ? (
            <CheckIcon data-icon="inline-start" aria-hidden="true" />
          ) : (
            <CopyIcon data-icon="inline-start" aria-hidden="true" />
          )}
          {labels[feedback]}
        </Button>
      </div>
      <div className="mt-3 space-y-3 text-sm leading-6">
        {blocks.map((block, index) => (
          <p key={`${index}-${block}`}>{block}</p>
        ))}
      </div>
      <span aria-live="polite" className="sr-only">
        {liveMessages[feedback]}
      </span>
    </section>
  )
}
