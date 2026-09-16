import config from '@payload-config'
import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import { SetCampaignPageChrome } from '@/components/campaign/shell/CampaignPageChromeContext'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { SpeechCutsForSpeechSection } from '@/components/campaign/speech/SpeechCutsForSpeechSection'
import { SpeechDetailPlayer } from '@/components/campaign/speech/SpeechDetailPlayer'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/button'
import { campaignPageMetadata } from '@/lib/campaignPageChrome'
import { CAMPAIGN_COMMUNICATION_ACERVO } from '@/lib/campaignPaths'
import { isExcerptSelectionAvailable } from '@/lib/speechExcerptSelection'
import { firstValue, strictDecimalInteger } from '@/utilities/campaignListUrl'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { loadSpeechCutsForSpeech } from '@/utilities/speech/speechCutPageData'
import { loadSpeechDetailPageData, SpeechNotFoundError } from '@/utilities/speech/speechPageData'
import { parseSpeechSeekSeconds } from '@/utilities/speech/speechViewModels'

type SpeechDetailPageProps = {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

const backHref = (q: string | undefined): string =>
  q ? `${CAMPAIGN_COMMUNICATION_ACERVO}?q=${encodeURIComponent(q)}` : CAMPAIGN_COMMUNICATION_ACERVO

export async function generateMetadata({ params }: SpeechDetailPageProps) {
  const { id } = await params
  const speechId = strictDecimalInteger(id)
  if (!speechId) return campaignPageMetadata({ title: 'Fala' })

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])

  try {
    const view = await loadSpeechDetailPageData(payload, user, speechId)
    return campaignPageMetadata({ title: view.type ?? 'Fala', subtitle: view.speechAtLabel })
  } catch {
    return campaignPageMetadata({ title: 'Fala' })
  }
}

export default async function SpeechDetailPage({ params, searchParams }: SpeechDetailPageProps) {
  const [{ id }, query, user, payload] = await Promise.all([
    params,
    searchParams,
    requireCampaignPageActor({ gate: 'speechCatalog' }),
    getPayload({ config }),
  ])
  const speechId = strictDecimalInteger(id)
  if (!speechId) notFound()

  const q = firstValue(query.q)
  const initialSeconds = parseSpeechSeekSeconds(firstValue(query.t))

  const [view, cuts] = await Promise.all([
    loadSpeechDetailPageData(payload, user, speechId, q).catch((error) => {
      if (error instanceof SpeechNotFoundError) notFound()
      throw error
    }),
    loadSpeechCutsForSpeech(payload, user, speechId),
  ])

  const sourceUrl = view.officialTextUrl ?? view.youtubeUrl

  return (
    <CampaignPageShell>
      <SetCampaignPageChrome
        chrome={{ title: view.type ?? 'Fala', subtitle: view.speechAtLabel }}
      />

      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="-ml-2 min-h-10 self-start">
          <Link href={backHref(q)}>
            <ArrowLeftIcon data-icon="inline-start" aria-hidden="true" />
            Voltar ao acervo
          </Link>
        </Button>

        {/* C174 — mobile: the cuts section comes before the metadata aside
            (finding a cut is the job here). Desktop keeps the artifact's
            full-width section below the player/aside grid. */}
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="order-1 min-w-0 lg:col-start-1 lg:row-start-1">
            <h1 className="text-lg font-medium">{view.type ?? 'Fala'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
              <span>{view.speechAtLabel}</span>
              {view.phase ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{view.phase}</span>
                </>
              ) : null}
              {view.durationLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{view.durationLabel}</span>
                </>
              ) : null}
              {view.presidingOfficer ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Presidiu: {view.presidingOfficer}</span>
                </>
              ) : null}
            </div>

            <div className="mt-4">
              <SpeechDetailPlayer
                speechId={view.id}
                youtubeVideoId={view.youtubeVideoId}
                youtubeOffsetSeconds={view.youtubeOffsetSeconds}
                vodResolvable={view.vodResolvable}
                segments={view.segments}
                initialSeconds={initialSeconds}
                sourceUrl={sourceUrl}
                durationSeconds={view.durationSeconds}
                speechType={view.type}
                speechDateLabel={view.speechDateLabel}
                speechSummary={view.summary}
              />
            </div>

            {view.officialTranscript ? (
              <details className="mt-5 rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-medium">
                  Transcrição oficial (taquigrafia)
                </summary>
                <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">
                  {view.officialTranscript}
                </p>
              </details>
            ) : null}
          </div>

          <div className="order-2 lg:col-span-2 lg:row-start-2">
            <SpeechCutsForSpeechSection
              cuts={cuts}
              excerptSelectionAvailable={isExcerptSelectionAvailable(
                view.durationSeconds,
                view.segments,
              )}
            />
          </div>

          <aside className="order-3 space-y-4 lg:col-start-2 lg:row-start-1">
            {view.summary ? (
              <section>
                <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
                  Sumário oficial
                </h2>
                <p className="mt-1.5 text-sm text-foreground/90">{view.summary}</p>
              </section>
            ) : null}

            {view.topics.length ? (
              <section>
                <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Temas</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {view.topics.map((topic) => (
                    <Badge key={topic.value} variant="secondary" className="font-normal">
                      {topic.label}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {view.scopes.length ? (
              <section>
                <h2 className="text-xs tracking-wide text-muted-foreground uppercase">Alcance</h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {view.scopes.map((scope) => (
                    <Badge key={scope.value} variant="secondary" className="font-normal">
                      {scope.label}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {view.municipalities.length ? (
              <section>
                <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
                  Municípios citados
                </h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {view.municipalities.map((municipality) => (
                    <Badge key={municipality.id} variant="outline" className="font-normal">
                      {municipality.name}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            {view.keywords.length ? (
              <section>
                <h2 className="text-xs tracking-wide text-muted-foreground uppercase">
                  Palavras-chave oficiais
                </h2>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {view.keywords.map((keyword) => (
                    <Badge
                      key={keyword}
                      variant="outline"
                      className="font-normal text-muted-foreground"
                    >
                      {keyword}
                    </Badge>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="border-t pt-3">
              <p className="text-xs text-muted-foreground">
                Fonte: Câmara dos Deputados · CC BY 4.0
              </p>
            </section>
          </aside>
        </div>
      </div>
    </CampaignPageShell>
  )
}
