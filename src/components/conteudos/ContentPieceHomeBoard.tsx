'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  loadMunicipalityGeometryModule,
  loadMunicipalityZoneGeometryModule,
  loadTerritoryGeometryModule,
} from '@/lib/bahiaGeometries'
import {
  resolveContentPieceHomeVisitor,
  selectContentPieceHomeItems,
  type ContentPieceHomeItem,
  type ContentPieceHomeVisitor,
} from '@/lib/contentPieceHomeSelection'
import { cn } from '@/lib/utils'
import {
  COARSE_ACCURACY_M,
  readGeolocationPermissionState,
  requestCurrentPosition,
  type GeolocationPermissionState,
} from '@/utilities/campaignGeolocation'

import { ContentPieceHomeCard } from './ContentPieceHomeCard'
import {
  CONTENT_PIECE_FOCUS,
  CONTENT_PIECE_LOCAL_TAG,
  CONTENT_PIECE_PRIMARY_BUTTON,
  CONTENT_PIECE_TAG,
} from './contentPieceClasses'

/**
 * S39 — the Central sample board (artefato: cenas 01–05). The server renders
 * the recent selection; this island only upgrades it in silence when the
 * visitor's location is already available: permission `granted` resolves
 * without a dialog on mount, anything else needs the explicit "Usar minha
 * localização" affordance. Nothing is persisted, logged or sent anywhere — the
 * fix is matched against the committed meshes in the browser and dies here.
 *
 * No auto-prompt (unlike the staff B14 card): a surprise dialog on the home
 * burns trust, and the recent selection is already useful without it.
 */

const COPY = {
  local: {
    desktop: 'Comece pelo material do seu território e mande para quem você conhece.',
    mobile: 'Material do seu território para compartilhar.',
  },
  recent: {
    desktop: 'Veja as peças mais recentes e escolha uma para compartilhar.',
    mobile: 'Veja as peças mais recentes.',
  },
  single: {
    desktop: 'Uma peça oficial já está pronta para você compartilhar.',
    mobile: 'Uma peça oficial já está pronta.',
  },
} as const

const LOCATE_BUTTON = cn(
  'inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-extrabold text-(--pt-red) underline underline-offset-4',
  CONTENT_PIECE_FOCUS,
)

