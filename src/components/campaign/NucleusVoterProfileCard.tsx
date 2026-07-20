import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type NucleusVoterProfileCardFields = {
  label: string
  ageRange?: string | null
  incomeBand?: string | null
  occupation?: string | null
  localTraits?: string | null
  notes?: string | null
}

export const NucleusVoterProfileCardBody = ({
  profile,
}: {
  profile: Pick<
    NucleusVoterProfileCardFields,
    'ageRange' | 'incomeBand' | 'occupation' | 'localTraits' | 'notes'
  >
}) => (
  <>
    {profile.ageRange ? <p>Faixa etária: {profile.ageRange}</p> : null}
    {profile.incomeBand ? <p>Renda: {profile.incomeBand}</p> : null}
    {profile.occupation ? <p>Ocupação: {profile.occupation}</p> : null}
    {profile.localTraits ? <p>{profile.localTraits}</p> : null}
    {profile.notes ? <p className="text-muted-foreground">{profile.notes}</p> : null}
  </>
)

export const NucleusManualVoterProfileCard = ({
  profile,
}: {
  profile: NucleusVoterProfileCardFields
}) => (
  <Card>
    <CardHeader>
      <CardTitle>{profile.label}</CardTitle>
    </CardHeader>
    <CardContent className="flex flex-col gap-2 text-sm">
      <NucleusVoterProfileCardBody profile={profile} />
    </CardContent>
  </Card>
)
