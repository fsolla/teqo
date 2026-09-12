'use client'

import { useState } from 'react'

import { CopyIcon, ExternalLinkIcon, RefreshCwIcon } from 'lucide-react'

import type {
  GoogleCalendarOAuthStartResult,
  GoogleCalendarSyncActionResult,
} from '@/app/(campaign)/campanha/actions/googleCalendarSync'
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
import type { GoogleCalendarConnectionStatus } from '@/utilities/googleCalendarSync'

type GoogleCalendarSyncDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  state: GoogleCalendarSyncActionResult
  onSyncNow: () => Promise<GoogleCalendarSyncActionResult>
  onSetDisabled: (disabled: boolean) => Promise<GoogleCalendarSyncActionResult>
  /** C149 — starts the OAuth handshake; the caller navigates to the returned URL. */
  onStartOAuth: () => Promise<GoogleCalendarOAuthStartResult>
  /** C149 — drops the OAuth connection from the Teqo. */
  onDisconnect: () => Promise<GoogleCalendarSyncActionResult>
}

const NOT_CONFIGURED_RUNBOOK: readonly string[] = [
  'Crie o calendário "Agenda da Campanha" na conta Google da campanha.',
  'No Google, compartilhe o calendário como público (qualquer pessoa com o link pode ver).',
  'Dê permissão de edição ("fazer alterações em eventos") à service account do Teqo.',
  'Um administrador configura o ID do calendário no Painel e a chave da service account nas variáveis de ambiente.',
]

const CONNECTION_BADGE: Record<
  GoogleCalendarConnectionStatus,
  { label: string; className: string }
