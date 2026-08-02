import config from '@payload-config'
import { ArrowLeftIcon, CalendarDaysIcon, HandshakeIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { ActivityStatusBadge } from '@/components/campaign/activity/ActivityStatusBadge'
import { OrganizationForm } from '@/components/campaign/organization/OrganizationForm'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadMunicipalityOptions } from '@/utilities/campaignRelationOptions'
import { loadOrganizationDetail } from '@/utilities/organizationData'
import { updateOrganizationFormAction } from './formActions'

export const metadata = campaignPageMetadataFromCatalog('organizacoes')

type OrganizationDetailPageProps = {
  params: Promise<{ slug: string }>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

export default async function OrganizationDetailPage({ params }: OrganizationDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const organization = await loadOrganizationDetail(payload, user, slug)
  if (!organization) notFound()

  const municipalityOptions = await loadMunicipalityOptions(payload, user)

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/organizacoes">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para organizações
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{organization.name}</h1>
          <Badge variant="secondary">{organizationKindLabels[organization.kind]}</Badge>
        </div>
        {organization.municipalityNames.length ? (
          <p className="text-muted-foreground">
            Atua em {organization.municipalityNames.join(', ')}
          </p>
        ) : null}
        {organization.notes ? (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{organization.notes}</p>
        ) : null}
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-labelledby="organization-leaderships-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <HandshakeIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="organization-leaderships-title" className="text-base font-medium">
              Lideranças associadas
            </h2>
            <Badge variant="outline">{organization.leaderships.length}</Badge>
          </div>
          {organization.leaderships.length ? (
            <ul className="flex flex-col gap-1">
              {organization.leaderships.map((leadership) => (
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

        <section
          aria-labelledby="organization-activities-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="organization-activities-title" className="text-base font-medium">
              Atividades apoiadas
            </h2>
            <Badge variant="outline">{organization.activities.length}</Badge>
          </div>
          {organization.activities.length ? (
            <ul className="flex flex-col gap-2">
              {organization.activities.map((activity) => (
                <li key={activity.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/campanha/atividades/${activity.slug}`}
                        className="truncate font-medium text-primary underline-offset-4 hover:underline"
                      >
                        {activity.title}
                      </Link>
                      <ActivityStatusBadge status={activity.status} />
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {activity.startAt
                        ? dateFormatter.format(new Date(activity.startAt))
                        : 'Sem data definida'}
                      {activity.deputyPresent ? ' · Deputado presente' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade vinculada a esta organização ainda.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="organization-edit-title" className="flex flex-col gap-3">
        <h2 id="organization-edit-title" className="text-base font-medium">
          Editar organização
        </h2>
        <OrganizationForm
          municipalityOptions={municipalityOptions}
          formAction={updateOrganizationFormAction}
          initial={{
            id: organization.id,
            kind: organization.kind,
            notes: organization.notes,
            municipalityIDs: organization.municipalityIDs,
          }}
        />
      </section>
    </CampaignPageShell>
  )
}
