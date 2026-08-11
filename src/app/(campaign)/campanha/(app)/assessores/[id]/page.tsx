import config from '@payload-config'
import { MapPinIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { AdvisorDebouncedTextCell } from '@/components/campaign/advisor/AdvisorDebouncedTextCell'
import { AdvisorPasswordResetButton } from '@/components/campaign/advisor/AdvisorPasswordResetButton'
import { PhonesFieldEditor } from '@/components/campaign/shared/PhonesFieldEditor'
import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { Badge } from '@/components/ui/Badge'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { formatBrazilianPhoneInput } from '@/lib/phone'
import { isPlanilhaPlaceholderEmail } from '@/lib/schemas/advisor'
import { loadAdvisorDetail } from '@/utilities/advisorData'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  sendAdvisorPasswordResetFormAction,
  updateAdvisorContactFormAction,
  updateAdvisorProfileFormAction,
} from '../formActions'

export async function generateMetadata({ params }: AdvisorDetailPageProps) {
  const { id: rawId } = await params
  const advisorId = Number(rawId)
  if (!Number.isInteger(advisorId) || advisorId <= 0) {
    return campaignPageMetadata({ title: 'Assessor' })
  }

  const payload = await getPayload({ config })
  const advisor = await loadAdvisorDetail(payload, advisorId)
  if (!advisor) return campaignPageMetadata({ title: 'Assessor' })

  return campaignPageMetadata({ title: 'Assessor', subtitle: advisor.name })
}

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
      <SetCampaignPageChrome chrome={{ title: 'Assessor', subtitle: advisor.name }} />
      <p className="text-muted-foreground">
        E-mail e celular salvam sozinhos ao digitar. A carteira de municípios é editada no modo
        edição da lista.
      </p>

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

      <section
        aria-labelledby="advisor-contact-title"
        className="flex flex-col gap-2 rounded-xl border p-4"
      >
        <h2 id="advisor-contact-title" className="text-base font-medium">
          Telefones da pessoa
        </h2>
        <p className="text-sm text-muted-foreground">
          Todos os números da ficha — o primeiro é o principal (listas, WhatsApp e convites).
        </p>
        {advisor.contactID !== null ? (
          <PhonesFieldEditor
            defaultValues={advisor.fichaPhones}
            label="Telefones"
            saveAction={updateAdvisorContactFormAction}
            recordId={advisor.contactID}
            recordIdField="contactId"
          />
        ) : (
          <p className="text-sm text-muted-foreground">Ficha de contato ainda não vinculada.</p>
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
