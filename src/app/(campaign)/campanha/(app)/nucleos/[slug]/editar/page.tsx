import config from '@payload-config'
import { getPayload } from 'payload'
import { notFound, redirect } from 'next/navigation'

import { updateNucleusFormAction } from '@/app/(campaign)/campanha/(app)/nucleos/formActions'
import { CampaignScopeBadge } from '@/components/campaign/CampaignScopeBadge'
import { NucleusForm } from '@/components/campaign/NucleusForm'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { getNucleusEditPageData } from '@/utilities/nucleusPageData'

type EditNucleusPageProps = {
  params: Promise<{ slug: string }>
}

export default async function EditNucleusPage({ params }: EditNucleusPageProps) {
  const [{ slug }, user, payload] = await Promise.all([
    params,
    getCampaignUser(),
    getPayload({ config }),
  ])

  if (!user) redirect('/campanha/login')
  if (user.role === 'lideranca') redirect('/campanha/nucleos')

  if (!slug) notFound()
  const view = await getNucleusEditPageData(payload, user, slug).catch(() => notFound())

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <CampaignScopeBadge>
          {user.role === 'geral'
            ? 'Edição · Coordenação geral'
            : 'Edição · Núcleo sob sua coordenação'}
        </CampaignScopeBadge>
        <p className="text-sm font-medium text-primary">Núcleos Eleitorais</p>
        <h1 className="text-2xl font-bold tracking-tight">Editar {view.name}</h1>
        <p className="text-muted-foreground">
          Atualize o território sem alterar o nome ou as estimativas confirmadas.
        </p>
      </header>
      <NucleusForm
        action={updateNucleusFormAction}
        nucleus={view}
        submitLabel="Salvar alterações"
      />
    </div>
  )
}
