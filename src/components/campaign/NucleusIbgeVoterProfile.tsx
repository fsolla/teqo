'use client'

import { useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  appendIbgeVoterProfileFormAction,
  type AppendIbgeVoterProfileFormState,
} from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/nucleusIbgeVoterProfileFormActions'
import { NucleusVoterProfileCardBody } from '@/components/campaign/NucleusVoterProfileCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ComputedVoterProfileViewModel } from '@/utilities/nucleusIbgeVoterProfile'

type NucleusIbgeVoterProfileProps = {
  canCopyToManual: boolean
  hasManualProfileWithSameLabel: boolean
  nucleusId: number
  profile: ComputedVoterProfileViewModel
}

const FormFeedback = ({ state }: { state: AppendIbgeVoterProfileFormState }) => {
  if (!state.message || state.status === 'success') return null

  return (
    <Alert variant="destructive" aria-live="polite">
      <AlertTitle>Não foi possível adicionar o perfil</AlertTitle>
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  )
}

export const NucleusIbgeVoterProfile = ({
  canCopyToManual,
  hasManualProfileWithSameLabel,
  nucleusId,
  profile,
}: NucleusIbgeVoterProfileProps) => {
  const router = useRouter()
  const [state, formAction, pending] = useActionState<
    AppendIbgeVoterProfileFormState,
    FormData
  >(appendIbgeVoterProfileFormAction, {})
  const displayState = state.status === 'success' ? {} : state

  useEffect(() => {
    if (state.status !== 'success' || !state.message) return
    toast.success(state.message)
    router.refresh()
  }, [router, state.message, state.status])

  return (
    <Card className="border-dashed">
      <CardHeader className="gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>{profile.label}</CardTitle>
          <Badge variant="secondary">Calculado (IBGE Censo 2022)</Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p>{profile.localTraits}</p>
        <NucleusVoterProfileCardBody profile={{ ageRange: profile.ageRange }} />
        <p className="text-muted-foreground">{profile.notes}</p>
        {canCopyToManual ? (
          <form action={formAction} className="pt-1">
            <input name="nucleus" type="hidden" value={String(nucleusId)} />
            <Button
              disabled={pending || hasManualProfileWithSameLabel}
              size="sm"
              type="submit"
              variant="outline"
            >
              {hasManualProfileWithSameLabel
                ? 'Já adicionado como perfil manual'
                : pending
                  ? 'Adicionando…'
                  : 'Usar como perfil manual'}
            </Button>
          </form>
        ) : null}
        <FormFeedback state={displayState} />
      </CardContent>
    </Card>
  )
}
