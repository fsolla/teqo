'use client'

import { useState } from 'react'

import { CopyIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'

import type { GoogleCalendarSyncActionResult } from '@/app/(campaign)/campanha/actions/googleCalendarSync'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerCloseButton,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/Drawer'
import { Input } from '@/components/ui/input'
import { useIsMobile } from '@/hooks/use-mobile'
import { formatBahiaDateTimeLabel } from '@/lib/campaignTime'

type GoogleCalendarSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: GoogleCalendarSyncActionResult
  onSyncNow: () => Promise<GoogleCalendarSyncActionResult>
  onSetDisabled: (disabled: boolean) => Promise<GoogleCalendarSyncActionResult>
}

const NOT_CONFIGURED_RUNBOOK: readonly string[] = [
  'Crie o calendário "Agenda da Campanha" na conta Google da campanha.',
  'No Google, compartilhe o calendário como público (qualquer pessoa com o link pode ver).',
  'Dê permissão de edição ("fazer alterações em eventos") à service account do Teqo.',
  'Um administrador configura o ID do calendário no Painel e a chave da service account nas variáveis de ambiente.',
]

const copyIcon = <CopyIcon className="h-4 w-4" />

/**
 * C114 — Google Calendar mirror dialog (estados da jornada do canvas:
 * não configurado / sincronizado / pausado / desativado). Bottom sheet on
 * mobile, dialog on desktop — same chrome as the iCal feed dialog (C94).
 */
