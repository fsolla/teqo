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
import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { AdvisorDebouncedTextCell } from '@/components/campaign/advisor/AdvisorDebouncedTextCell'
import { AdvisorPasswordResetButton } from '@/components/campaign/advisor/AdvisorPasswordResetButton'
import {
  CampaignCopyableCell,
  campaignReadCellClassName,
} from '@/components/campaign/shared/CampaignCopyableCell'
import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import { CampaignListSheetProvider } from '@/components/campaign/shared/CampaignListSheetHost'
import {
  CampaignTable,
  CampaignTableHead,
  type CampaignTableColumn,
} from '@/components/campaign/shared/CampaignTable'
import { MunicipalityPortfolioCell } from '@/components/campaign/shared/MunicipalityPortfolioCell'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import type { CampaignColumnVisibility } from '@/lib/campaignColumnVisibility'
import { campaignInlineInputClassName } from '@/lib/campaignInlineInput'
import type { MunicipalityPortfolioIndexEntry } from '@/lib/municipalityPortfolio'
import {
  formatBrazilianPhoneInput,
  sanitizeBrazilianPhoneInput,
  whatsAppHrefForPhone,
} from '@/lib/phone'
import { isPlanilhaPlaceholderEmail } from '@/lib/schemas/advisor'
import { cn } from '@/lib/utils'
import type { AdvisorRowViewModel } from '@/utilities/advisorData'
import type { CampaignFormActionState } from '@/utilities/campaignFormActionError'

type DraftAdvisor = {
  name: string
  email: string
  phone: string
  municipalityIds: number[]
}

type AdvisorTableRow =
  | { kind: 'draft'; draft: DraftAdvisor }
  | { kind: 'advisor'; advisor: AdvisorRowViewModel }

