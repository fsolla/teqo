import config from '@payload-config'
import { getPayload } from 'payload'
import { redirect } from 'next/navigation'

import { createNucleusFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/formActions'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { NucleusForm } from '@/components/campaign/NucleusForm'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getEligibleNucleusCoordinatorOptions } from '@/utilities/nucleusCoordinatorOptions'

export default async function NewNucleusPage() {
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])

  if (!user) redirect('/campanha/login')
  if (user.role !== 'geral') redirect('/campanha/nucleos')

  const coordinators = await getEligibleNucleusCoordinatorOptions(payload, user)

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <CampaignScopeBadge>Criação · Coordenação geral</CampaignScopeBadge>
        <p className="text-sm font-medium text-primary">Núcleos Eleitorais</p>
        <h1 className="text-2xl font-bold tracking-tight">Novo núcleo</h1>
        <p className="text-muted-foreground">
          Defina a operação, o território obrigatório e quem responde por ele.
        </p>
      </header>
      <NucleusForm
        action={createNucleusFormAction}
        coordinators={coordinators}
        submitLabel="Criar núcleo"
      />
    </div>
  )
}
