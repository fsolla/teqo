import config from '@payload-config'
import { ArrowLeftIcon, HandshakeIcon, MapPinIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyForm } from '@/components/campaign/stateDeputy/StateDeputyForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadStateDeputyDetail } from '@/utilities/stateDeputyData'
import { updateStateDeputyFormAction } from './formActions'

type StateDeputyDetailPageProps = {
  params: Promise<{ slug: string }>
}

export default async function StateDeputyDetailPage({ params }: StateDeputyDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const stateDeputy = await loadStateDeputyDetail(payload, user, slug)
  if (!stateDeputy) notFound()

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/dobradinhas">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para dobradinhas
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{stateDeputy.name}</h1>
          {stateDeputy.party ? <Badge variant="secondary">{stateDeputy.party}</Badge> : null}
        </div>
        {stateDeputy.notes ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{stateDeputy.notes}</p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="state-deputy-municipalities-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <MapPinIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="state-deputy-municipalities-title" className="text-base font-medium">
              Municípios vinculados
            </h2>
            <Badge variant="outline">{stateDeputy.municipalities.length}</Badge>
          </div>
          {stateDeputy.municipalities.length ? (
            <ul className="flex flex-col gap-1">
              {stateDeputy.municipalities.map((municipality) => (
                <li key={municipality.id}>
                  <Link
                    href={`/campanha/municipios/${municipality.slug}`}
                    className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                  >
                    {municipality.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum município vinculado. Vincule pela ficha do município.
            </p>
          )}
        </section>

        <section
          aria-labelledby="state-deputy-leaderships-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <HandshakeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="state-deputy-leaderships-title" className="text-base font-medium">
              Lideranças associadas
            </h2>
            <Badge variant="outline">{stateDeputy.leaderships.length}</Badge>
          </div>
          {stateDeputy.leaderships.length ? (
            <ul className="flex flex-col gap-1">
              {stateDeputy.leaderships.map((leadership) => (
                <li key={leadership.id}>
                  <Link
                    href={`/campanha/liderancas/${leadership.id}`}
                    className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline"
                  >
                    {leadership.name}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma liderança vinculada. Vincule pela ficha da liderança.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="state-deputy-edit-title" className="flex flex-col gap-3">
        <h2 id="state-deputy-edit-title" className="text-base font-medium">
          Editar dobradinha
        </h2>
        <StateDeputyForm
          formAction={updateStateDeputyFormAction}
          initial={{
            id: stateDeputy.id,
            party: stateDeputy.party,
            notes: stateDeputy.notes,
          }}
        />
      </section>
    </CampaignPageShell>
  )
}
