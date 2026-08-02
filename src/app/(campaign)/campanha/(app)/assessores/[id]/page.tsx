import config from '@payload-config'
import { ArrowLeftIcon, MapPinIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { AdvisorDebouncedTextCell } from '@/components/campaign/advisor/AdvisorDebouncedTextCell'
import { AdvisorPasswordResetButton } from '@/components/campaign/advisor/AdvisorPasswordResetButton'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { formatBrazilianPhoneInput } from '@/lib/phone'
import { isPlanilhaPlaceholderEmail } from '@/lib/schemas/advisor'
import { loadAdvisorDetail } from '@/utilities/advisorData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { sendAdvisorPasswordResetFormAction, updateAdvisorProfileFormAction } from '../formActions'

export const metadata = campaignPageMetadataFromCatalog('assessores')

type AdvisorDetailPageProps = {
  params: Promise<{ id: string }>
}

export default async function AdvisorDetailPage({ params }: AdvisorDetailPageProps) {
  const { id: rawId } = await params
  const advisorId = Number(rawId)
  if (!Number.isInteger(advisorId) || advisorId <= 0) notFound()

  const [, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'unrestricted' }),
    getPayload({ config }),
  ])

  const advisor = await loadAdvisorDetail(payload, advisorId)
  if (!advisor) notFound()

  const email = advisor.email && !isPlanilhaPlaceholderEmail(advisor.email) ? advisor.email : null

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="min-h-11 self-start">
          <Link href="/campanha/assessores">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para assessores
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{advisor.name}</h1>
        <p className="text-muted-foreground">
          E-mail e celular salvam sozinhos ao digitar. A carteira de municípios é editada no modo
          edição da lista.
        </p>
      </header>

      <section aria-labelledby="advisor-account-title" className="flex flex-col gap-2">
        <h2 id="advisor-account-title" className="text-base font-medium">
          Conta
        </h2>
        <div className="grid gap-2 sm:grid-cols-2">
          <AdvisorDebouncedTextCell
            advisorId={advisor.id}
            field="email"
            type="email"
            defaultValue={advisor.email ?? ''}
            placeholder="E-mail"
            ariaLabel={`E-mail de ${advisor.name}`}
            placeholderEmailFallback={advisor.email}
            formAction={updateAdvisorProfileFormAction}
          />
          <AdvisorDebouncedTextCell
            advisorId={advisor.id}
            field="phone"
            type="tel"
            defaultValue={advisor.phone ? formatBrazilianPhoneInput(advisor.phone) : ''}
            placeholder="Celular"
            ariaLabel={`Celular de ${advisor.name}`}
            formAction={updateAdvisorProfileFormAction}
          />
        </div>
      </section>

      <section
        aria-labelledby="advisor-municipalities-title"
        className="flex flex-col gap-3 rounded-xl border p-4"
      >
        <div className="flex items-center gap-2">
          <MapPinIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h2 id="advisor-municipalities-title" className="text-base font-medium">
            Municípios administrados
          </h2>
          <Badge variant="outline">{advisor.municipalities.length}</Badge>
        </div>
        {advisor.municipalities.length ? (
          <ul className="m-0 flex list-none flex-wrap gap-1.5 [&>li]:mt-0">
            {advisor.municipalities.map((municipality) => (
              <li key={municipality.id}>
                <Badge variant="secondary" asChild>
                  <Link
                    href={`/campanha/municipios/${municipality.slug}`}
                    className="underline-offset-4 hover:underline"
                  >
                    {municipality.name}
                  </Link>
                </Badge>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum município atribuído.</p>
        )}
      </section>

      <section aria-labelledby="advisor-password-title" className="flex flex-col gap-3">
        <h2 id="advisor-password-title" className="text-base font-medium">
          Acesso
        </h2>
        <AdvisorPasswordResetButton
          advisorId={advisor.id}
          disabled={!email}
          formAction={sendAdvisorPasswordResetFormAction}
        />
      </section>
    </CampaignPageShell>
  )
}
