'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import {
  isPlanilhaPlaceholderEmail,
  planilhaPlaceholderEmailForAdvisor,
} from '@/lib/schemas/advisor'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

const SAVE_DEBOUNCE_MS = 500

type AdvisorDebouncedTextCellProps = {
  advisorId: number
  field: 'name' | 'email' | 'phone'
  defaultValue: string
  type?: 'text' | 'email' | 'tel'
  placeholder?: string
  ariaLabel: string
  /** When set, empty e-mail saves this (or a generated) @planilha.invalid address. */
  placeholderEmailFallback?: string | null
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

export const AdvisorDebouncedTextCell = ({
  advisorId,
  field,
  defaultValue,
  type = 'text',
  placeholder,
  ariaLabel,
  placeholderEmailFallback,
  formAction,
}: AdvisorDebouncedTextCellProps) => {
  const displayDefault =
    field === 'email' && isPlanilhaPlaceholderEmail(defaultValue) ? '' : defaultValue
  const router = useRouter()
  const [value, setValue] = useState(displayDefault)
  const [isPending, setIsPending] = useState(false)
  const lastSaved = useRef(displayDefault.trim())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    // A refresh triggered by our own save must never clobber what is being typed.
    if (inputRef.current && document.activeElement === inputRef.current) return
    const nextDisplay =
      field === 'email' && isPlanilhaPlaceholderEmail(defaultValue) ? '' : defaultValue
    setValue(nextDisplay)
    lastSaved.current = nextDisplay.trim()
  }, [defaultValue, advisorId, field])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const resolveEmailToPersist = (nextRaw: string): string => {
    const next = nextRaw.trim()
    if (next) return next
    if (placeholderEmailFallback && isPlanilhaPlaceholderEmail(placeholderEmailFallback)) {
      return placeholderEmailFallback.trim().toLowerCase()
    }
    if (isPlanilhaPlaceholderEmail(defaultValue)) return defaultValue.trim().toLowerCase()
    return planilhaPlaceholderEmailForAdvisor(advisorId)
  }

  const save = (nextRaw: string) => {
    const displayNext = nextRaw.trim()
    if (displayNext === lastSaved.current) return

    const persisted = field === 'email' ? resolveEmailToPersist(nextRaw) : displayNext

    const formData = new FormData()
    formData.set('advisorId', String(advisorId))
    formData.set('field', field)
    formData.set(field, persisted)

    const id = ++requestId.current
    setIsPending(true)
    void formAction({}, formData).then((result) => {
      if (id !== requestId.current) return
      setIsPending(false)
      if (result.status === 'success') {
        lastSaved.current = displayNext
        // Keeps derived UI (WhatsApp action, password-reset availability) in sync.
        router.refresh()
        return
      }
      toast.error(result.message ?? 'Não foi possível salvar.')
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
    <div className="relative min-w-40">
      <Input
        ref={inputRef}
        type={type}
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-busy={isPending}
        className="min-h-10 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const next =
            type === 'tel'
              ? formatBrazilianPhoneInput(sanitizeBrazilianPhoneInput(event.currentTarget.value))
              : event.currentTarget.value
          setValue(next)
          scheduleSave(next)
        }}
        onBlur={() => {
          if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
          }
          save(value)
        }}
        {...(type === 'tel' ? { inputMode: 'numeric' as const } : {})}
      />
      {isPending ? (
        <Spinner className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
      ) : null}
    </div>
  )
}
