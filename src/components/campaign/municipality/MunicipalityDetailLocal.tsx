'use client'

import { useEffect, useRef, useState } from 'react'

import { MunicipalityDetailHeaderView } from '@/components/campaign/municipality/MunicipalityDetailHeaderView'
import { MunicipalityPledgesPanel } from '@/components/campaign/municipality/MunicipalityPledgesPanel'
import {
  leadershipsCollection,
  municipalitiesCollection,
  votePledgesCollection,
} from '@/components/campaign/opsSync/opsMirrorClient'
import { toDetailHeaderView } from '@/lib/campaignOps/municipalityDetailHeaderView'
import {
  findOpsMunicipalityBySlug,
  toLocalStaffPledgeRows,
  type OpsLocalStaffPledgeRow,
} from '@/lib/campaignOps/municipalityDetailLocalViews'
import type { OpsMunicipality } from '@/lib/campaignOps/opsContract'

const ONLINE_ONLY_MESSAGE = 'Disponível quando estiveres online.'

type MunicipalityDetailLocalProps = {
  slug: string
}

type LocalDetailSnapshot = {
  municipality: OpsMunicipality | null
  pledges: OpsLocalStaffPledgeRow[]
}

const readLocalDetailSnapshot = (slug: string): LocalDetailSnapshot => {
  const municipality = findOpsMunicipalityBySlug(municipalitiesCollection.toArray, slug)
  return {
    municipality,
    pledges: municipality
      ? toLocalStaffPledgeRows(
          municipality.id,
          votePledgesCollection.toArray,
          leadershipsCollection.toArray,
        )
      : [],
  }
}

/**
 * Offline Local path for municipality detail (OH9). Reads municipality +
 * pledges × leaderships from the ops mirror. Online-only regions (tabs TSE,
 * dossier, updates feed, map) render an honest placeholder — no crash.
 */
export const MunicipalityDetailLocal = ({ slug }: MunicipalityDetailLocalProps) => {
  const [snapshot, setSnapshot] = useState<LocalDetailSnapshot>(() => readLocalDetailSnapshot(slug))
  const coalesceRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const refresh = () => {
      // replaceCollectionRows emits per-row changes — coalesce to one snapshot
      // rebuild per microtask while Local is mounted.
      if (coalesceRef.current) return
      coalesceRef.current = () => {
        coalesceRef.current = null
        setSnapshot(readLocalDetailSnapshot(slug))
      }
      queueMicrotask(coalesceRef.current)
    }
    refresh()
    const subscriptions = [
      municipalitiesCollection.subscribeChanges(refresh),
      votePledgesCollection.subscribeChanges(refresh),
      leadershipsCollection.subscribeChanges(refresh),
    ]
    return () => {
      for (const subscription of subscriptions) subscription.unsubscribe()
      coalesceRef.current = null
    }
  }, [slug])

  const { municipality, pledges } = snapshot

  if (!municipality) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Este município não está no espelho offline. {ONLINE_ONLY_MESSAGE}
        </p>
      </div>
    )
  }

  const headerView = toDetailHeaderView(municipality)
  const advisorsUnavailable = (municipality.advisors?.length ?? 0) > 0

  return (
    <div className="flex flex-col gap-6">
      <MunicipalityDetailHeaderView
        view={headerView}
        advisorSummaries={[]}
        advisorsUnavailable={advisorsUnavailable}
      />

      <MunicipalityPledgesPanel pledges={pledges} />

      <section aria-label="Conteúdo disponível só online" className="rounded-xl border px-4 py-6">
        <p className="text-sm text-muted-foreground">{ONLINE_ONLY_MESSAGE}</p>
      </section>
    </div>
  )
}
