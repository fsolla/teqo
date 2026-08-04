import config from '@payload-config'
import { HandshakeIcon, MapPinIcon, UserCogIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { StateDeputyAdvisorRelationCell } from '@/components/campaign/stateDeputy/StateDeputyAdvisorRelationCell'
import { StateDeputyForm } from '@/components/campaign/stateDeputy/StateDeputyForm'
import { Badge } from '@/components/ui/Badge'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { isCampaignUnrestricted } from '@/utilities/campaignAccess'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadEligibleAdvisorOptions } from '@/utilities/campaignRelationOptions'
import { loadStateDeputyDetail } from '@/utilities/stateDeputyData'
import {
  setStateDeputyAdvisorMembershipFormAction,
  updateStateDeputyFormAction,
} from './formActions'

export async function generateMetadata({ params }: StateDeputyDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const stateDeputy = await loadStateDeputyDetail(payload, user, slug)
  if (!stateDeputy) return campaignPageMetadata({ title: 'Dobradinha' })

  return campaignPageMetadata(
    stateDeputy.party
      ? { title: stateDeputy.name, subtitle: stateDeputy.party }
      : { title: stateDeputy.name },
  )
}

type StateDeputyDetailPageProps = {
  params: Promise<{ slug: string }>
}

export default async function StateDeputyDetailPage({ params }: StateDeputyDetailPageProps) {
  const { slug } = await params
  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const stateDeputy = await loadStateDeputyDetail(payload, user, slug)
  if (!stateDeputy) notFound()

  // B156 — only coordinator/candidate assign advisors; the rest of staff reads.
  const canEditAdvisors = isCampaignUnrestricted(user)
  const advisorOptions = canEditAdvisors ? await loadEligibleAdvisorOptions(payload, user) : []

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome
        chrome={
          stateDeputy.party
            ? { title: stateDeputy.name, subtitle: stateDeputy.party }
            : { title: stateDeputy.name }
        }
      />
      {stateDeputy.notes ? (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">{stateDeputy.notes}</p>
      ) : null}

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

        <section
          aria-labelledby="state-deputy-advisors-title"
          className="flex flex-col gap-3 rounded-xl border p-4 lg:col-span-2"
        >
          <div className="flex items-center gap-2">
            <UserCogIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            <h2 id="state-deputy-advisors-title" className="text-base font-medium">
              Assessores responsáveis
            </h2>
            <Badge variant="outline">{stateDeputy.advisors.length}</Badge>
          </div>
          <StateDeputyAdvisorRelationCell
            stateDeputyId={stateDeputy.id}
            stateDeputyName={stateDeputy.name}
            advisors={stateDeputy.advisors}
            options={
              canEditAdvisors
                ? advisorOptions.map((option) => ({
                    id: option.id,
                    searchLabel: option.name,
                    item: {
                      id: option.id,
                      label: option.name,
                      href: `/campanha/assessores/${option.id}`,
                    },
                  }))
                : []
            }
            membershipAction={setStateDeputyAdvisorMembershipFormAction}
            readOnly={!canEditAdvisors}
            measureOverflow={false}
          />
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
