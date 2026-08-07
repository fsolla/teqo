'use client'

import { PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { toast } from 'sonner'

import {
  CampaignCopyableCell,
  campaignReadCellClassName,
} from '@/components/campaign/shared/CampaignCopyableCell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { campaignInlineInputClassName } from '@/lib/campaignInlineInput'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const SAVE_DEBOUNCE_MS = 500

export type CampaignInlineEditableField = 'name' | 'email' | 'phone' | 'party'

type CampaignInlineEditableCellProps = {
  recordId: number
  recordIdField: string
  field: CampaignInlineEditableField
  value: string | null
  label: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  href?: string
  editTrigger?: 'pencil' | 'cell'
  readBehavior?: 'text' | 'copy'
  saveOnChange?: boolean
  className?: string
}

const inputTypeForField = (field: CampaignInlineEditableField): 'text' | 'email' | 'tel' => {
  if (field === 'email') return 'email'
  if (field === 'phone') return 'tel'
  return 'text'
}

export const CampaignInlineEditableCell = ({
  recordId,
  recordIdField,
  field,
  value,
  label,
  formAction,
  href,
  editTrigger = 'pencil',
  readBehavior = 'text',
  saveOnChange = true,
  className,
}: CampaignInlineEditableCellProps) => {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSavedFeedback, setShowSavedFeedback] = useState(false)
  const lastSaved = useRef((value ?? '').trim())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return
    const next = value ?? ''
    setDraft(next)
    lastSaved.current = next.trim()
  }, [field, recordId, value])

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (savedFeedbackTimerRef.current) clearTimeout(savedFeedbackTimerRef.current)
    }
  }, [])

  const startEditing = () => {
    setShowSavedFeedback(false)
    setErrorMessage(null)
    setIsEditing(true)
  }

  const save = (nextRaw: string) => {
    const displayNext = nextRaw.trim()
    if (displayNext === lastSaved.current) {
      setErrorMessage(null)
      setIsEditing(false)
      return
    }

    const formData = new FormData()
    formData.set(recordIdField, String(recordId))
    formData.set('field', field)
    formData.set(field, nextRaw)

    const id = ++requestId.current
    setIsPending(true)
    setShowSavedFeedback(false)
    setErrorMessage(null)
    void formAction({}, formData)
      .then((result) => {
        if (id !== requestId.current) return
        setIsPending(false)
        if (result.status === 'success') {
          lastSaved.current = displayNext
          setErrorMessage(null)
          setIsEditing(false)
          setShowSavedFeedback(true)
          if (savedFeedbackTimerRef.current) clearTimeout(savedFeedbackTimerRef.current)
          savedFeedbackTimerRef.current = setTimeout(() => {
            savedFeedbackTimerRef.current = null
            setShowSavedFeedback(false)
          }, 1800)
          router.refresh()
          return
        }
        const message =
          result.fieldErrors?.[field]?.[0] ?? result.message ?? 'Não foi possível salvar.'
        setErrorMessage(message)
        toast.error(message)
      })
      .catch(() => {
        if (id !== requestId.current) return
        const message = 'Não foi possível salvar. Tente novamente.'
        setIsPending(false)
        setShowSavedFeedback(false)
        setErrorMessage(message)
        toast.error(message)
      })
  }

  const scheduleSave = (nextRaw: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      save(nextRaw)
    }, SAVE_DEBOUNCE_MS)
  }

  const handleBlur = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    save(draft)
  }

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next =
      field === 'phone'
        ? formatBrazilianPhoneInput(sanitizeBrazilianPhoneInput(event.currentTarget.value))
        : event.currentTarget.value
    setDraft(next)
    if (saveOnChange) scheduleSave(next)
  }

  const handleReadKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    startEditing()
  }

  if (isEditing) {
    return (
      <div className={cn('relative min-w-40', className)}>
        <Input
          ref={inputRef}
          type={inputTypeForField(field)}
          value={draft}
          aria-label={label}
          aria-busy={isPending}
          className={campaignInlineInputClassName}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              if (timerRef.current) clearTimeout(timerRef.current)
              timerRef.current = null
              setDraft(value ?? '')
              setShowSavedFeedback(false)
              setErrorMessage(null)
              setIsEditing(false)
            }
          }}
          {...(field === 'phone' ? { inputMode: 'numeric' as const } : {})}
        />
        {isPending ? (
          <Spinner
            className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2"
            aria-label={`Salvando ${label.toLowerCase()}`}
          />
        ) : null}
        {errorMessage ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
  }

  const displayValue = field === 'phone' && value ? formatBrazilianPhoneInput(value) : undefined
  const readValue =
    href && field === 'name' && value ? (
      <Link
        href={href}
        className={cn(
          campaignReadCellClassName,
          'inline-flex w-auto max-w-full',
          'pointer-events-auto font-medium text-primary underline-offset-4 hover:underline',
        )}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <span className="truncate">{value}</span>
      </Link>
    ) : readBehavior === 'copy' ? (
      <CampaignCopyableCell
        value={value}
        label={label}
        displayValue={displayValue}
        className={field === 'phone' ? 'tabular-nums' : undefined}
      />
    ) : (
      <span
        className={cn(
          campaignReadCellClassName,
          'text-sm text-muted-foreground',
          value ? 'text-foreground' : undefined,
          field === 'phone' ? 'tabular-nums' : undefined,
        )}
      >
        {displayValue ?? value ?? '—'}
      </span>
    )

  const savedFeedback = showSavedFeedback ? (
    <span role="status" aria-live="polite" className="text-xs text-muted-foreground">
      Salvo.
    </span>
  ) : null

  if (editTrigger === 'cell') {
    if (href && field === 'name') {
      return (
        <div className={cn('relative min-w-0 w-full', className)}>
          <button
            type="button"
            className="absolute inset-0 z-0 cursor-text rounded-sm text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            aria-label={`Editar ${label.toLowerCase()}`}
            onClick={startEditing}
          />
          <div className="pointer-events-none relative z-10 flex min-w-0 items-center gap-2">
            {readValue}
            {savedFeedback}
          </div>
        </div>
      )
    }

    return (
      <div
        className={cn('min-w-0 w-full cursor-text', className)}
        role="button"
        tabIndex={0}
        aria-label={`Editar ${label.toLowerCase()}`}
        onClick={startEditing}
        onKeyDown={handleReadKeyDown}
      >
        {readValue}
        {savedFeedback}
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-0.5', className)}>
      <div className="min-w-0 flex-1">{readValue}</div>
      {savedFeedback}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label={`Editar ${label.toLowerCase()}`}
        onClick={startEditing}
      >
        <PencilIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
