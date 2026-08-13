'use client'

import { ChevronDownIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'

import { cn } from '@/lib/utils'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type ContactSelectField = 'gender' | 'state'

type ContactSelectOption = {
  value: string
  label: string
}

type ContactSelectCellProps = {
  recordId: number
  field: ContactSelectField
  value: string | null
  label: string
  options: readonly ContactSelectOption[]
  /**
   * The label of the "empty" option shown when `value` is null (the ficha has
   * no gender recorded). State is required on the collection, so the empty
   * option never appears there.
   */
  emptyLabel?: string
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  className?: string
}

/**
 * C139 — the gender/state cells of the contacts table: a native select styled
 * as a borderless text cell. Changing the option commits immediately through
 * the same per-cell ladder as the text cells (`field: gender|state`); a failed
 * commit reverts the select and toasts the message (the people-cell error
 * pattern).
 */
export const ContactSelectCell = ({
  recordId,
  field,
  value,
  label,
  options,
  emptyLabel = '—',
  formAction,
  className,
}: ContactSelectCellProps) => {
  const router = useRouter()
  const [selected, setSelected] = useState(value ?? '')
  const [isPending, setIsPending] = useState(false)

  const commit = async (next: string) => {
    if (next === (value ?? '') || next === '') return
    setIsPending(true)
    const formData = new FormData()
    formData.set('id', String(recordId))
    formData.set('field', field)
    formData.set(field, next)
    try {
      const result = await formAction({}, formData)
      if (result.status === 'success') {
        router.refresh()
        return
      }
      const message =
        result.fieldErrors?.[field]?.[0] ?? result.message ?? 'Não foi possível salvar.'
      setSelected(value ?? '')
      toast.error(message)
    } catch {
      setSelected(value ?? '')
      toast.error('Não foi possível salvar. Tente novamente.')
    } finally {
      setIsPending(false)
    }
  }

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelected(event.currentTarget.value)
    void commit(event.currentTarget.value)
  }

  const hasValue = value !== null && value !== ''

  return (
    <div className={cn('relative inline-flex min-w-0 max-w-full items-center', className)}>
      <select
        aria-label={label}
        aria-busy={isPending}
        disabled={isPending}
        value={selected}
        onChange={handleChange}
        className={cn(
          'min-h-10 w-full cursor-pointer appearance-none rounded-sm border-transparent bg-transparent pr-6 pl-1 text-sm',
          'focus-visible:ring-1 focus-visible:ring-ring/50 focus-visible:outline-none',
          hasValue ? 'text-foreground' : 'text-muted-foreground',
          isPending && 'opacity-60',
        )}
      >
        {!hasValue ? <option value="">{emptyLabel}</option> : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDownIcon
        aria-hidden="true"
        className="pointer-events-none absolute right-1.5 size-3.5 text-muted-foreground"
      />
    </div>
  )
}
