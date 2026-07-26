'use client'

import { ArrowRightIcon, LocateFixedIcon } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/Spinner'
import { loadMunicipalityGeometryModule } from '@/lib/bahiaGeometries'
import {
  formatDistanceKm,
  resolveNearbyMunicipality,
  type AccessibleMunicipality,
  type NearbyMunicipalityResolution,
} from '@/lib/municipalityProximity'
import {
  COARSE_ACCURACY_M,
  hasPromptedThisSession,
  markPromptedThisSession,
  readGeolocationPermissionState,
  requestCurrentPosition,
  type GeolocationFailureReason,
} from '@/utilities/campaignGeolocation'

type CardState =
  /**
   * Mounted, permission not read yet. Renders the explanation without the CTA:
   * showing a button that turns into a spinner milliseconds later invites a tap
   * that fires a second position request.
   */
  | { status: 'starting' }
  /** Waiting for the user: either the session already prompted, or permission was refused before. */
  | { status: 'ready' }
  | { status: 'locating' }
  | { status: 'resolved'; resolution: NearbyMunicipalityResolution; coarse: boolean }
  | { status: 'failed'; reason: GeolocationFailureReason }

const failureCopy: Record<GeolocationFailureReason, { title: string; hint: string } | null> = {
  denied: {
    title: 'Localização bloqueada neste navegador',
    hint: 'Libere o acesso à localização nas permissões do site e tente de novo.',
  },
  // Also the copy for a geometry chunk that failed to load, hence the reload nudge:
  // the module promise memoizes its rejection, so only a reload can recover.
  unavailable: {
    title: 'Não foi possível obter sua localização',
    hint: 'Tente de novo — em outro ponto, ou recarregando a página.',
  },
  timeout: {
    title: 'A localização demorou para responder',
    hint: 'Sinal fraco costuma ser a causa. Tente de novo.',
  },
  // Nothing the user can do here, so the card does not take space (see render).
  unsupported: null,
}

/**
 * B14 — "abrir a ficha do município onde estou" no Início staff.
 *
 * A posição fica no navegador: o casamento é feito contra a malha municipal que
 * o mapa do dashboard já carrega (mesmo chunk memoizado), sem action, sem
 * artefato e sem `Consent` — nada de coordenada sai do aparelho.
 *
 * `leader` nunca chega aqui: a página `/campanha` roteia liderança para o
 * `LeaderContactsPanel` antes do dashboard.
 */
