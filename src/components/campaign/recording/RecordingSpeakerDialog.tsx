'use client'

import { InfoIcon, PencilIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import type { RecordingSpeakerLabelResponse } from '@/app/(campaign)/campanha/(app)/comunicacao/acervo/gravacoes/types'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { campaignRecordingSpeakersHref } from '@/lib/campaignPaths'
import {
  RECORDING_SPEAKER_DIALOG_HELP,
  RECORDING_SPEAKER_DIALOG_INTRO,
  RECORDING_SPEAKER_DIALOG_TITLE,
  RECORDING_SPEAKER_EDIT_ACTION,
  RECORDING_SPEAKER_IDENTIFY_ACTION,
  RECORDING_SPEAKER_LABEL_FIELD_LABEL,
  RECORDING_SPEAKER_LABEL_LONG_MESSAGE,
  RECORDING_SPEAKER_LABEL_MAX_LENGTH,
  RECORDING_SPEAKER_LABEL_PLACEHOLDER,
  RECORDING_SPEAKER_LABEL_REQUIRED_MESSAGE,
  RECORDING_SPEAKER_SAVE_LABEL,
} from '@/lib/recording'
import type { RecordingSpeakerGroupViewModel } from '@/utilities/recordings/recordingViewModels'

type RecordingSpeakerDialogProps = {
  recordingId: number
  group: RecordingSpeakerGroupViewModel
}

const SAVE_ERROR_MESSAGE = 'Não foi possível salvar a identificação. Tente novamente.'

/**
 * C200 — "Identificar falante" (design scene 2): the team names the anonymous
 * cluster after listening. The dialog never suggests a person; the label is
 * text applied to every segment of the group and the server rejects a key that
 * no longer exists in the recording.
 */
export const RecordingSpeakerDialog = ({ recordingId, group }: RecordingSpeakerDialogProps) => {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState(group.label ?? '')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (next) {
      setLabel(group.label ?? '')
      setError(null)
    }
  }

  const submit = async () => {
    const trimmed = label.trim()
    if (!trimmed) {
      setError(RECORDING_SPEAKER_LABEL_REQUIRED_MESSAGE)
      return
    }
    if (trimmed.length > RECORDING_SPEAKER_LABEL_MAX_LENGTH) {
      setError(RECORDING_SPEAKER_LABEL_LONG_MESSAGE)
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const { ok, payload } = await postCampaignJson<RecordingSpeakerLabelResponse>(
        campaignRecordingSpeakersHref(recordingId),
        { recordingId, speakerKey: group.key, label: trimmed },
      )
      if (!ok || payload.status !== 'success') {
        setError(payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE)
        return
      }
      setOpen(false)
      router.refresh()
    } catch {
      setError(SAVE_ERROR_MESSAGE)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="min-h-9 shrink-0 px-2 md:min-h-10 md:px-3"
          aria-label={group.isIdentified ? RECORDING_SPEAKER_EDIT_ACTION : undefined}
        >
          <PencilIcon data-icon="inline-start" aria-hidden="true" />
          <span className="hidden md:inline">
            {group.isIdentified ? RECORDING_SPEAKER_EDIT_ACTION : RECORDING_SPEAKER_IDENTIFY_ACTION}
          </span>
          {/* Mobile keeps the short verb; an identified group is icon-only. */}
          {group.isIdentified ? null : <span className="md:hidden">Identificar</span>}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{RECORDING_SPEAKER_DIALOG_TITLE}</DialogTitle>
          <DialogDescription>Dê um nome ao agrupamento “{group.defaultLabel}”.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 rounded-lg border border-border bg-muted/50 p-3">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-xs leading-5 text-muted-foreground">
            {RECORDING_SPEAKER_DIALOG_INTRO}
          </p>
        </div>

        <form
          className="flex flex-col gap-1.5"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <label htmlFor={`speaker-label-${group.key}`} className="text-sm font-medium">
            {RECORDING_SPEAKER_LABEL_FIELD_LABEL}
          </label>
          <Input
            id={`speaker-label-${group.key}`}
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={RECORDING_SPEAKER_LABEL_MAX_LENGTH}
            placeholder={RECORDING_SPEAKER_LABEL_PLACEHOLDER}
            className="min-h-11 text-sm"
            autoFocus
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">{RECORDING_SPEAKER_DIALOG_HELP}</p>

          {error ? (
            <Alert variant="destructive" className="mt-2 py-2">
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          ) : null}

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" className="min-h-11" disabled={submitting}>
              {submitting ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              {RECORDING_SPEAKER_SAVE_LABEL}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
