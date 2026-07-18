'use client'

import { useEffect, useState, useTransition } from 'react'
import { CheckIcon, CopyIcon, ExternalLinkIcon } from 'lucide-react'

import { createCampaignInvite } from '@/app/(campaign)/campanha/actions/invite'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Spinner } from '@/components/ui/Spinner'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/ToggleGroup'
import type { SupportStatus } from '@/components/campaign/SupportStatusBadge'
import type { CampaignInviteKind } from '@/utilities/campaignInvite'

type InviteResult = {
  inviteUrl: string
  whatsappUrl: string
}

export type CreateInviteAction = (input: {
  leadership: number
  kind: CampaignInviteKind
}) => Promise<InviteResult>

export const getLeadershipInviteAvailability = ({
  supportStatus,
  consentConfigured,
}: {
  supportStatus: SupportStatus
  consentConfigured: boolean
}) => ({
  canInvite: consentConfigured,
  canInviteLogin: consentConfigured && supportStatus === 'engajado',
})

export const LeadershipInviteDialog = ({
  leadershipId,
  supportStatus,
  consentConfigured,
  createInviteAction = createCampaignInvite,
  onPendingChange,
}: {
  leadershipId: number
  supportStatus: SupportStatus
  consentConfigured: boolean
  createInviteAction?: CreateInviteAction
  onPendingChange?: (pending: boolean) => void
}) => {
  const [kind, setKind] = useState<CampaignInviteKind>('autopreenchimento')
  const [result, setResult] = useState<InviteResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, startTransition] = useTransition()
  const availability = getLeadershipInviteAvailability({ supportStatus, consentConfigured })
  const loginDisabled = !availability.canInviteLogin

  useEffect(() => {
    onPendingChange?.(pending)
  }, [onPendingChange, pending])

  const resetResult = (nextKind: CampaignInviteKind) => {
    setKind(nextKind)
    setResult(null)
    setError(null)
    setCopied(false)
  }

  const generateInvite = () => {
    setError(null)
    setCopied(false)
    startTransition(async () => {
      try {
        const created = await createInviteAction({
          leadership: leadershipId,
          kind,
        })
        setResult(created)
      } catch {
        setError('Não foi possível criar o convite. Tente novamente.')
      }
    })
  }

  const copyWhatsAppLink = async () => {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result.whatsappUrl)
      setCopied(true)
    } catch {
      setError('Não foi possível copiar o link. Abra o WhatsApp e copie por lá.')
    }
  }

  const openWhatsApp = () => {
    if (!result) return
    window.open(result.whatsappUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <DialogContent
      showCloseButton={!pending}
      onEscapeKeyDown={(event) => {
        if (pending) event.preventDefault()
      }}
      onPointerDownOutside={(event) => {
        if (pending) event.preventDefault()
      }}
      onCloseAutoFocus={() => {
        if (!pending) {
          resetResult('autopreenchimento')
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Convidar pelo WhatsApp</DialogTitle>
        <DialogDescription>
          Escolha o tipo de convite. Você enviará a mensagem pelo seu próprio WhatsApp.
        </DialogDescription>
      </DialogHeader>

      <Field>
        <FieldLabel>Tipo de convite</FieldLabel>
        <ToggleGroup
          type="single"
          value={kind}
          onValueChange={(value) => {
            if (value === 'login' || value === 'autopreenchimento') resetResult(value)
          }}
          variant="outline"
          orientation="vertical"
          className="w-full items-stretch"
          aria-label="Tipo de convite"
        >
          <ToggleGroupItem value="autopreenchimento" className="justify-start">
            Completar cadastro
          </ToggleGroupItem>
          <ToggleGroupItem
            value="login"
            className="justify-start"
            disabled={loginDisabled}
            aria-describedby={loginDisabled ? 'campaign-invite-login-help' : undefined}
          >
            Criar ou recuperar acesso
          </ToggleGroupItem>
        </ToggleGroup>
        <FieldDescription id="campaign-invite-login-help">
          {loginDisabled
            ? 'O acesso ao app só pode ser convidado quando a liderança estiver engajada.'
            : 'Um convite de acesso também permite definir uma nova senha.'}
        </FieldDescription>
      </Field>

      {error ? (
        <Alert variant="destructive" aria-live="polite">
          <AlertTitle>Não foi possível continuar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? (
        <Alert aria-live="polite">
          <CheckIcon aria-hidden="true" />
          <AlertTitle>Convite pronto</AlertTitle>
          <AlertDescription>
            Abra o WhatsApp para revisar e enviar a mensagem. Criar outro convite deste tipo
            invalida este link.
          </AlertDescription>
        </Alert>
      ) : null}

      <DialogFooter>
        {result ? (
          <>
            <Button type="button" variant="outline" onClick={copyWhatsAppLink}>
              {copied ? (
                <CheckIcon data-icon="inline-start" aria-hidden="true" />
              ) : (
                <CopyIcon data-icon="inline-start" aria-hidden="true" />
              )}
              {copied ? 'Link copiado' : 'Copiar link'}
            </Button>
            <Button type="button" onClick={openWhatsApp}>
              <ExternalLinkIcon data-icon="inline-start" aria-hidden="true" />
              Abrir WhatsApp
            </Button>
          </>
        ) : (
          <Button type="button" onClick={generateInvite} disabled={pending}>
            {pending ? <Spinner data-icon="inline-start" /> : null}
            {pending ? 'Criando convite…' : 'Criar convite'}
          </Button>
        )}
      </DialogFooter>
    </DialogContent>
  )
}
