'use client'

import { useActionState, useEffect, useId, useState } from 'react'
import { AlertTriangleIcon, CheckIcon, SearchIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import type {
  CoordinatorAssignmentFormAction,
  CoordinatorAssignmentOptionsResult,
} from '@/components/campaign/CoordinatorAssignmentDialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'

export const CoordinatorAssignmentDialogBody = ({
  action,
  initialSelectedIds,
  onClose,
  onPendingChange,
  result,
}: {
  action: CoordinatorAssignmentFormAction
  initialSelectedIds: number[]
  onClose: () => void
  onPendingChange?: (pending: boolean) => void
  result: CoordinatorAssignmentOptionsResult
}) => {
  const router = useRouter()
  const optionsId = useId()
  const optionsHeadingId = useId()
  const [state, formAction, pending] = useActionState(action, {})
  const [selectedIds, setSelectedIds] = useState(initialSelectedIds)
  const [query, setQuery] = useState('')
  const selected = new Set(selectedIds)
  const visibleOptions = result.options.filter((option) =>
    option.name.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')),
  )

  useEffect(() => {
    if (!pending) return
    toast.loading('Salvando coordenação…', { id: 'coordinator-assignment' })
  }, [pending])

  useEffect(() => {
    onPendingChange?.(pending)
  }, [onPendingChange, pending])

  useEffect(() => {
    if (!state.message || pending) return
    if (state.status === 'success') {
      toast.success(state.message, { id: 'coordinator-assignment' })
      onClose()
      router.refresh()
      return
    }
    toast.error(state.message, { id: 'coordinator-assignment' })
  }, [onClose, pending, router, state])

  return (
    <form action={formAction} className="flex min-h-0 flex-col gap-4">
      <input type="hidden" name="expectedUpdatedAt" value={result.expectedUpdatedAt} />
      {selectedIds.map((id) => (
        <input key={id} type="hidden" name="coordinators" value={String(id)} />
      ))}
      {result.options.length ? (
        <div className="min-h-0 rounded-lg border p-1">
          <div className="relative">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              aria-controls={optionsId}
              aria-describedby={optionsHeadingId}
              autoComplete="off"
              spellCheck={false}
              className="min-h-11 rounded-lg pr-3 pl-9"
              aria-label="Buscar coordenadores"
              placeholder="Buscar por nome…"
              autoFocus
            />
          </div>
          <div
            id={optionsHeadingId}
            className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground"
          >
            Usuários elegíveis
          </div>
          <div id={optionsId}>
            {visibleOptions.length ? (
              <ul className="no-scrollbar max-h-72 overflow-x-hidden overflow-y-auto p-1">
                {visibleOptions.map((option) => {
                  const checked = selected.has(option.id)
                  return (
                    <li key={option.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={checked}
                        data-checked={checked}
                        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 data-[checked=true]:bg-muted"
                        onClick={() =>
                          setSelectedIds((current) =>
                            current.includes(option.id)
                              ? current.filter((id) => id !== option.id)
                              : [...current, option.id],
                          )
                        }
                      >
                        <span
                          data-checked={checked}
                          aria-hidden="true"
                          className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-input data-[checked=true]:border-primary data-[checked=true]:bg-primary data-[checked=true]:text-primary-foreground"
                        >
                          {checked ? <CheckIcon className="size-3.5" /> : null}
                        </span>
                        <span>
                          {option.name}
                          {option.isCurrent ? ' (você)' : ''}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="py-6 text-center text-sm">Nenhuma pessoa corresponde à busca.</p>
            )}
          </div>
        </div>
      ) : (
        <Alert>
          <AlertTriangleIcon aria-hidden="true" />
          <AlertTitle>Nenhum usuário elegível disponível</AlertTitle>
          <AlertDescription>
            Não há usuários com papel de coordenação geral ou coordenador para designar.
          </AlertDescription>
        </Alert>
      )}
      {state.message && state.status !== 'success' ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Não foi possível salvar</AlertTitle>
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onClose}
          disabled={pending}
        >
          Cancelar
        </Button>
        <Button type="submit" className="min-h-11" disabled={pending}>
          {pending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Salvar coordenação
        </Button>
      </DialogFooter>
    </form>
  )
}
