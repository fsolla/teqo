import config from '@payload-config'
import { ArrowLeftIcon, CalendarDaysIcon, HandshakeIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { CampaignPageShell } from '@/components/campaign/CampaignPageShell'
import { OrganizationForm } from '@/components/campaign/OrganizationForm'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { actionPlanStatusLabels, actionPlanStatuses } from '@/lib/schemas/actionPlan'
import { organizationKindLabels } from '@/lib/schemas/organization'
import { isCampaignStaff } from '@/utilities/campaignAccess'
import { getCampaignUser } from '@/utilities/campaignAuth'
import { loadPlazaOptions } from '@/utilities/campaignRelationOptions'
import { loadOrganizationDetail } from '@/utilities/organizationData'
import { updateOrganizationFormAction } from './formActions'

type OrganizationDetailPageProps = {
  params: Promise<{ slug: string }>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' })

const statusLabel = (status: string): string =>
  actionPlanStatuses.includes(status as (typeof actionPlanStatuses)[number])
    ? actionPlanStatusLabels[status as (typeof actionPlanStatuses)[number]]
    : status

export default async function OrganizationDetailPage({ params }: OrganizationDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([getCampaignUser(), getPayload({ config })])
  if (!user) redirect('/campanha/login')
  if (!isCampaignStaff(user)) redirect('/campanha')

  const organization = await loadOrganizationDetail(payload, user, slug)
  if (!organization) notFound()

  const plazaOptions = await loadPlazaOptions(payload, user)

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
        {organization.plazaNames.length ? (
          <p className="text-muted-foreground">Atua em {organization.plazaNames.join(', ')}</p>
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
          aria-labelledby="organization-plans-title"
          className="flex flex-col gap-3 rounded-xl border p-4"
        >
          <div className="flex items-center gap-2">
            <CalendarDaysIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="organization-plans-title" className="text-base font-medium">
              Planos de Ação apoiados
            </h2>
            <Badge variant="outline">{organization.actionPlans.length}</Badge>
          </div>
          {organization.actionPlans.length ? (
            <ul className="flex flex-col gap-2">
              {organization.actionPlans.map((plan) => (
                <li key={plan.id} className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-col">
                    <Link
                      href={`/campanha/planos/${plan.slug}`}
                      className="truncate font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {plan.title}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {statusLabel(plan.status)}
                      {plan.startAt ? ` · ${dateFormatter.format(new Date(plan.startAt))}` : ''}
                      {plan.deputyPresent ? ' · Deputado presente' : ''}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              Nenhum Plano de Ação vinculado a esta organização ainda.
            </p>
          )}
        </section>
      </div>

      <section aria-labelledby="organization-edit-title" className="flex flex-col gap-3">
        <h2 id="organization-edit-title" className="text-base font-medium">
          Editar organização
        </h2>
        <OrganizationForm
          plazaOptions={plazaOptions}
          formAction={updateOrganizationFormAction}
          initial={{
            id: organization.id,
            kind: organization.kind,
            notes: organization.notes,
            plazaIDs: organization.plazaIDs,
          }}
        />
      </section>
    </CampaignPageShell>
  )
}
