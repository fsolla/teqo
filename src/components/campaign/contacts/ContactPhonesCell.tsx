'use client'

import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, type KeyboardEvent } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { campaignInlineInputClassName } from '@/lib/campaignInlineInput'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type ContactPhonesCellProps = {
  recordId: number
  /** Stored order = priority (first is primary) — C112 contract. */
  phones: readonly string[]
  formAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

const sanitize = (raw: string): string => sanitizeBrazilianPhoneInput(raw)

/**
 * C139 — the phone cell of the contacts table: stacked borderless inputs with
 * the phone mask. Blur/Enter on ANY line commits the WHOLE list (order =
 * priority), empty lines are discarded before the schema; Escape discards the
 * draft and "+" appends a line. The commit is the ficha's full `phones` array
 * (`field: 'phones'`) — a single value is never written alone.
 */
export const ContactPhonesCell = ({ recordId, phones, formAction }: ContactPhonesCellProps) => {
  const router = useRouter()
  const [draft, setDraft] = useState<string[]>(() => phones.map(formatBrazilianPhoneInput))
  const [isPending, setIsPending] = useState(false)

  const clean = (lines: string[]): string[] => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const line of lines) {
      const value = sanitize(line)
      if (!value || seen.has(value)) continue
      seen.add(value)
      result.push(value)
    }
    return result
  }

  const dirty = (lines: string[]): boolean => {
    const cleaned = clean(lines)
    if (cleaned.length !== phones.length) return true
    return cleaned.some((value, index) => value !== sanitize(phones[index] ?? ''))
  }

  const commit = (lines: string[]) => {
    if (isPending) return
    if (!dirty(lines)) return

    const formData = new FormData()
    formData.set('id', String(recordId))
    formData.set('field', 'phones')
    for (const value of clean(lines)) formData.append('phones', value)

    setIsPending(true)
    void formAction({}, formData)
      .then((result) => {
        if (result.status === 'success') {
          setDraft(clean(lines).map(formatBrazilianPhoneInput))
          router.refresh()
          return
        }
        const message =
          result.fieldErrors?.phones?.[0] ?? result.message ?? 'Não foi possível salvar.'
        setDraft(phones.map(formatBrazilianPhoneInput))
        toast.error(message)
      })
      .catch(() => {
        setDraft(phones.map(formatBrazilianPhoneInput))
        toast.error('Não foi possível salvar. Tente novamente.')
      })
      .finally(() => {
        setIsPending(false)
      })
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setDraft(phones.map(formatBrazilianPhoneInput))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(draft)
      event.currentTarget.blur()
    }
  }

  return (
    <div className="flex min-w-0 flex-col">
      {draft.map((line, index) => (
        <Input
          key={index}
          inputMode="numeric"
          aria-label={`Telefone ${index + 1}${index === 0 ? ' (principal)' : ''}`}
          aria-busy={isPending}
          value={line}
          placeholder="Sem telefone"
          className={campaignInlineInputClassName}
          onChange={(event) => {
            const next = [...draft]
            next[index] = formatBrazilianPhoneInput(sanitize(event.currentTarget.value))
            setDraft(next)
          }}
          onBlur={() => commit(draft)}
          onKeyDown={handleKeyDown}
        />
      ))}
      {draft.length === 0 ? (
        <span className="px-1 text-sm text-muted-foreground">Sem telefone</span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit min-h-9 gap-1 self-start px-1 text-muted-foreground hover:text-foreground"
        aria-label="Adicionar telefone"
        onClick={() => {
          setDraft((current) => [...current, ''])
        }}
      >
        <PlusIcon className="size-3.5" aria-hidden />
        Adicionar telefone
      </Button>
    </div>
  )
}
