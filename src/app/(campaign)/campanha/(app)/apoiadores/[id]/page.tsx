import config from '@payload-config'
import { ArrowLeftIcon, ShieldCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { setSupporterVoteIntentionFormAction } from '@/app/(campaign)/campanha/(app)/apoiadores/[id]/formActions'
import { ConsentText } from '@/components/campaign/shared/ConsentText'
import { RemoveSupporterDataButton } from '@/components/campaign/supporter/RemoveSupporterDataButton'
import { SupporterShareKit } from '@/components/campaign/supporter/SupporterShareKit'
import { VoteIntentionControl } from '@/components/campaign/supporter/VoteIntentionControl'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { campaignPageMetadataFromCatalog } from '@/lib/campaignPageChrome'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import {
  loadSupporterDetailConsentData,
  loadSupporterDetailPageData,
  SupporterNotFoundError,
} from '@/utilities/supporter/supporterPageData'
import {
  canAccessSupporterArea,
  supporterVoteIntentionLabels,
} from '@/utilities/supporter/supporterUi'
import { parseSupporterId } from '@/utilities/supporter/supporterViewModels'

export const metadata = campaignPageMetadataFromCatalog('apoiadores')

type SupporterDetailPageProps = {
  params: Promise<{ id: string }>
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

export default async function SupporterDetailPage({ params }: SupporterDetailPageProps) {
  const { id: rawId } = await params
  const supporterId = parseSupporterId(rawId)
  if (supporterId === null) notFound()

  const [user, payload] = await Promise.all([requireCampaignPageActor(), getPayload({ config })])
  if (!canAccessSupporterArea(user.role)) redirect('/campanha')

  let supporter
  let consentData
  try {
    ;[supporter, consentData] = await Promise.all([
      loadSupporterDetailPageData(payload, user, supporterId),
      loadSupporterDetailConsentData(payload),
    ])
  } catch (error) {
    if (error instanceof SupporterNotFoundError) notFound()
    throw error
  }

  const voteIntentionLabel = supporter.voteIntention
    ? supporterVoteIntentionLabels[supporter.voteIntention]
    : null

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? 'https://jorgesolla.com.br'

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Button asChild variant="ghost" className="w-fit px-0">
          <Link href="/campanha/apoiadores">
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar para apoiadores
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">{supporter.name}</h1>
        <p className="text-muted-foreground">
          {supporter.city ?? 'Cidade não informada'}
          {supporter.territory ? ` · ${supporter.territory}` : ''}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p>
            Cadastrado em {dateFormatter.format(new Date(supporter.createdAt))}
            {supporter.createdByName ? ` · por ${supporter.createdByName}` : ''}
          </p>
          <p>Origem: {supporter.sourceLabel}</p>
          {voteIntentionLabel ? (
            <Badge variant="estimate-confirmed" className="w-fit">
              {voteIntentionLabel}
            </Badge>
          ) : (
            <Badge variant="outline" className="w-fit">
              Sem intenção registrada
            </Badge>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados de contato</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="tabular-nums">{supporter.phoneDisplay || '—'}</p>
          {supporter.email ? <p>{supporter.email}</p> : null}
          <p>
            {supporter.municipalityName ? (
              <>
                Município:{' '}
                <Link
                  href={`/campanha/municipios/${supporter.municipalitySlug}`}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {supporter.municipalityName}
                </Link>
              </>
            ) : (
              <span className="text-muted-foreground">Sem município vinculado</span>
            )}
          </p>
        </CardContent>
      </Card>

      <section className="rounded-[6px] border-2 border-primary/20 bg-primary/5 p-4">
        <div className="flex items-start gap-2">
          <ShieldCheckIcon className="mt-0.5 size-5 text-primary" aria-hidden="true" />
          <div className="flex flex-col gap-3">
            <div>
              <h2 className="font-medium">Consentimento LGPD</h2>
              <p className="text-sm text-muted-foreground">
                Registro do consentimento de cadastro coletado no momento do cadastro.
              </p>
            </div>
            {consentData.registrationConsent ? (
              <div className="max-h-48 overflow-y-auto rounded-[6px] border bg-background p-3 text-sm">
                <ConsentText data={consentData.registrationConsent} />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Texto de consentimento não configurado no admin.
              </p>
            )}
            {supporter.consentedAt ? (
              <p className="text-sm text-muted-foreground">
                Consentimento registrado em {dateFormatter.format(new Date(supporter.consentedAt))}
                {supporter.createdByName ? ` · Coletor: ${supporter.createdByName}` : ''}
              </p>
            ) : null}
            <p className="text-sm">
              <Link href="/privacidade" className="text-primary underline-offset-4 hover:underline">
                Política de Privacidade
              </Link>
            </p>
          </div>
        </div>
      </section>

      <VoteIntentionControl
        supporterId={supporter.id}
        currentValue={supporter.voteIntention}
        hasVoteIntentionConsent={supporter.hasVoteIntentionConsent}
        voteIntentionConsentConfigured={Boolean(consentData.voteIntentionConsent)}
        action={setSupporterVoteIntentionFormAction}
      />

      <SupporterShareKit supporterName={supporter.name} siteUrl={siteUrl} phone={supporter.phone} />

      <RemoveSupporterDataButton supporterId={supporter.id} />
    </div>
  )
}
