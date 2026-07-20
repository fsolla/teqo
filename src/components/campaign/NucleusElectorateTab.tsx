import { NucleusIbgeVoterProfile } from '@/components/campaign/NucleusIbgeVoterProfile'
import { NucleusManualVoterProfileCard } from '@/components/campaign/NucleusVoterProfileCard'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/Empty'
import {
  getNucleusIbgeVoterProfile,
  IBGE_VOTER_PROFILE_LABEL,
} from '@/utilities/nucleusIbgeVoterProfile'
import type { StaffNucleusTabsViewModel } from '@/utilities/nucleusViewModels'

type NucleusElectorateTabProps = {
  canEditIntelligence: boolean
  nucleus: StaffNucleusTabsViewModel
  nucleusId: number
}

export const NucleusElectorateTab = ({
  canEditIntelligence,
  nucleus,
  nucleusId,
}: NucleusElectorateTabProps) => {
  const computed = getNucleusIbgeVoterProfile({
    cities: nucleus.cities,
    regions: nucleus.regions,
  })
  const hasManualProfiles = nucleus.voterProfiles.length > 0
  const hasIbgeProfile = computed.status === 'available'
  const hasManualProfileWithSameLabel = nucleus.voterProfiles.some(
    (profile) => profile.label === IBGE_VOTER_PROFILE_LABEL,
  )

  if (!hasIbgeProfile && !hasManualProfiles) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyTitle>Nenhum perfil do eleitorado disponível</EmptyTitle>
          <EmptyDescription>
            Cadastre o território do núcleo para ver o perfil médio do IBGE ou adicione perfis
            manuais pela inteligência do núcleo.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {hasIbgeProfile ? (
        <NucleusIbgeVoterProfile
          canCopyToManual={canEditIntelligence}
          hasManualProfileWithSameLabel={hasManualProfileWithSameLabel}
          nucleusId={nucleusId}
          profile={computed.profile}
        />
      ) : null}
      {hasManualProfiles ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {nucleus.voterProfiles.map((profile) => (
            <NucleusManualVoterProfileCard key={profile.label} profile={profile} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Nenhum perfil manual cadastrado. Use o botão acima para copiar o perfil IBGE ou edite pela
          inteligência do núcleo.
        </p>
      )}
    </div>
  )
}
