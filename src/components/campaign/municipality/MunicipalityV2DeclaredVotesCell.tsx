'use client'

import {
  MUNICIPALITY_PLEDGE_DECLARED_VOTES_ENDPOINT,
  type MunicipalityPledgeDeclaredVotesResponse,
} from '@/app/(campaign)/campanha/(app)/municipios/pledge-declared-votes/types'
import { CampaignCellEditOverlay } from '@/components/campaign/shared/CampaignCellEditOverlay'
import { useCampaignCellAutosave } from '@/components/campaign/shared/useCampaignCellAutosave'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/Spinner'
import { formatElectionNumber } from '@/lib/electionFormat'

const AUTOSAVE_MS = 600
const SAVE_ERROR_MESSAGE =
  'Não foi possível salvar os votos declarados. Verifique seu acesso e tente novamente.'

type MunicipalityV2DeclaredVotesCellProps = {
  municipalityID: number
  leadershipID: number
  leadershipName: string
  declaredVotes: number | null
  variant: 'popover' | 'sheet'
}

const declaredVotesEqual = (left: number | null, right: number | null): boolean => left === right

export const MunicipalityV2DeclaredVotesCell = ({
  municipalityID,
  leadershipID,
  leadershipName,
  declaredVotes,
  variant,
}: MunicipalityV2DeclaredVotesCellProps) => {
  const { open, onOpenChange, value, change, isPending, errorMessage, statusMessage } =
    useCampaignCellAutosave<number | null, MunicipalityPledgeDeclaredVotesResponse>({
      value: declaredVotes,
      equals: declaredVotesEqual,
      endpoint: MUNICIPALITY_PLEDGE_DECLARED_VOTES_ENDPOINT,
      buildBody: (votes) => ({
        municipalityId: municipalityID,
        leadershipId: leadershipID,
        declaredVotes: votes ?? 0,
      }),
      readSaved: (payload) => payload.savedDeclaredVotes,
      errorMessage: SAVE_ERROR_MESSAGE,
      pendingMessage: 'Salvando votos declarados.',
    })

  const triggerLabel = [
    'Editar votos declarados de ',
    leadershipName,
    ' — ',
    value == null ? 'sem declaração' : formatElectionNumber(value),
  ].join('')

  const display =
    value == null ? (
      <span className="text-muted-foreground">—</span>
    ) : (
      <span className="font-medium tabular-nums">{formatElectionNumber(value)}</span>
    )

  const handleInputChange = (raw: string) => {
    if (raw.trim() === '') {
      change(null, AUTOSAVE_MS)
      return
    }
    const parsed = Number.parseInt(raw, 10)
    if (Number.isNaN(parsed)) return
    change(parsed, AUTOSAVE_MS)
  }

  return (
    <CampaignCellEditOverlay
      variant={variant}
      open={open}
      onOpenChange={onOpenChange}
      title="Editar votos declarados"
      description={leadershipName}
      triggerLabel={triggerLabel}
      triggerBusy={isPending}
      statusMessage={statusMessage}
      triggerClassName="group flex w-full items-center justify-end"
      align="end"
      contentClassName="w-48 p-3"
      preventPopoverAutoFocus
      trigger={display}
    >
      <div className="relative flex flex-col gap-2.5">
        {isPending ? (
          <Spinner
            className="absolute top-0 right-0 size-3.5 text-muted-foreground"
            aria-label="Salvando votos declarados"
          />
        ) : null}
        <Field>
          <FieldLabel htmlFor={`municipality-v2-declared-${leadershipID}`}>
            Votos declarados
          </FieldLabel>
          <Input
            id={`municipality-v2-declared-${leadershipID}`}
            type="number"
            min={0}
            max={1000000}
            inputMode="numeric"
            value={value ?? ''}
            onChange={(event) => handleInputChange(event.target.value)}
            className="min-h-11 tabular-nums"
          />
        </Field>
        {errorMessage ? (
          <Alert variant="destructive" className="py-2">
            <AlertDescription className="text-xs">{errorMessage}</AlertDescription>
          </Alert>
        ) : null}
      </div>
    </CampaignCellEditOverlay>
  )
}
