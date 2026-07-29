/**
 * E13 tour-composer URL contract — one region param, parsed and serialized in
 * one place so the detail card's CTA, the Atividades button and the page itself
 * cannot spell it three ways.
 *
 * Client-safe by construction: it only touches the identity-territory name
 * table. The B14 lesson applies to serializers too — a client component that
 * imports a serializer which imports the catalog drags the catalog into the
 * bundle, which is why nothing heavier lives here.
 */
import { isBahiaIdentityTerritory, type BahiaIdentityTerritory } from '@/lib/bahiaTerritories'
import { firstValue, type RawSearchParams } from '@/utilities/campaignListUrl'

export const TOUR_COMPOSER_PATH = '/campanha/atividades/giros'

export type TourComposerState = {
  region: BahiaIdentityTerritory | null
}

export const parseTourComposerParams = (params: RawSearchParams): TourComposerState => {
  const raw = firstValue(params.region)?.trim()
  return { region: raw && isBahiaIdentityTerritory(raw) ? raw : null }
}

export const buildTourComposerHref = ({ region }: TourComposerState): string =>
  region ? `${TOUR_COMPOSER_PATH}?region=${encodeURIComponent(region)}` : TOUR_COMPOSER_PATH