export const NearestMunicipalityCard = ({
  accessible,
  zoneCityHrefs,
}: {
  accessible: readonly AccessibleMunicipality[]
  /**
   * Filtered-list href per multi-zone city, keyed by IBGE code. Ready-made on
   * purpose: importing the canonical list-URL builder here costs 21 KB of the
   * dashboard's First Load JS (see `buildZoneCityHrefs` in `CampaignDashboard`).
   */
  zoneCityHrefs: Readonly<Record<string, string>>
}) => {
  const [state, setState] = useState<CardState>({ status: 'starting' })
  const autoStartedRef = useRef(false)

  const locate = useCallback(async () => {
    setState({ status: 'locating' })

    /*
     * The geometry chunk is shared with the dashboard map, so this is usually
     * already resolved by the time the fix arrives. `requestCurrentPosition`
     * cannot reject, but the dynamic import can (ChunkLoadError on a weak field
     * connection) — and `loadMunicipalityGeometryModule` memoizes the rejection,
     * so without this catch the card would spin forever with a retry button that
     * can never succeed.
     */
    const loaded = await Promise.all([
      requestCurrentPosition(),
      loadMunicipalityGeometryModule(),
    ]).catch(() => null)

    if (!loaded) {
      setState({ status: 'failed', reason: 'unavailable' })
      return
    }

    const [result, geometry] = loaded

    if (!result.ok) {
      setState({ status: 'failed', reason: result.reason })
      return
    }

    setState({
      status: 'resolved',
      coarse: result.fix.accuracyM > COARSE_ACCURACY_M,
      resolution: resolveNearbyMunicipality({ point: result.fix, geometry, accessible }),
    })
  }, [accessible])

  useEffect(() => {
    /*
     * One automatic attempt per mount: a re-render with a fresh `accessible`
     * array must never fire a second position request. The guard is a ref
     * rather than a cancellation flag on purpose — Strict Mode re-runs this
     * effect on the same instance, and cancelling the first run while the ref
     * blocks the second one would leave the card idle forever.
     */
    if (autoStartedRef.current || accessible.length === 0) return
    autoStartedRef.current = true

    const start = async () => {
      const permission = await readGeolocationPermissionState()

      if (permission === 'granted') {
        void locate()
        return
      }

      // Product decision (2026-07-24): ask automatically, but at most once per
      // tab session — never on every navigation back to the dashboard.
      if (permission !== 'denied' && !hasPromptedThisSession()) {
        markPromptedThisSession()
        void locate()
        return
      }

      setState(
        permission === 'denied' ? { status: 'failed', reason: 'denied' } : { status: 'ready' },
      )
    }

    void start()
  }, [accessible.length, locate])

  if (accessible.length === 0 || !isCardWorthShowing(state)) return null

  return (
    <Card className="flex h-full flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <LocateFixedIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          Onde estou
        </CardTitle>
      </CardHeader>
      <CardContent
        className="flex flex-1 flex-col gap-2 pt-0"
        aria-busy={state.status === 'locating'}
      >
        {/* Mounted from the start so the state change is actually announced. */}
        <p className="sr-only" aria-live="polite">
          {statusAnnouncement(state)}
        </p>
        {renderBody(state, locate, zoneCityHrefs)}
      </CardContent>
    </Card>
  )
}

/** A browser without geolocation takes no space: there is nothing to act on. */
const isCardWorthShowing = (state: CardState): boolean =>
  state.status !== 'failed' || state.reason !== 'unsupported'

/**
 * The multi-second wait and its outcome must reach a screen reader, and the
 * visible copy is spread over paragraph and button — hence one sentence here.
 */
const statusAnnouncement = (state: CardState): string => {
  if (state.status === 'locating') return 'Localizando…'
  if (state.status === 'failed') return failureCopy[state.reason]?.title ?? ''
  if (state.status !== 'resolved') return ''

  return headlineSentence(locationHeadline(state.resolution))
}

/**
 * Where the actor is, written once: the announcement above and the visible
 * headline below both read it, so they cannot drift apart.
 */
type LocationHeadline = { place: string; suffix: string } | { place: null; sentence: string }

const locationHeadline = (resolution: NearbyMunicipalityResolution): LocationHeadline => {
  switch (resolution.kind) {
    case 'inScope':
      return { place: resolution.municipality.name, suffix: '.' }
    case 'zoneCity':
      return { place: resolution.city, suffix: ', dividida por zona eleitoral.' }
    case 'outOfScope':
      return { place: resolution.city, suffix: ', fora da sua carteira.' }
    case 'outsideBahia':
      return {
        place: null,
        sentence: resolution.nearestInScope
          ? 'Você está fora da Bahia.'
          : 'Nenhum município da campanha perto de você.',
      }
  }
}

const headlineSentence = (headline: LocationHeadline): string =>
  headline.place === null ? headline.sentence : `Você está em ${headline.place}${headline.suffix}`

const Headline = ({ headline }: { headline: LocationHeadline }) => (
  <p className="text-sm">
    {headline.place === null ? (
      headline.sentence
    ) : (
      <>
        Você está em <strong className="font-medium">{headline.place}</strong>
        {headline.suffix}
      </>
    )}
  </p>
)

const LocateButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <Button type="button" variant="outline" className="min-h-11 self-start" onClick={onClick}>
    <LocateFixedIcon data-icon="inline-start" aria-hidden="true" />
    {label}
  </Button>
)

