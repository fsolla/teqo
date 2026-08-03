'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react'

import type { MunicipalityNextStepsResponse } from '@/app/(campaign)/campanha/(app)/municipios/next-steps/types'
import { Spinner } from '@/components/ui/Spinner'
import { Textarea } from '@/components/ui/textarea'
import { campaignInlineInputClassName } from '@/lib/campaignInlineInput'
import { postCampaignJson } from '@/lib/campaignJsonRequest'
import { cn } from '@/lib/utils'

const NEXT_STEPS_ENDPOINT = '/campanha/municipios/next-steps'
const SAVE_DEBOUNCE_MS = 600
const SAVE_ERROR_MESSAGE = 'Não foi possível salvar o encaminhamento. Tente novamente.'
const NEXT_STEPS_MAX_LENGTH = 4000

const normalizeNextSteps = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

type MunicipalityV2NextStepsControlProps = {
  municipalityID: number
  municipalityName: string
  defaultValue: string | null
}

export const MunicipalityV2NextStepsControl = ({
  municipalityID,
  municipalityName,
  defaultValue,
}: MunicipalityV2NextStepsControlProps) => {
  const statusId = useId()
  const router = useRouter()
  const displayDefault = defaultValue ?? ''
  const [value, setValue] = useState(displayDefault)
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const lastSaved = useRef(normalizeNextSteps(displayDefault) ?? '')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (textareaRef.current && document.activeElement === textareaRef.current) return
    const next = defaultValue ?? ''
    setValue(next)
    lastSaved.current = normalizeNextSteps(next) ?? ''
  }, [defaultValue, municipalityID])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const save = (nextRaw: string) => {
    const normalized = normalizeNextSteps(nextRaw) ?? ''
    if (normalized === lastSaved.current) return

    const id = ++requestId.current
    setIsPending(true)
    setErrorMessage(null)

    void postCampaignJson<MunicipalityNextStepsResponse>(
      NEXT_STEPS_ENDPOINT,
      { municipalityId: municipalityID, nextSteps: normalized || null },
    ).then(({ ok, payload }) => {
      if (id !== requestId.current) return
      setIsPending(false)
      if (!ok || payload.status !== 'success') {
        setErrorMessage(
          payload.status === 'error' ? payload.message : SAVE_ERROR_MESSAGE,
        )
        return
      }
      lastSaved.current = normalizeNextSteps(payload.savedNextSteps) ?? ''
      router.refresh()
    })
  }

  const scheduleSave = (nextRaw: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      save(nextRaw)
    }, SAVE_DEBOUNCE_MS)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={`${statusId}-next-steps`} className="text-sm font-medium">
        Próximo passo combinado
        <span className="sr-only"> para {municipalityName}</span>
      </label>
      <div className="relative">
        <Textarea
          ref={textareaRef}
          id={`${statusId}-next-steps`}
          value={value}
          rows={3}
          maxLength={NEXT_STEPS_MAX_LENGTH}
          placeholder="O que a equipe combinou fazer a seguir neste município?"
          aria-label={`Encaminhamento de ${municipalityName}`}
          aria-busy={isPending}
          aria-describedby={errorMessage ? `${statusId}-next-steps-error` : undefined}
          className={cn(campaignInlineInputClassName, 'min-h-24 resize-y py-2')}
          onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
            setValue(event.currentTarget.value)
            setErrorMessage(null)
            scheduleSave(event.currentTarget.value)
          }}
          onBlur={() => {
            if (timerRef.current) {
              clearTimeout(timerRef.current)
              timerRef.current = null
            }
            save(value)
          }}
        />
        {isPending ? (
          <Spinner className="pointer-events-none absolute top-2 right-2 size-3.5" />
        ) : null}
      </div>
      {errorMessage ? (
        <p id={`${statusId}-next-steps-error`} className="text-sm text-destructive" role="alert">
          {errorMessage}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Salva automaticamente ao editar.</p>
      )}
    </div>
  )
}