export const GoogleCalendarSyncDialog = ({
  open,
  onOpenChange,
  state,
  onSyncNow,
  onSetDisabled,
}: GoogleCalendarSyncDialogProps) => {
  const isMobile = useIsMobile()
  const [isBusy, setIsBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const resetTransientState = () => {
    setCopied(false)
    setActionError(null)
  }

  const handleCopy = async () => {
    if (!state.addLink) return
    await navigator.clipboard.writeText(state.addLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSyncNow = async () => {
    if (isBusy) return
    setIsBusy(true)
    setActionError(null)
    try {
      const result = await onSyncNow()
      if (!result.ok) setActionError(result.message ?? 'Não foi possível sincronizar.')
    } finally {
      setIsBusy(false)
    }
  }

  const handleSetDisabled = async (disabled: boolean) => {
    if (isBusy) return
    setIsBusy(true)
    setActionError(null)
    try {
      const result = await onSetDisabled(disabled)
      if (!result.ok) setActionError(result.message ?? 'Não foi possível atualizar.')
    } finally {
      setIsBusy(false)
    }
  }

  const linkBlock = state.addLink ? (
    <div className="space-y-2">
      <label className="text-sm font-medium" htmlFor="google-calendar-link">
        Link do calendário (copie e envie à equipe)
      </label>
      <div className="flex gap-2">
        <Input
          id="google-calendar-link"
          value={state.addLink}
          readOnly
          className="font-mono text-xs"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label="Copiar link"
        >
          {copyIcon}
        </Button>
      </div>
      {copied && (
        <p className="text-xs text-green-600" aria-live="polite">
          Link copiado!
        </p>
      )}
      <p className="text-xs text-muted-foreground">
        Quem segue o calendário recebe aviso conforme as próprias configurações do Google.
      </p>
    </div>
  ) : null

  const instructions = (
    <div className="rounded-lg bg-muted p-4 text-sm">
      <p className="mb-2 font-medium">Como adicionar ao Google Calendar:</p>
      <ol className="list-inside list-decimal space-y-1 text-muted-foreground">
        <li>Abra o Google Calendar no computador</li>
        <li>
          No menu lateral, clique em {'"'}
          {'+'}
          {'"'} ao lado de {'"'}Outras agendas{'"'}
        </li>
        <li>
          Selecione {'"'}Por URL{'"'}
        </li>
        <li>
          Cole o link acima e clique em {'"'}Adicionar agenda{'"'}
        </li>
      </ol>
      <p className="mt-2 text-muted-foreground">
        Apple Calendar e Outlook assinam a URL iCal pública do mesmo calendário.
      </p>
    </div>
  )

  const reverseEditBlock = (
    <div className="rounded-lg bg-muted p-4 text-sm">
      <p className="mb-1 font-medium">Edições pelo Google</p>
      <p className="text-muted-foreground">
        Quem tem permissão de edição no calendário pode remarcar, renomear ou cancelar o compromisso
        direto no Google — a mudança volta para a atividade do Teqo automaticamente e fica
        registrada nas atualizações. Título e horário seguem editáveis por lá; os demais campos só
        mudam pelo Teqo.
      </p>
      {state.pushChannelExpiresAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Notificações ativas até {formatBahiaDateTimeLabel(state.pushChannelExpiresAt)} — renovadas
          automaticamente.
        </p>
      ) : null}
      {state.pushChannelError ? (
        <p className="mt-2 text-xs text-amber-700">
          Notificações de mudanças feitas no Google indisponíveis: {state.pushChannelError}. O Teqo
          continua detectando as mudanças ao sincronizar.
        </p>
      ) : null}
    </div>
  )

  const syncButton = (
    <Button type="button" onClick={handleSyncNow} disabled={isBusy}>
      <RefreshCwIcon className={`mr-2 h-4 w-4 ${isBusy ? 'animate-spin' : ''}`} />
      {isBusy ? 'Sincronizando...' : 'Sincronizar agora'}
    </Button>
  )

  let body: React.ReactNode

  if (state.status === 'not-configured') {
    body = (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          <p className="mb-2 font-medium text-amber-900">Ainda não configurado</p>
          <p className="text-amber-800">
            O Teqo segue 100% funcional — a agenda do Teqo nunca depende do Google. Para ativar o
            espelho, um administrador precisa concluir a configuração:
          </p>
          <ol className="mt-2 list-inside list-decimal space-y-1 text-amber-800">
            {NOT_CONFIGURED_RUNBOOK.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
      </div>
    )
  } else if (state.status === 'disabled') {
    body = (
      <div className="space-y-4">
        <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
          A sincronização está desativada. A agenda do Teqo continua funcionando normalmente; nada é
          enviado ao Google enquanto estiver desativada.
        </div>
        {actionError && <p className="text-sm text-red-600">{actionError}</p>}
        <div className="flex justify-end">
          <Button type="button" onClick={() => void handleSetDisabled(false)} disabled={isBusy}>
            Reativar
          </Button>
        </div>
      </div>
    )
  } else {
    const paused = state.status === 'paused'
    body = (
      <div className="space-y-4">
        {paused ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="mb-1 font-medium text-amber-900">Pausado — re-tentando</p>
            <p className="text-amber-800">
              A última tentativa de sincronização falhou. O Teqo continua funcionando; o espelho é
              tentado de novo automaticamente ao salvar uma atividade ou ao abrir esta página.
            </p>
            {state.lastErrorAt ? (
              <p className="mt-2 text-xs text-amber-700">
                Última tentativa: {formatBahiaDateTimeLabel(state.lastErrorAt)} —{' '}
                {state.lastError ?? 'erro desconhecido'}
              </p>
            ) : null}
          </div>
        ) : (
          <p className="rounded-lg bg-green-50 p-3 text-sm text-green-800">
            Sincronizado — as mudanças da agenda já refletiram no Google.
            {state.lastSuccessAt
              ? ` Última sincronização: ${formatBahiaDateTimeLabel(state.lastSuccessAt)}.`
              : ''}
          </p>
        )}

        {linkBlock}
        {instructions}
        {reverseEditBlock}

        {actionError && <p className="text-sm text-red-600">{actionError}</p>}

        <div className="flex justify-end gap-2">
          {paused ? (
            <Button asChild variant="outline">
              <a
                href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                Abrir Google Calendar
              </a>
            </Button>
          ) : null}
          {syncButton}
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleSetDisabled(true)}
            disabled={isBusy}
          >
            Desativar
          </Button>
        </div>
      </div>
    )
  }

  const description =
    'Compromissos do Teqo refletem no calendário Google compartilhado em minutos, e edições feitas nele voltam para o Teqo. Quem segue recebe aviso conforme as próprias configurações.'

  const handleOpenChange = (next: boolean) => {
    if (!next) resetTransientState()
    onOpenChange(next)
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Agenda da Campanha no Google</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-2">{body}</div>
          <DrawerFooter className="border-t">
            <DrawerCloseButton className="w-full">Fechar</DrawerCloseButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agenda da Campanha no Google</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  )
}