const OpenMunicipalityButton = ({ slug, name }: { slug: string; name: string }) => (
  <Button asChild className="min-h-11 self-start">
    <Link href={`/campanha/municipios/${slug}`}>
      Abrir {name}
      <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
    </Link>
  </Button>
)

const Explanation = ({ children }: { children: ReactNode }) => (
  <p className="text-xs text-muted-foreground">{children}</p>
)

const CoarseFixCaveat = () => (
  <Explanation>
    Localização aproximada (o navegador não usou o GPS) — confira o município antes de agir.
  </Explanation>
)

const renderBody = (
  state: CardState,
  locate: () => void,
  zoneCityHrefs: Readonly<Record<string, string>>,
): ReactNode => {
  if (state.status === 'starting' || state.status === 'ready') {
    return (
      <>
        <Explanation>Abra a ficha do município em que você está.</Explanation>
        {/* No CTA while permission is unread: it would become a spinner under the finger. */}
        {state.status === 'ready' ? (
          <LocateButton label="Usar minha localização" onClick={locate} />
        ) : null}
      </>
    )
  }

  if (state.status === 'locating') {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        {/* The live region above announces the wait; Spinner's own role="status" would repeat it. */}
        <Spinner aria-hidden="true" />
        Localizando…
      </p>
    )
  }

  if (state.status === 'failed') {
    const copy = failureCopy[state.reason]
    if (!copy) return null

    return (
      <>
        <p className="text-sm font-medium">{copy.title}</p>
        <Explanation>{copy.hint}</Explanation>
        <LocateButton label="Tentar de novo" onClick={locate} />
      </>
    )
  }

  return (
    <>
      <Headline headline={locationHeadline(state.resolution)} />
      {/* Between "where you are" and what to do about it — a hedge after the CTA is a footnote. */}
      {state.coarse ? <CoarseFixCaveat /> : null}
      {resolutionDetail(state.resolution, locate, zoneCityHrefs)}
    </>
  )
}

/** What to do about where you are — the headline itself comes from `locationHeadline`. */
const resolutionDetail = (
  resolution: NearbyMunicipalityResolution,
  locate: () => void,
  zoneCityHrefs: Readonly<Record<string, string>>,
): ReactNode => {
  const nearest = 'nearestInScope' in resolution ? resolution.nearestInScope : null
  const nearestDetail = nearest ? (
    <>
      <Explanation>
        Mais próximo na sua carteira: {nearest.municipality.name}, a{' '}
        {formatDistanceKm(nearest.distanceKm)}.
      </Explanation>
      <OpenMunicipalityButton slug={nearest.municipality.slug} name={nearest.municipality.name} />
    </>
  ) : null

  switch (resolution.kind) {
    case 'inScope':
      return (
        <OpenMunicipalityButton
          slug={resolution.municipality.slug}
          name={resolution.municipality.name}
        />
      )

    case 'zoneCity': {
      // Server and client read the same `accessible` set, so the href is there —
      // but a button labeled "Ver zonas de X" that opened the unfiltered list
      // would be worse than no button.
      const zonesHref = zoneCityHrefs[resolution.ibgeCode]

      return (
        <>
          <Explanation>
            Escolha entre as {resolution.zoneCount} zonas — a localização não distingue a zona.
          </Explanation>
          {zonesHref ? (
            <Button asChild className="min-h-11 self-start">
              <Link href={zonesHref}>
                Ver zonas de {resolution.city}
                <ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
              </Link>
            </Button>
          ) : null}
        </>
      )
    }

    case 'outOfScope':
      return nearestDetail ?? <Explanation>Nenhum município da sua carteira por perto.</Explanation>

    case 'outsideBahia':
      return (
        nearestDetail ?? (
          <>
            <Explanation>Sua posição está longe do território da campanha.</Explanation>
            <LocateButton label="Tentar de novo" onClick={locate} />
          </>
        )
      )
  }
}
