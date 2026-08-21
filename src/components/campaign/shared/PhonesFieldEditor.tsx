'use client'

import { ArrowDownIcon, ArrowUpIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

import { FormattedInput } from '@/components/FormattedInput'
import { Button } from '@/components/ui/button'
import { FieldError, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { campaignInlineInputClassName } from '@/lib/campaignInlineInput'
import { formatBrazilianPhoneInput, sanitizeBrazilianPhoneInput } from '@/lib/phone'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type PhoneRow = { key: string; value: string }

let rowKey = 0
const nextRowKey = (): string => `phone-${++rowKey}`
const EMPTY_ROW_KEY = 'phone-empty'

const displayValue = (value: string): string => formatBrazilianPhoneInput(value)

/**
 * The repeatable phone list editor (C112): one masked input per number, order
 * = priority (first = primary), with remove and ↑/↓ reorder — no labels, no
 * drag (product cut). In a create/edit form it renders plain inputs named
 * `phones` for the form action to collect; with `saveAction` it becomes the
 * ficha's inline editor (Salvar/Cancelar + refresh on success).
 */
export const PhonesFieldEditor = ({
  name = 'phones',
  defaultValues = [],
  minRows = 0,
  label = 'Celulares',
  error,
  saveAction,
  recordId,
  recordIdField,
  saveLabel = 'Salvar',
  cancelLabel = 'Cancelar',
  className,
  readOnly = false,
}: {
  name?: string
  defaultValues?: string[]
  /** Rows below this count cannot be removed (create flows that require a phone). */
  minRows?: number
  label?: string
  error?: string | string[] | undefined
  /** Inline mode: submits the full list through the per-surface contact update action. */
  saveAction?: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  recordId?: number
  recordIdField?: string
  saveLabel?: string
  cancelLabel?: string
  className?: string
  /** C142 — read-only presentation (advisor with Edição `somente_leitura`): the phones render as a plain list with no edit affordance. */
  readOnly?: boolean
}) => {
  const router = useRouter()
  const [rows, setRows] = useState<PhoneRow[]>(() => {
    const initial = defaultValues.map((value) => ({ key: nextRowKey(), value }))
    while (initial.length < minRows) initial.push({ key: nextRowKey(), value: '' })
    return initial
  })
  const [isPending, setIsPending] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(!saveAction)
  const rowsRef = useRef(rows)
  rowsRef.current = rows
  const appliedDefaultsRef = useRef<string[]>(defaultValues)

  useEffect(() => {
    if (!saveAction) return
    // Apply the server values only when they actually changed (a post-save
    // refresh or an unrelated refresh of the page must not drop what the
    // user is typing).
    if (defaultValues.join('|') === appliedDefaultsRef.current.join('|')) return
    appliedDefaultsRef.current = defaultValues
    setRows((current) => {
      const existing = new Map(current.map((row) => [row.value, row]))
      const next = defaultValues.map((value) => existing.get(value) ?? { key: nextRowKey(), value })
      return next.length > 0 || current.length === 0 ? next : current
    })
  }, [defaultValues, saveAction])

  const updateRow = (key: string, value: string): void => {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, value } : row)))
    setSaveError(null)
  }

  const addRow = (): void => {
    setRows((current) => [...current, { key: nextRowKey(), value: '' }])
    setSaveError(null)
  }

  const removeRow = (key: string): void => {
    setRows((current) =>
      current.length > minRows ? current.filter((row) => row.key !== key) : current,
    )
    setSaveError(null)
  }

  const moveRow = (index: number, direction: -1 | 1): void => {
    setRows((current) => {
      const target = index + direction
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return next
    })
    setSaveError(null)
  }

  const errorId = 'phones-field-error'
  const hasError = saveError !== null || (Array.isArray(error) ? error.length > 0 : Boolean(error))

  const save = async (): Promise<void> => {
    if (!saveAction || recordId === undefined) return
    const formData = new FormData()
    if (recordIdField) formData.set(recordIdField, String(recordId))
    formData.set('field', 'phones')
    for (const row of rowsRef.current) {
      formData.append(name, row.value)
    }
    setIsPending(true)
    setSaveError(null)
    try {
      const result = await saveAction({}, formData)
      setIsPending(false)
      if (result.status === 'success') {
        setIsEditing(false)
        router.refresh()
        return
      }
      const message =
        result.fieldErrors?.phones?.[0] ??
        result.fieldErrors?.[name]?.[0] ??
        result.fieldErrors?.form?.[0] ??
        result.message
      const refusal = message ?? 'Não foi possível salvar.'
      setSaveError(refusal)
      toast.error(refusal)
    } catch {
      setIsPending(false)
      const message = 'Não foi possível salvar. Tente novamente.'
      setSaveError(message)
      toast.error(message)
    }
  }

  const rowInputs = rows.map((row, index) => (
    <div key={row.key} className="flex items-center gap-1.5">
      <FormattedInput
        name={name}
        inputMode="tel"
        autoComplete="tel"
        aria-label={`Celular ${index + 1}`}
        aria-invalid={hasError}
        aria-describedby={hasError ? `${errorId}` : undefined}
        value={displayValue(row.value)}
        format={formatBrazilianPhoneInput}
        sanitize={sanitizeBrazilianPhoneInput}
        className={campaignInlineInputClassName}
        onChange={(event) => updateRow(row.key, event.currentTarget.value)}
      />
      {rows.length > 1 ? (
        <>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Mover para cima (torna principal antes dos demais)"
            disabled={index === 0}
            onClick={() => moveRow(index, -1)}
          >
            <ArrowUpIcon className="size-4" aria-hidden="true" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-9 shrink-0"
            aria-label="Mover para baixo"
            disabled={index === rows.length - 1}
            onClick={() => moveRow(index, 1)}
          >
            <ArrowDownIcon className="size-4" aria-hidden="true" />
          </Button>
        </>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-9 shrink-0"
        aria-label={`Remover celular ${index + 1}`}
        disabled={rows.length <= minRows}
        onClick={() => removeRow(row.key)}
      >
        <Trash2Icon className="size-4" aria-hidden="true" />
      </Button>
    </div>
  ))

  const addButton = (
    <Button
      type="button"
      variant="ghost"
      className="h-9 w-fit shrink-0 justify-start px-2 text-sm text-muted-foreground"
      aria-label="Adicionar telefone"
      onClick={addRow}
    >
      <PlusIcon className="size-4" aria-hidden="true" />
      Adicionar telefone
    </Button>
  )

  if (saveAction && !isEditing) {
    return (
      <div className={className}>
        <ul className="flex flex-col gap-1.5" aria-label={label}>
          {(rows.length ? rows : [{ key: EMPTY_ROW_KEY, value: '' }]).map((row, index) => (
            <li key={row.key} className="flex items-center gap-1.5 text-sm tabular-nums">
              <span className="w-6 text-right text-muted-foreground">{index + 1}.</span>
              <span className="min-w-40">
                {row.value ? formatBrazilianPhoneInput(row.value) : '—'}
              </span>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="mt-1 size-11"
          aria-label={`Editar ${label.toLowerCase()}`}
          onClick={() => {
            setIsEditing(true)
            setSaveError(null)
          }}
        >
          <span className="sr-only">Editar</span>
          <PlusIcon className="size-4" aria-hidden="true" />
        </Button>
      </div>
    )
  }

  // C142 — read-only: the phones render as a plain list with no edit
  // affordance (absence is the language).
  if (readOnly) {
    return (
      <div className={className}>
        <ul className="flex flex-col gap-1.5" aria-label={label}>
          {(rows.length ? rows : [{ key: EMPTY_ROW_KEY, value: '' }]).map((row, index) => (
            <li key={row.key} className="flex items-center gap-1.5 text-sm tabular-nums">
              <span className="w-6 text-right text-muted-foreground">{index + 1}.</span>
              <span className="min-w-40">
                {row.value ? formatBrazilianPhoneInput(row.value) : '—'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="flex flex-col gap-2">
        {rowInputs}
        {addButton}
      </div>
      {hasError ? (
        <FieldError id={errorId}>
          {saveError ?? (Array.isArray(error) ? error[0] : error)}
        </FieldError>
      ) : null}
      {saveAction ? (
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" disabled={isPending} onClick={() => void save()}>
            {saveLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            disabled={isPending}
            onClick={() => {
              setIsEditing(false)
              setSaveError(null)
            }}
          >
            {cancelLabel}
          </Button>
          {isPending ? <Spinner className="size-4" aria-label="Salvando telefones" /> : null}
        </div>
      ) : null}
    </div>
  )
}
