'use client'

import {
  MessageCircleIcon,
  PencilIcon,
  PlusIcon,
  SaveIcon,
  SearchXIcon,
  UserCogIcon,
  XIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { AdvisorDebouncedTextCell } from '@/components/campaign/AdvisorDebouncedTextCell'
import { AdvisorMunicipalityCell } from '@/components/campaign/AdvisorMunicipalityCell'
import { AdvisorPasswordResetButton } from '@/components/campaign/AdvisorPasswordResetButton'
import { CampaignListEmptyState } from '@/components/campaign/CampaignListEmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import type { AdvisorMunicipalityIndexEntry } from '@/lib/advisorMunicipalityPortfolio'
import { isPlanilhaPlaceholderEmail } from '@/lib/schemas/advisor'
import { cn } from '@/lib/utils'
import type { AdvisorRowViewModel } from '@/utilities/advisorData'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'
import {
  formatBrazilianPhoneInput,
  normalizeBrazilianPhone,
  sanitizeBrazilianPhoneInput,
  buildWhatsAppUrl,
} from '@/utilities/phone'

type MunicipalityRef = { id: number; name: string; slug: string }

type DraftAdvisor = {
  name: string
  email: string
  phone: string
  municipalities: MunicipalityRef[]
}

type AdvisorsTableProps = {
  rows: AdvisorRowViewModel[]
  municipalityIndex: AdvisorMunicipalityIndexEntry[]
  hasQuery: boolean
  updateProfileAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  membershipAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  batchAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  createAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState & { advisorId?: number }>
  passwordResetAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
}

const emptyDraft = (): DraftAdvisor => ({
  name: '',
  email: '',
  phone: '',
  municipalities: [],
})

const whatsAppHrefForPhone = (phone: string | null): string | null => {
  if (!phone || !normalizeBrazilianPhone(phone)) return null
  try {
    return buildWhatsAppUrl(phone)
  } catch {
    return null
  }
}

const copyText = async (label: string, value: string) => {
  try {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copiado.`)
  } catch {
    toast.error(`Não foi possível copiar o ${label.toLowerCase()}.`)
  }
}

/** Mirrors the inline input box (height, border, padding) so toggling edition never reflows. */
const READ_CELL_CLASS =
  'flex min-h-10 w-full items-center rounded-full border border-transparent px-2 text-left'

const displayEmail = (email: string | null): string => {
  if (!email || isPlanilhaPlaceholderEmail(email)) return ''
  return email
}

export const AdvisorsTable = ({
  rows,
  municipalityIndex,
  hasQuery,
  updateProfileAction,
  membershipAction,
  batchAction,
  createAction,
  passwordResetAction,
}: AdvisorsTableProps) => {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DraftAdvisor | null>(null)
  const [isCreating, startCreate] = useTransition()

  const refresh = () => router.refresh()

  const startDraft = () => {
    setEditing(true)
    setDraft(emptyDraft())
  }

  const cancelDraft = () => setDraft(null)

  const leaveEditing = () => {
    setDraft(null)
    setEditing(false)
  }

  const saveDraft = () => {
    if (!draft) return
    if (draft.name.trim().length < 2) {
      toast.error('Informe o nome do assessor.')
      return
    }
    if (!draft.email.trim()) {
      toast.error('Informe o e-mail do assessor.')
      return
    }

    const formData = new FormData()
    formData.set('name', draft.name.trim())
    formData.set('email', draft.email.trim())
    if (draft.phone.trim()) formData.set('phone', draft.phone.trim())
    for (const municipality of draft.municipalities) {
      formData.append('municipalityIds', String(municipality.id))
    }

    startCreate(async () => {
      const result = await createAction({}, formData)
      if (result.status === 'success') {
        toast.success(result.message ?? 'Assessor criado.')
        setDraft(null)
        refresh()
        return
      }
      toast.error(result.message ?? 'Não foi possível criar o assessor.')
    })
  }

  const showEmpty = rows.length === 0 && !draft

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap justify-end gap-2">
        {editing ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={leaveEditing}>
            Concluir edição
          </Button>
        ) : (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(true)}>
            <PencilIcon data-icon="inline-start" aria-hidden="true" />
            Editar
          </Button>
        )}
        <Button
          type="button"
          className="min-h-11"
          onClick={startDraft}
          disabled={Boolean(draft)}
        >
          <PlusIcon data-icon="inline-start" aria-hidden="true" />
          Novo assessor
        </Button>
      </div>

      {showEmpty ? (
        <CampaignListEmptyState
          icon={hasQuery ? SearchXIcon : UserCogIcon}
          title={hasQuery ? 'Nenhum assessor encontrado' : 'Nenhum assessor cadastrado'}
          description={
            hasQuery
              ? 'Ajuste a busca ou limpe o filtro para ver todos.'
              : 'Ative a edição e crie a conta na tabela.'
          }
        >
          {!hasQuery ? (
            <Button type="button" className="min-h-11" onClick={startDraft}>
              <PlusIcon data-icon="inline-start" aria-hidden="true" />
              Novo assessor
            </Button>
          ) : null}
        </CampaignListEmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <Table className="min-w-[56rem] table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[20%]">Nome</TableHead>
                <TableHead className="w-[24%]">E-mail</TableHead>
                <TableHead className="w-[14%]">Celular</TableHead>
                <TableHead>Municípios</TableHead>
                <TableHead className="w-28 text-right">
                  <span className="sr-only">Ações</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {draft ? (
                <TableRow className="bg-muted/20">
                  <TableCell>
                    <Input
                      value={draft.name}
                      onChange={(event) => {
                        const name = event.currentTarget.value
                        setDraft((current) => (current ? { ...current, name } : current))
                      }}
                      placeholder="Nome"
                      aria-label="Nome do novo assessor"
                      className="min-h-10 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
                      autoFocus
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="email"
                      value={draft.email}
                      onChange={(event) => {
                        const email = event.currentTarget.value
                        setDraft((current) => (current ? { ...current, email } : current))
                      }}
                      placeholder="E-mail"
                      aria-label="E-mail do novo assessor"
                      className="min-h-10 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="tel"
                      inputMode="numeric"
                      value={draft.phone}
                      onChange={(event) => {
                        const phone = formatBrazilianPhoneInput(
                          sanitizeBrazilianPhoneInput(event.currentTarget.value),
                        )
                        setDraft((current) => (current ? { ...current, phone } : current))
                      }}
                      placeholder="Celular"
                      aria-label="Celular do novo assessor"
                      className="min-h-10 border-transparent bg-transparent px-2 shadow-none hover:border-input focus-visible:border-input"
                    />
                  </TableCell>
                  <TableCell>
                    <AdvisorMunicipalityCell
                      advisorId={null}
                      municipalities={draft.municipalities}
                      municipalityIndex={municipalityIndex}
                      editing
                      draft
                      onDraftChange={(municipalities) =>
                        setDraft((current) => (current ? { ...current, municipalities } : current))
                      }
                      membershipAction={membershipAction}
                      batchAction={batchAction}
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-10"
                        aria-label="Cancelar novo assessor"
                        disabled={isCreating}
                        onClick={cancelDraft}
                      >
                        <XIcon className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        className="size-10"
                        aria-label="Salvar novo assessor"
                        disabled={isCreating}
                        onClick={saveDraft}
                      >
                        {isCreating ? (
                          <Spinner className="size-4" aria-hidden="true" />
                        ) : (
                          <SaveIcon className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}

              {rows.map((row) => {
                const whatsAppHref = whatsAppHrefForPhone(row.phone)
                const emailShown = displayEmail(row.email)
                const phoneShown = row.phone ? formatBrazilianPhoneInput(row.phone) : ''

                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      {editing ? (
                        <AdvisorDebouncedTextCell
                          advisorId={row.id}
                          field="name"
                          defaultValue={row.name}
                          ariaLabel={`Nome de ${row.name}`}
                          formAction={updateProfileAction}
                        />
                      ) : (
                        <Link
                          href={`/campanha/assessores/${row.id}`}
                          className={cn(
                            READ_CELL_CLASS,
                            'font-medium text-primary underline-offset-4 hover:underline',
                          )}
                        >
                          <span className="truncate">{row.name}</span>
                        </Link>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <AdvisorDebouncedTextCell
                          advisorId={row.id}
                          field="email"
                          type="email"
                          defaultValue={row.email ?? ''}
                          placeholder="E-mail"
                          ariaLabel={`E-mail de ${row.name}`}
                          placeholderEmailFallback={row.email}
                          formAction={updateProfileAction}
                        />
                      ) : emailShown ? (
                        <button
                          type="button"
                          className={cn(READ_CELL_CLASS, 'underline-offset-4 hover:underline')}
                          onClick={() => void copyText('E-mail', emailShown)}
                        >
                          <span className="truncate">{emailShown}</span>
                        </button>
                      ) : (
                        <span className={cn(READ_CELL_CLASS, 'text-sm text-muted-foreground')}>
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editing ? (
                        <AdvisorDebouncedTextCell
                          advisorId={row.id}
                          field="phone"
                          type="tel"
                          defaultValue={row.phone ? formatBrazilianPhoneInput(row.phone) : ''}
                          placeholder="Celular"
                          ariaLabel={`Celular de ${row.name}`}
                          formAction={updateProfileAction}
                        />
                      ) : phoneShown ? (
                        <button
                          type="button"
                          className={cn(
                            READ_CELL_CLASS,
                            'tabular-nums underline-offset-4 hover:underline',
                          )}
                          onClick={() => void copyText('Celular', row.phone ?? phoneShown)}
                        >
                          <span className="truncate">{phoneShown}</span>
                        </button>
                      ) : (
                        <span className={cn(READ_CELL_CLASS, 'text-sm text-muted-foreground')}>
                          —
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <AdvisorMunicipalityCell
                        advisorId={row.id}
                        municipalities={row.municipalities}
                        municipalityIndex={municipalityIndex}
                        editing={editing}
                        membershipAction={membershipAction}
                        batchAction={batchAction}
                        onPersisted={refresh}
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {whatsAppHref ? (
                          <Button asChild variant="ghost" size="icon" className="size-10">
                            <a
                              href={whatsAppHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Enviar WhatsApp para ${row.name}`}
                            >
                              <MessageCircleIcon className="size-4" aria-hidden="true" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-10"
                            disabled
                            aria-label={`WhatsApp indisponível — ${row.name} sem celular`}
                          >
                            <MessageCircleIcon className="size-4" aria-hidden="true" />
                          </Button>
                        )}
                        <AdvisorPasswordResetButton
                          advisorId={row.id}
                          disabled={!emailShown}
                          layout="icon"
                          accessibleName={`Enviar link de senha para ${row.name}`}
                          formAction={passwordResetAction}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