> = {
  connected: {
    label: 'Conectado',
    className: 'border-green-300 bg-green-50 text-green-700',
  },
  error: {
    label: 'Erro',
    className: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  'not-configured': {
    label: 'Não configurado',
    className: 'border-border text-muted-foreground',
  },
}

const copyIcon = <CopyIcon className="h-4 w-4" />

/**
 * C114/C115/C149 — Google Calendar mirror dialog. The OAuth connection card
 * (C149) leads every state: `não configurado` offers the one-click connect
 * (or the admin runbook when the server has no OAuth client), `conectado`
 * offers reconnect/disconnect and `erro` offers the reconnect path. The
 * mirror-state blocks (C114/C115) stay below, untouched. Bottom sheet on
 * mobile, dialog on desktop — same chrome as the iCal feed dialog (C94).
 */
export const GoogleCalendarSyncDialog = ({
  open,
  onOpenChange,
  state,
  onSyncNow,
  onSetDisabled,
  onStartOAuth,
  onDisconnect,
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

  /**
   * Shared busy/error envelope: every card action maps a failed result to the
   * same `actionError` line and never leaves the buttons stuck in busy.
   */
  const runAction = async <T extends { ok: boolean; message?: string }>(
    run: () => Promise<T>,
    fallbackMessage: string,
  ): Promise<T | null> => {
    if (isBusy) return null
    setIsBusy(true)
    setActionError(null)
    try {
      const result = await run()
      if (!result.ok) setActionError(result.message ?? fallbackMessage)
      return result
    } finally {
      setIsBusy(false)
    }
  }

  const handleSyncNow = () => runAction(onSyncNow, 'Não foi possível sincronizar.')

  const handleSetDisabled = (disabled: boolean) =>
    runAction(() => onSetDisabled(disabled), 'Não foi possível atualizar.')

  const handleStartOAuth = async () => {
    const result = await runAction(onStartOAuth, 'Não foi possível iniciar a conexão.')
    if (result?.ok) window.location.assign(result.authorizeUrl)
  }

  const handleDisconnect = () => runAction(onDisconnect, 'Não foi possível desconectar.')

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
          automaticamente a cada sincronização.
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

  const connectionActions = state.canManageConnection ? (
    <div className="flex flex-wrap items-center gap-2">
      {state.connection === 'connected' ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleStartOAuth()}
          disabled={isBusy}
        >
          Reconectar com o Google
        </Button>
      ) : (
        <Button
          type="button"
          onClick={() => void handleStartOAuth()}
          disabled={isBusy || !state.oauthAvailable}
        >
          <ExternalLinkIcon className="mr-2 h-4 w-4" />
          {state.connection === 'error' ? 'Reconectar com o Google' : 'Conectar com o Google'}
        </Button>
      )}
      {state.connection !== 'not-configured' ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void handleDisconnect()}
          disabled={isBusy}
        >
          Desconectar
        </Button>
      ) : null}
    </div>
  ) : (
    <p className="text-xs text-muted-foreground">
      Somente candidato ou coordenação pode conectar ou desconectar a conta Google da campanha.
    </p>
  )

  const oauthUnavailableBlock =
    state.connection === 'not-configured' && !state.oauthAvailable ? (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
        <p className="mb-2 font-medium text-amber-900">Ainda não configurado</p>
        <p className="text-amber-800">
          O Teqo segue 100% funcional — a agenda do Teqo nunca depende do Google. Um administrador
          pode concluir a configuração manual:
        </p>
        <ol className="mt-2 list-inside list-decimal space-y-1 text-amber-800">
          {NOT_CONFIGURED_RUNBOOK.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </div>
    ) : null

  const connectionBlock = (
    <div className="rounded-lg border border-border p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">Google Calendar</h3>
          {state.connection === 'not-configured' ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Conecte a conta Google do calendário da campanha para gerenciar o espelho por ela.
              {state.status !== 'not-configured'
                ? ' O espelho segue ativo pela configuração manual (service account).'
                : ''}
            </p>
          ) : state.connection === 'connected' ? (
            <p className="mt-1 text-sm text-muted-foreground">
              O espelho usa a conta Google conectada para escrever os compromissos no calendário da
              campanha.
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              A conexão com o Google precisa ser refeita.
            </p>
          )}
        </div>
        <span
          className={`self-start rounded-full border px-3 py-1 text-xs font-medium ${CONNECTION_BADGE[state.connection].className}`}
        >
          {CONNECTION_BADGE[state.connection].label}
        </span>
      </div>

      {state.connection === 'not-configured' ? (
        <div className="mt-4 space-y-3">
          {oauthUnavailableBlock ?? (
            <div className="rounded-md border border-dashed border-border p-4">
              <p className="text-sm text-muted-foreground">
                Você será levado à tela de consentimento do Google para autorizar o Teqo a gerenciar
                o calendário da campanha.
              </p>
              <div className="mt-3">{connectionActions}</div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            A configuração manual por service account continua disponível como fallback técnico.
          </p>
        </div>
      ) : null}

      {state.connection === 'connected' ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm text-muted-foreground">
            {state.oauthConnectedAt
              ? `Conta Google conectada em ${formatBahiaDateTimeLabel(state.oauthConnectedAt)}.`
              : 'Conta Google conectada.'}
          </p>
          {connectionActions}
          <p className="text-xs text-muted-foreground">
            Desconectar revoga o acesso do Teqo; depois, revogue o app nas configurações de
            segurança da conta Google.
          </p>
        </div>
      ) : null}

      {state.connection === 'error' ? (
        <div className="mt-4 space-y-3">
          <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
            <p className="font-medium text-amber-900">Erro de conexão com o Google</p>
            <p className="mt-1 text-amber-800">
              {state.oauthError ??
                'Não foi possível renovar o acesso. O Teqo continua sendo a fonte da verdade — nada foi perdido.'}
            </p>
            <p className="mt-2 text-xs text-amber-700">
              Reconecte com a mesma conta Google do calendário da campanha. Se a conta mudou,
              desconecte antes e conecte novamente.
            </p>
          </div>
          {connectionActions}
        </div>
      ) : null}
    </div>
  )

  let content: React.ReactNode
  let actions: React.ReactNode = null

  if (state.status === 'not-configured') {
    content =
      state.connection === 'connected' ? (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          A conexão está ativa. O calendário da campanha é escolhido na configuração do Painel.
        </p>
      ) : null
  } else if (state.status === 'disabled') {
    content = (
      <div className="rounded-lg bg-muted p-4 text-sm text-muted-foreground">
        A sincronização está desativada. A agenda do Teqo continua funcionando normalmente; nada é
        enviado ao Google enquanto estiver desativada.
      </div>
    )
    actions = (
      <div className="flex justify-end">
        <Button type="button" onClick={() => void handleSetDisabled(false)} disabled={isBusy}>
          Reativar
        </Button>
      </div>
    )
  } else {
    const paused = state.status === 'paused'
    content = (
      <>
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
      </>
    )
    actions = (
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
    )
  }

  const errorNotice = actionError ? (
    <p role="alert" className="text-sm text-red-600">
      {actionError}
    </p>
  ) : null

  // C149 — the connection card leads every state; the mirror blocks stay below.
  const body = (
    <>
      {connectionBlock}
      {content}
    </>
  )

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
          <div className="overflow-y-auto px-4 pb-2">
            <div className="space-y-4">
              {body}
              {errorNotice}
              {actions}
            </div>
          </div>
          <DrawerFooter className="border-t">
            <DrawerCloseButton className="w-full">Fechar</DrawerCloseButton>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-xl sm:p-0">
        <DialogHeader className="shrink-0 border-b px-6 py-4 pr-12 text-left">
          <DialogTitle>Agenda da Campanha no Google</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div
          data-slot="dialog-scroll-body"
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4"
        >
          <div className="space-y-4">{body}</div>
        </div>
        {errorNotice || actions ? (
          <div data-slot="dialog-footer" className="shrink-0 space-y-3 border-t px-6 py-4">
            {errorNotice}
            {actions}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
