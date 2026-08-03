'use client'

import { PencilIcon } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { updateLeadershipContactFormAction } from '@/app/(campaign)/campanha/(app)/liderancas/formActions'
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

type LeadershipContactField = 'name' | 'email' | 'phone'

type LeadershipContactFieldControlProps = {
  leadershipId: number
  field: LeadershipContactField
  value: string | null
  className?: string
}

const fieldLabels: Record<LeadershipContactField, string> = {
  name: 'Nome',
  email: 'E-mail',
  phone: 'Celular',
}

const inputTypeForField = (field: LeadershipContactField): 'text' | 'email' | 'tel' => {
  if (field === 'email') return 'email'
  if (field === 'phone') return 'tel'
  return 'text'
}

export const LeadershipContactFieldControl = ({
  leadershipId,
  field,
  value,
  className,
}: LeadershipContactFieldControlProps) => {
  const label = fieldLabels[field]
  const phoneDisplayValue =
    field === 'phone' && value ? formatBrazilianPhoneInput(value) : undefined
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? '')
  const [isPending, setIsPending] = useState(false)
  const lastSaved = useRef((value ?? '').trim())
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const requestId = useRef(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (inputRef.current && document.activeElement === inputRef.current) return
    const next = value ?? ''
    setDraft(next)
    lastSaved.current = next.trim()
  }, [value, leadershipId, field])

  useEffect(() => {
    if (!isEditing) return
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [isEditing])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const save = (nextRaw: string) => {
    const displayNext = nextRaw.trim()
    if (displayNext === lastSaved.current) {
      setIsEditing(false)
      return
    }

    const formData = new FormData()
    formData.set('leadershipId', String(leadershipId))
    formData.set('field', field)
    formData.set(field, nextRaw)

    const id = ++requestId.current
    setIsPending(true)
    void updateLeadershipContactFormAction({}, formData).then((result: CampaignFormActionState) => {
      if (id !== requestId.current) return
      setIsPending(false)
      if (result.status === 'success') {
        lastSaved.current = displayNext
        setIsEditing(false)
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
    scheduleSave(next)
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
              setDraft(value ?? '')
              setIsEditing(false)
            }
          }}
          {...(field === 'phone' ? { inputMode: 'numeric' as const } : {})}
        />
        {isPending ? (
          <Spinner className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2" />
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('flex min-w-0 items-center gap-0.5', className)}>
      <div className="min-w-0 flex-1">
        {field === 'name' ? (
          value ? (
            <Link
              href={`/campanha/liderancas/${leadershipId}`}
              className={cn(
                campaignReadCellClassName,
                'font-medium text-primary underline-offset-4 hover:underline',
              )}
            >
              <span className="truncate">{value}</span>
            </Link>
          ) : (
            <span className={cn(campaignReadCellClassName, 'text-sm text-muted-foreground')}>
              —
            </span>
          )
        ) : (
          <CampaignCopyableCell
            value={value}
            label={label}
            displayValue={phoneDisplayValue}
            className={field === 'phone' ? 'tabular-nums' : undefined}
          />
        )}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        aria-label={`Editar ${label.toLowerCase()}`}
        onClick={() => setIsEditing(true)}
      >
        <PencilIcon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  )
}
