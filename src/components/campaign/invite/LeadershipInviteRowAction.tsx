'use client'

import { UserPlusIcon } from 'lucide-react'
import { useState, useTransition } from 'react'

import { createCampaignInvite } from '@/app/(campaign)/campanha/actions/invite'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover'
import { Spinner } from '@/components/ui/Spinner'
import { mapCreateCampaignInviteError } from '@/lib/campaignInviteClient'

type LeadershipInviteRowActionProps = {
  leadershipID: number
  name: string
  hasValidPhone: boolean
}

export const LeadershipInviteRowAction = ({
  leadershipID,
  name,
  hasValidPhone,
}: LeadershipInviteRowActionProps) => {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ whatsappUrl: string; inviteUrl: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const inviteAriaLabel = hasValidPhone
    ? `Convidar ${name} para completar cadastro por WhatsApp`
    : `Sem celular cadastrado — ${name}`

  const resetPopoverState = () => {
    setResult(null)
    setError(null)
    setCopied(false)
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      resetPopoverState()
    }
  }

  const generate = () => {
    resetPopoverState()
    startTransition(async () => {
      try {
        const invite = await createCampaignInvite({
          leadership: leadershipID,
          kind: 'autopreenchimento',
        })
        setResult(invite)
      } catch (cause) {
        setError(mapCreateCampaignInviteError(cause))
      }
    })
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          disabled={!hasValidPhone}
          aria-label={inviteAriaLabel}
          aria-expanded={open}
          aria-haspopup="dialog"
        >
          <UserPlusIcon className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium">Convidar por WhatsApp</p>
          <p className="text-sm text-muted-foreground">
            Gera um link de uso único (7 dias) para {name} completar o cadastro.
          </p>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {result ? (
            <Alert>
              <AlertDescription className="flex flex-col gap-2">
                <span>
                  Convite para completar cadastro gerado. O link é de uso único e expira em 7 dias.
                </span>
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
          ) : (
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={isPending}
              onClick={generate}
            >
              {isPending ? <Spinner data-icon="inline-start" aria-hidden="true" /> : null}
              Gerar convite
            </Button>
          )}
          <p className="sr-only" aria-live="polite">
            {isPending ? 'Gerando convite…' : null}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