export const ContentPieceHomeBoard = ({ items }: { items: readonly ContentPieceHomeItem[] }) => {
  const [permission, setPermission] = useState<GeolocationPermissionState | null>(null)
  const [visitor, setVisitor] = useState<ContentPieceHomeVisitor | null>(null)
  const [locating, setLocating] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [playingId, setPlayingId] = useState<number | null>(null)
  const autoStartedRef = useRef(false)

  const locate = useCallback(async () => {
    setLocating(true)
    setAttempted(true)

    /*
     * The geometry chunks are shared with the staff map, so they are usually
     * cached; the dynamic imports can still fail on a weak connection, and the
     * loader memoizes the rejection — without the catch the section would keep
     * the recent selection silently, which is exactly the honest fallback.
     */
    const loaded = await Promise.all([
      requestCurrentPosition(),
      loadMunicipalityGeometryModule(),
    ]).catch(() => null)

    if (!loaded || !loaded[0].ok) {
      setLocating(false)
      return
    }

    const [result, municipalityGeometry] = loaded

    const [zoneGeometry, territoryGeometry] = await Promise.all([
      loadMunicipalityZoneGeometryModule().catch(() => null),
      loadTerritoryGeometryModule().catch(() => null),
    ])

    setVisitor(
      resolveContentPieceHomeVisitor({
        point: result.fix,
        coarse: result.fix.accuracyM > COARSE_ACCURACY_M,
        municipalityGeometry,
        zoneGeometry,
        territoryGeometry,
      }),
    )
    setLocating(false)
  }, [])

  useEffect(() => {
    /*
     * One automatic attempt per mount (the B14 guard): a re-render must never
     * fire a second position request, and Strict Mode re-runs this effect on
     * the same instance — cancelling the first run while the ref blocks the
     * second would leave the board idle forever.
     */
    if (autoStartedRef.current) return
    autoStartedRef.current = true

    const start = async () => {
      const state = await readGeolocationPermissionState()
      setPermission(state)
      if (state === 'granted') void locate()
    }

    void start()
  }, [locate])

  const selection = selectContentPieceHomeItems(items, visitor)
  const hasMunicipalityMatch = selection.some((entry) => entry.match === 'municipality')
  const isSingle = selection.length === 1
  const showLocateButton =
    (permission === 'prompt' || permission === 'unknown') &&
    visitor === null &&
    selection.length > 1 &&
    // The button stays mounted (disabled) while the fix is in flight, so the
    // tap does not drop the keyboard focus; after the attempt it is gone.
    (!attempted || locating)
  const copy = isSingle ? COPY.single : hasMunicipalityMatch ? COPY.local : COPY.recent

  return (
    <>
      <p aria-live="polite" className="sr-only">
        {locating
          ? 'Localizando…'
          : visitor !== null
            ? hasMunicipalityMatch
              ? 'Peças do seu município'
              : 'Peças recentes'
            : ''}
      </p>
      <div
        className={cn(
          'relative',
          isSingle && 'lg:grid lg:grid-cols-[1fr_360px] lg:items-center lg:gap-10',
        )}
      >
        <div
          className={cn(isSingle ? 'text-center lg:text-left' : 'mx-auto max-w-2xl text-center')}
        >
          <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
            Central de Conteúdos
          </p>
          <h2
            id="content-pieces-title"
            className="campaign-section-title campaign-content-pieces-title m-0 mt-2 border-0 p-0 font-black tracking-[-0.02em] text-balance"
          >
            Peça voto pra
            <br className="sm:hidden" /> Solla 1313
          </h2>
          <p className="campaign-section-copy mx-auto mt-3 max-w-xl text-(--campaign-muted) lg:mx-0">
            <span className="sm:hidden">{copy.mobile}</span>
            <span className="hidden sm:inline">{copy.desktop}</span>
          </p>
          <div
            className={cn(
              'mt-3 flex flex-wrap items-center gap-2',
              isSingle ? 'justify-center lg:justify-start' : 'justify-center',
            )}
          >
            <span
              data-sample-tag={hasMunicipalityMatch ? 'municipality' : 'recent'}
              className={hasMunicipalityMatch ? CONTENT_PIECE_LOCAL_TAG : CONTENT_PIECE_TAG}
            >
              {hasMunicipalityMatch ? (
                <>
                  <span aria-hidden="true">⌖</span> Para seu município
                </>
              ) : (
                'Seleção recente'
              )}
            </span>
            {hasMunicipalityMatch ? (
              <span className="hidden text-[11px] text-(--campaign-muted) sm:inline">
                Localização usada só nesta visita
              </span>
            ) : null}
          </div>
          {isSingle ? (
            <Link
              href="/conteudos"
              className={cn(CONTENT_PIECE_PRIMARY_BUTTON, 'mt-6 hidden lg:inline-flex')}
            >
              Ver todas as peças →
            </Link>
          ) : null}
        </div>

        <div
          className={cn(
            'mt-6',
            isSingle ? 'lg:mt-0' : 'grid gap-4 sm:grid-cols-2 sm:gap-6 lg:mt-9 lg:grid-cols-3',
          )}
        >
          {selection.map(({ item, match }) => (
            <ContentPieceHomeCard
              key={item.id}
              item={item}
              match={match}
              playing={playingId === item.id}
              onToggle={() => setPlayingId((current) => (current === item.id ? null : item.id))}
              onEnded={() => setPlayingId((current) => (current === item.id ? null : current))}
            />
          ))}
        </div>

        {isSingle ? (
          <Link
            href="/conteudos"
            className={cn(CONTENT_PIECE_PRIMARY_BUTTON, 'mt-7 w-full lg:hidden')}
          >
            Ver todas as peças →
          </Link>
        ) : (
          <div className="mt-9 text-center">
            <Link href="/conteudos" className={CONTENT_PIECE_PRIMARY_BUTTON}>
              Ver todas as peças →
            </Link>
          </div>
        )}
      </div>

      {/* Cena 05 — with a single published piece the section ends on the CTA. */}
      {isSingle ? null : (
        <div className="relative mt-6 text-center">
          {showLocateButton ? (
            <>
              <button
                type="button"
                onClick={() => void locate()}
                disabled={locating}
                className={LOCATE_BUTTON}
              >
                <span aria-hidden="true">⌖</span> Usar minha localização
              </button>
              <p className="mt-1 text-[11px] leading-4 text-(--campaign-muted)">
                <span className="sm:hidden">Opcional. Sem prompt no carregamento.</span>
                <span className="hidden sm:inline">
                  Opcional e secundário. A seção já funciona sem isso.
                </span>
              </p>
            </>
          ) : (
            <p className="text-[11px] leading-4 text-(--campaign-muted)">
              <span className="sm:hidden">
                A localização não é guardada. Cards personalizáveis ficam na seção anterior.
              </span>
              <span className="hidden sm:inline">
                Nenhum card personalizável entra nesta amostra.
              </span>
            </p>
          )}
        </div>
      )}
    </>
  )
}