type AdvisorsTableProps = {
  rows: AdvisorRowViewModel[]
  municipalityIndex: MunicipalityPortfolioIndexEntry[]
  hasQuery: boolean
  columnVisibility: CampaignColumnVisibility
  updateProfileAction: (
    state: CampaignFormActionState,
    formData: FormData,
  ) => Promise<CampaignFormActionState>
  municipalitiesAction: (
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
  autoCreateDraft?: boolean
}

const emptyDraft = (): DraftAdvisor => ({
  name: '',
  email: '',
  phone: '',
  municipalityIds: [],
})

const displayEmail = (email: string | null): string | null => {
  if (!email || isPlanilhaPlaceholderEmail(email)) return null
  return email
}

export const AdvisorsTable = ({
  rows,
  municipalityIndex,
  hasQuery,
  columnVisibility,
  updateProfileAction,
  municipalitiesAction,
  createAction,
  passwordResetAction,
  autoCreateDraft = false,
}: AdvisorsTableProps) => {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<DraftAdvisor | null>(null)
  const [isCreating, startCreate] = useTransition()

  const refresh = () => router.refresh()

  // One array per row per render of `rows`, not per render of this table: the
  // cell reconciles its optimistic state against this prop by identity.
  const municipalityIdsByAdvisor = useMemo(
    () => new Map(rows.map((row) => [row.id, row.municipalityIDs])),
    [rows],
  )

  const startDraft = () => {
    setEditing(true)
    setDraft(emptyDraft())
  }

  useEffect(() => {
    if (autoCreateDraft) setDraft(emptyDraft())
  }, [autoCreateDraft])

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
    for (const municipalityId of draft.municipalityIds) {
      formData.append('municipalityIds', String(municipalityId))
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

  const tableRows: AdvisorTableRow[] = [
    ...(draft ? [{ kind: 'draft' as const, draft }] : []),
    ...rows.map((advisor) => ({ kind: 'advisor' as const, advisor })),
  ]

  const columns: Array<CampaignTableColumn<AdvisorTableRow>> = [
    {
      id: 'name',
      label: 'Nome',
      mandatory: true,
      cell: (row) => {
        if (row.kind === 'draft') {
          return (
            <Input
              value={row.draft.name}
              onChange={(event) => {
                const name = event.currentTarget.value
                setDraft((current) => (current ? { ...current, name } : current))
              }}
              placeholder="Nome"
              aria-label="Nome do novo assessor"
              className={campaignInlineInputClassName}
              autoFocus
            />
          )
        }
        const { advisor } = row
        if (editing) {
          return (
            <AdvisorDebouncedTextCell
              advisorId={advisor.id}
              field="name"
              defaultValue={advisor.name}
              ariaLabel={`Nome de ${advisor.name}`}
              formAction={updateProfileAction}
            />
          )
        }
        return (
          <Link
            href={`/campanha/assessores/${advisor.id}`}
            className={cn(
              campaignReadCellClassName,
              'font-medium text-primary underline-offset-4 hover:underline',
            )}
          >
            <span className="truncate">{advisor.name}</span>
          </Link>
        )
      },
    },
    {
      id: 'email',
      label: 'E-mail',
      cell: (row) => {
        if (row.kind === 'draft') {
          return (
            <Input
              type="email"
              value={row.draft.email}
              onChange={(event) => {
                const email = event.currentTarget.value
                setDraft((current) => (current ? { ...current, email } : current))
              }}
              placeholder="E-mail"
              aria-label="E-mail do novo assessor"
              className={campaignInlineInputClassName}
            />
          )
        }
        const { advisor } = row
        if (editing) {
          return (
            <AdvisorDebouncedTextCell
              advisorId={advisor.id}
              field="email"
              type="email"
              defaultValue={advisor.email ?? ''}
              placeholder="E-mail"
              ariaLabel={`E-mail de ${advisor.name}`}
              placeholderEmailFallback={advisor.email}
              formAction={updateProfileAction}
            />
          )
        }
        return <CampaignCopyableCell value={displayEmail(advisor.email)} label="E-mail" />
      },
    },
    {
      id: 'phone',
      label: 'Celular',
      cell: (row) => {
        if (row.kind === 'draft') {
          return (
            <Input
              type="tel"
              inputMode="numeric"
              value={row.draft.phone}
              onChange={(event) => {
                const phone = formatBrazilianPhoneInput(
                  sanitizeBrazilianPhoneInput(event.currentTarget.value),
                )
                setDraft((current) => (current ? { ...current, phone } : current))
              }}
              placeholder="Celular"
              aria-label="Celular do novo assessor"
              className={campaignInlineInputClassName}
            />
          )
        }
        const { advisor } = row
        if (editing) {
          return (
            <AdvisorDebouncedTextCell
              advisorId={advisor.id}
              field="phone"
              type="tel"
              defaultValue={advisor.phone ? formatBrazilianPhoneInput(advisor.phone) : ''}
              placeholder="Celular"
              ariaLabel={`Celular de ${advisor.name}`}
              formAction={updateProfileAction}
            />
          )
        }
        return (
          <CampaignCopyableCell
            value={advisor.phone}
            label="Celular"
            displayValue={advisor.phone ? formatBrazilianPhoneInput(advisor.phone) : undefined}
            className="tabular-nums"
          />
        )
      },
    },
    {
      id: 'municipalities',
      label: 'Municípios',
      cell: (row) => {
        if (row.kind === 'draft') {
          return (
            <MunicipalityPortfolioCell
              ownerId={null}
              ownerName={row.draft.name.trim() || 'um novo assessor'}
              municipalityIds={row.draft.municipalityIds}
              municipalityIndex={municipalityIndex}
              draft
              onDraftChange={(municipalityIds) =>
                setDraft((current) => (current ? { ...current, municipalityIds } : current))
              }
              commitAction={municipalitiesAction}
              drawerTitle="Carteira do assessor"
              updateErrorMessage="Não foi possível atualizar a carteira."
            />
          )
        }
        const { advisor } = row
        return (
          <MunicipalityPortfolioCell
            ownerId={advisor.id}
            ownerName={advisor.name}
            municipalityIds={municipalityIdsByAdvisor.get(advisor.id) ?? []}
            municipalityIndex={municipalityIndex}
            commitAction={municipalitiesAction}
            drawerTitle="Carteira do assessor"
            updateErrorMessage="Não foi possível atualizar a carteira."
          />
        )
      },
    },
    {
      id: 'actions',
      label: 'Ações',
      head: (
        <CampaignTableHead align="right">
          <span className="sr-only">Ações</span>
        </CampaignTableHead>
      ),
      cellClassName: 'text-right',
      cell: (row) => {
        if (row.kind === 'draft') {
          return (
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
          )
        }
        const { advisor } = row
        const whatsAppHref = whatsAppHrefForPhone(advisor.phone)
        const emailShown = displayEmail(advisor.email)
        return (
          <div className="flex justify-end gap-1">
            {whatsAppHref ? (
              <Button asChild variant="ghost" size="icon" className="size-10">
                <a
                  href={whatsAppHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Enviar WhatsApp para ${advisor.name}`}
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
                aria-label={`WhatsApp indisponível — ${advisor.name} sem celular`}
              >
                <MessageCircleIcon className="size-4" aria-hidden="true" />
              </Button>
            )}
            <AdvisorPasswordResetButton
              advisorId={advisor.id}
              disabled={!emailShown}
              layout="icon"
              accessibleName={`Enviar link de senha para ${advisor.name}`}
              formAction={passwordResetAction}
            />
          </div>
        )
      },
    },
  ]

  return (
    // One shared Drawer for the portfolio chip cells on coarse pointers
    // (miss #52 — never a Drawer root per opened cell).
    <CampaignListSheetProvider>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap justify-end gap-2">
          {editing ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={leaveEditing}>
              Concluir edição
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setEditing(true)}
            >
              <PencilIcon data-icon="inline-start" aria-hidden="true" />
              Editar nome e contato
            </Button>
          )}
          <Button type="button" className="min-h-11" onClick={startDraft} disabled={Boolean(draft)}>
            <PlusIcon data-icon="inline-start" aria-hidden="true" />
            Novo assessor
          </Button>
        </div>

        <CampaignTable
          columns={columns}
          columnVisibility={columnVisibility}
          rows={tableRows}
          rowKey={(row) => (row.kind === 'draft' ? 'draft' : row.advisor.id)}
          rowClassName={(row) => (row.kind === 'draft' ? 'bg-muted/20' : undefined)}
          empty={
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
          }
        />
      </div>
    </CampaignListSheetProvider>
  )
}
