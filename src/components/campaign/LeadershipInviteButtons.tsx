'use client'

import { useState, useTransition } from 'react'

import { createCampaignInvite } from '@/app/(campaign)/campanha/actions/invite'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/Spinner'

type InviteKind = 'autopreenchimento' | 'login'

const kindLabels: Record<InviteKind, string> = {
  autopreenchimento: 'Convite para completar cadastro',
  login: 'Convite de acesso ao app',
}

type LeadershipInviteButtonsProps = {
  leadershipID: number
  canInviteLogin: boolean
}

export const LeadershipInviteButtons = ({
  leadershipID,
  canInviteLogin,
}: LeadershipInviteButtonsProps) => {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{
    kind: InviteKind
    whatsappUrl: string
    inviteUrl: string
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = (kind: InviteKind) => {
    setError(null)
    setResult(null)
    setCopied(false)
    startTransition(async () => {
      try {
        const invite = await createCampaignInvite({ leadership: leadershipID, kind })
        setResult({ kind, ...invite })
      } catch (cause) {
        setError(
          cause instanceof Error && cause.message === 'Consentimento ainda não configurado.'
            ? 'Consentimento ainda não configurado — peça a um admin para criar o texto de consentimento antes de convidar.'
            : 'Não foi possível gerar o convite. Verifique seu acesso e tente novamente.',
        )
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={isPending}
          onClick={() => generate('autopreenchimento')}
        >
          {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
          Convidar para completar cadastro
        </Button>
        {canInviteLogin ? (
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={isPending}
            onClick={() => generate('login')}
          >
            {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
            Convidar para o app
          </Button>
        ) : null}
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {result ? (
        <Alert>
          <AlertDescription className="flex flex-col gap-2">
            <span>{kindLabels[result.kind]} gerado. O link é de uso único e expira em 7 dias.</span>
            <span className="flex flex-wrap gap-2">
              <Button asChild className="min-h-11">
                <a href={result.whatsappUrl} target="_blank" rel="noopener noreferrer">
                  Enviar pelo WhatsApp
                </a>
              </Button>
              <Button
                type="button"
                variant="secondary"
                className="min-h-11"
                onClick={async () => {
                  await navigator.clipboard.writeText(result.inviteUrl)
                  setCopied(true)
                }}
              >
                {copied ? 'Link copiado' : 'Copiar link'}
              </Button>
            </span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  )
}
