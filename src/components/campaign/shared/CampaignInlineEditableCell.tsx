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

export type CampaignInlineEditableField = 'name' | 'email' | 'phone' | 'party' | 'ballotName'

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
  /**
   * C116 — "edit where you see": the input is ALWAYS mounted, borderless and
   * tintless (no edit state, no label/border/background change). Saves on
   * blur/Enter, Escape discards, empty shows a "—" placeholder. With `href` +
   * `field === 'name'` the value renders as a LINK above the invisible input —
   * the draft lives in the link's text, so clicking the link navigates and
   * typing edits in the same place (mechanism locked at the C116 gate).
   */
  permanent?: boolean
  className?: string
}

const inputTypeForField = (field: CampaignInlineEditableField): 'text' | 'email' | 'tel' => {
  if (field === 'email') return 'email'
  if (field === 'phone') return 'tel'
  return 'text'
}

/** The discreet keyboard-focus indicator of the permanent mode (a11y guardrail). */
const permanentFocusClassName =
  'rounded-sm focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none'

/**
 * Permanent cells display the phone already formatted — the raw 11 digits stay
 * on the server, so the draft and the save baseline share the display.
 */
const displayDraftFor = (field: CampaignInlineEditableField, raw: string): string =>
  field === 'phone' && raw ? formatBrazilianPhoneInput(raw) : raw

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
  permanent = false,
  className,
}: CampaignInlineEditableCellProps) => {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, setIsPending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [showSavedFeedback, setShowSavedFeedback] = useState(false)
  const [focused, setFocused] = useState(false)
  const lastSaved = useRef((value ?? '').trim())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)
  /**
   * C130 — Escape must DISCARD, not save. `setDraft` cannot run before the
   * synchronous `blur()` that follows it, so the blur's save would read the
   * STALE draft from this render's closure and persist the discarded text —
   * the flag makes the next blur a no-op revert instead.
   */
  const pendingDiscardRef = useRef(false)

  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return
    const next = value ?? ''
    const display = displayDraftFor(field, next)
    setDraft(display)
    lastSaved.current = display.trim()
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
    setFocused(false)
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (pendingDiscardRef.current) {
      pendingDiscardRef.current = false
      setDraft(displayDraftFor(field, value ?? ''))
      setErrorMessage(null)
      setShowSavedFeedback(false)
      return
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

  /**
   * C116 — "edit where you see": input always mounted, no edit state. The
   * name-link cell renders the LINK above an invisible input (the draft lives
   * in the link's text, the input value is never the display — locked
   * mechanism); every other field is a borderless input that reads as text.
   *
   * C130 — while the name-link input is FOCUSED the roles swap: the link
   * steps out of the way (`opacity-0 pointer-events-none`) and the input
   * becomes the display with a real caret, so typing shows the caret exactly
   * where the text is (same element, no overlay misalignment — a z-order swap
   * would drift on names long enough to scroll the input internally).
   */
  if (permanent) {
    const isNameLink = href !== undefined && field === 'name'
    const inputClassName = cn(
      isNameLink
        ? cn(
            // `z-0` while unfocused keeps the link (z-10) the click target —
            // the locked C116 mechanism; `z-20` while focused steps the input
            // above the faded link so the caret shows and clicks edit.
            'absolute inset-0 h-full w-full cursor-text border-transparent bg-transparent px-0 shadow-none',
            focused
              ? 'z-20 font-medium text-primary caret-foreground'
              : 'z-0 text-transparent caret-transparent',
          )
        : 'min-h-10 w-full border-transparent bg-transparent px-1 shadow-none',
      permanentFocusClassName,
    )
    return (
      <div className={cn('relative min-w-0 w-full', isNameLink && 'min-h-10', className)}>
        {isNameLink ? (
          <Link
            href={href}
            // `w-auto`: the link spans ONLY its text, so the rest of the cell
            // stays the input's clickable area (click on the text navigates,
            // click beside it edits — the locked C116 mechanism). C130:
            // focused cells fade the link so clicks land in the input (caret
            // placement) instead of navigating mid-edit.
            className={cn(
              'relative z-10 inline-flex min-h-10 max-w-full items-center font-medium text-primary underline-offset-4 hover:underline',
              // C130 — while the input owns focus the link steps out of the
              // way AND out of the tab order (a faded link must not be
              // reachable via Shift+Tab).
              focused && 'pointer-events-none opacity-0',
            )}
            tabIndex={focused ? -1 : undefined}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <span className="truncate">{draft || value || ''}</span>
          </Link>
        ) : null}
        <Input
          ref={inputRef}
          type={inputTypeForField(field)}
          value={draft}
          placeholder={isNameLink ? undefined : '—'}
          aria-label={label}
          aria-busy={isPending}
          className={inputClassName}
          onChange={handleChange}
          onFocus={(event) => {
            setFocused(true)
            // C130 — select only in the name-link cell: a click on the phone
            // or email must be able to place the caret mid-value, and
            // selecting there would make one stray keystroke replace the
            // whole number.
            if (isNameLink) event.currentTarget.select()
          }}
          onBlur={handleBlur}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              // Discard: the next blur reverts without saving (see
              // `pendingDiscardRef` — blur would otherwise persist the stale
              // draft from this render's closure). Bumping the request id also
              // mutes a debounce save that already left the client.
              pendingDiscardRef.current = true
              requestId.current += 1
              setIsPending(false)
              event.currentTarget.blur()
              return
            }
            if (event.key === 'Enter') {
              event.preventDefault()
              event.currentTarget.blur()
            }
          }}
          {...(field === 'phone' ? { inputMode: 'numeric' as const } : {})}
        />
        {isPending ? (
          <Spinner
            className="pointer-events-none absolute top-1/2 right-2 z-20 size-3.5 -translate-y-1/2"
            aria-label={`Salvando ${label.toLowerCase()}`}
          />
        ) : null}
        {showSavedFeedback ? (
          <span
            role="status"
            aria-live="polite"
            className="pointer-events-none absolute top-1/2 right-2 z-20 -translate-y-1/2 bg-background/90 px-1 text-xs text-muted-foreground"
          >
            Salvo.
          </span>
        ) : null}
        {errorMessage ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {errorMessage}
          </p>
        ) : null}
      </div>
    )
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
