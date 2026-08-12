'use client'

import { PlusIcon } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'

import {
  ActivityOverlay,
  type ActivityOverlayRequest,
} from '@/components/campaign/activity/ActivityOverlay'
import type { RelationOption } from '@/components/campaign/shared/RelationMultiSelect'
import { useBridgedQuickAction } from '@/components/campaign/shell/CampaignQuickActionContext'
import { Button } from '@/components/ui/button'
import { useNarrowMeasured } from '@/hooks/use-mobile'
import { activityDefaultCreatePrefill } from '@/utilities/activityUi'

/**
 * C123 — the activities list page's create surface: the "Nova atividade"
 * button and the FAB quick action both open the agenda's create overlay with
 * the default window (today 09:00) and the list's municipality filter as
 * prefill. On save the page refreshes so the new row appears.
 */
export const ActivityCreateOverlayHost = ({
  municipalityId,
  municipalityOptions,
  organizationOptions,
  knownTags,
}: {
  municipalityId?: number
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  knownTags: string[]
}) => {
  const router = useRouter()
  const { isNarrow } = useNarrowMeasured(640)
  const [request, setRequest] = useState<ActivityOverlayRequest | null>(null)

  const openCreate = useCallback(() => {
    const prefill = activityDefaultCreatePrefill()
    if (!prefill) return
    setRequest({ kind: 'create', ...prefill })
  }, [])
  useBridgedQuickAction('openActivityCreate', openCreate)

  return (
    <>
      <Button type="button" className="min-h-11" onClick={openCreate}>
        <PlusIcon data-icon="inline-start" aria-hidden="true" />
        Nova atividade
      </Button>
      <ActivityOverlay
        request={request}
        isNarrow={isNarrow}
        agendaState={municipalityId ? { municipality: municipalityId } : undefined}
        municipalityOptions={municipalityOptions}
        organizationOptions={organizationOptions}
        knownTags={knownTags}
        onClose={() => setRequest(null)}
        onSaved={() => {
          setRequest(null)
          router.refresh()
        }}
      />
    </>
  )
}
