import config from '@payload-config'
import { MapPinnedIcon } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getPayload } from 'payload'

import { CampaignListEmptyState } from '@/components/campaign/shared/CampaignListEmptyState'
import {
  CampaignListPendingBoundary,
  CampaignListResults,
} from '@/components/campaign/shared/CampaignListPending'
import { CampaignPageShell } from '@/components/campaign/shell/CampaignPageShell'
import { CalendarPhaseNote } from '@/components/campaign/tour/CalendarPhaseNote'
import { TourComposerForm, type TourStopOption } from '@/components/campaign/tour/TourComposerForm'
import { TourRegionPicker } from '@/components/campaign/tour/TourRegionPicker'
import { Button } from '@/components/ui/button'
import { formatBahiaDayLabel } from '@/lib/campaignTime'
import { formatElectionNumber } from '@/lib/electionFormat'
import { requireCampaignPageActor } from '@/utilities/campaignPageActor'
import { buildMunicipalityDetailTabHref } from '@/utilities/municipality/municipalityDetailTabUi'
import { visitConditionLabels } from '@/utilities/visit/visitEligibility'
import { loadVisitCandidates, loadVisitPlannerRegions } from '@/utilities/visit/visitPlannerData'
import { buildTourComposerHref, parseTourComposerParams } from '@/utilities/visit/visitPlannerUrl'
import {
  composeTourSuggestion,
  resolveTourStopRole,
  tourStopRoleActivityKind,
  tourSuggestionSlugs,
  type VisitCandidateViewModel,
} from '@/utilities/visit/visitPlannerViews'

import { createTourDraftsFormAction } from './formActions'

export const metadata: Metadata = {
  title: 'Planejar giro | Campanha',
  robots: { index: false, follow: false },
}

type TourComposerPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/** "Giro Sisal 27/07" — the date is what tells two giros in the same TI apart. */
const defaultTourName = (region: string, now: Date): string =>
  `Giro ${region} ${formatBahiaDayLabel(now)}`

const toStopOption = (
  candidate: VisitCandidateViewModel,
  role: TourStopOption['role'],
  suggested: boolean,
): TourStopOption => {
  return {
    municipalityID: candidate.id,
    slug: candidate.slug,
    name: candidate.name,
    role,
    suggested,
    kind: tourStopRoleActivityKind[role],
    metCount: candidate.eligibility.metCount,
    conditionCount: candidate.eligibility.conditions.length,
    unmetConditionLabels: candidate.eligibility.conditions
      .filter((condition) => !condition.met)
      .map((condition) => visitConditionLabels[condition.id]),
    deficitLabel: formatElectionNumber(Math.max(candidate.coverage.deficit, 0)),
    contraindicationReason: candidate.eligibility.contraindication?.reason ?? null,
    dossierHref: buildMunicipalityDetailTabHref(candidate.slug, 'dossie', {}),
  }
}

/**
 * E13 — the composer. It answers one question ("which municípios does the
 * candidate visit next, and in what order of importance") in three interactions:
 * pick the território, review the proposed âncora + satélites + semente, generate
 * the drafts.
 *
 * There is no `tour` entity behind it: the giro is its stops, each a draft
 * `activity` with `deputyPresent` — which is what the Atividades list already
 * knows how to schedule, assign and record.
 *
 * Staff-only, like every intelligence surface: a `leader` never sees estimates,
 * goals or the field ceiling this composition is built from.
 */
export default async function TourComposerPage({ searchParams }: TourComposerPageProps) {
  const rawSearchParams = await searchParams
  const { region } = parseTourComposerParams(rawSearchParams)

  const [user, payload] = await Promise.all([
    requireCampaignPageActor({ gate: 'staff' }),
    getPayload({ config }),
  ])

  const now = new Date()
  const [regions, bundle] = await Promise.all([
    loadVisitPlannerRegions(payload, user),
    region ? loadVisitCandidates(payload, user, { region, now }) : null,
  ])
  const candidates = bundle?.groups.flatMap((group) => group.candidates) ?? []
  const suggestion = composeTourSuggestion(candidates)

  // The proposal reads as a giro — âncora, satélites, semente — and the rest of
  // the território follows in queue order. A município the suggestion left out is
  // still offered as a satellite, which is what adding a stop means.
  const stops: TourStopOption[] = [
    ...tourSuggestionSlugs(suggestion).flatMap((slug) => {
      const candidate = candidates.find((entry) => entry.slug === slug)
      const role = resolveTourStopRole(slug, suggestion)
      return candidate && role ? [toStopOption(candidate, role, true)] : []
    }),
    ...candidates
      .filter((candidate) => resolveTourStopRole(candidate.slug, suggestion) === null)
      .map((candidate) => toStopOption(candidate, 'satelite', false)),
  ]

  return (
    <CampaignPageShell>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Planejar giro</h1>
          <p className="max-w-prose text-muted-foreground">
            Um giro por território: o ato onde o voto comprometido já está, as paradas com rede para
            receber, e uma semente de expansão para o giro não repetir só a base. A proposta é
            sugestão — você edita antes de gerar.
          </p>
        </div>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/campanha/atividades">Voltar para Atividades</Link>
        </Button>
      </header>

      {/* Shared transition: the picker navigates, the proposal dims ("Feel the action"). */}
      <CampaignListPendingBoundary>
        {regions.length > 0 ? (
          <TourRegionPicker
            regions={regions.map((option) => ({
              ...option,
              href: buildTourComposerHref({ region: option.region }),
            }))}
            selectedRegion={region}
            clearHref={buildTourComposerHref({ region: null })}
          />
        ) : null}

        <CampaignListResults>
          {bundle ? <CalendarPhaseNote phase={bundle.phase} /> : null}

          {regions.length === 0 ? (
            <CampaignListEmptyState
              icon={MapPinnedIcon}
              title="Você ainda não acompanha nenhum município"
              description="A composição do giro sai da sua carteira. Peça ao Coordenador Geral para vincular seus municípios."
            />
          ) : region === null ? (
            <CampaignListEmptyState
              icon={MapPinnedIcon}
              title="Escolha um território para começar"
              description="A composição do giro compara os municípios entre si dentro do mesmo território — é assim que 'encaixe em giro' faz sentido."
            />
          ) : stops.length === 0 ? (
            <CampaignListEmptyState
              icon={MapPinnedIcon}
              title={`Nenhum município candidato em ${region}`}
              description="Nenhum município deste território está no seu escopo com dados suficientes para compor um giro. Cadastre lideranças ou compromissos de voto e volte aqui."
            >
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/campanha/municipios">Ver municípios</Link>
              </Button>
            </CampaignListEmptyState>
          ) : (
            <TourComposerForm
              region={region}
              stops={stops}
              defaultTourName={defaultTourName(region, now)}
              formAction={createTourDraftsFormAction}
            />
          )}
        </CampaignListResults>
      </CampaignListPendingBoundary>
    </CampaignPageShell>
  )
}
