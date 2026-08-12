'use client'

import { PencilIcon } from 'lucide-react'
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

/**
 * C123 — the activity detail page's edit surface: the "Editar" button and the
 * FAB quick action both open the same agenda overlay (edit mode). The overlay
 * fetches the form view model by id through `loadActivityEditDraft`; on save
 * the page refreshes (title is immutable, so the URL stays valid).
 */
export const ActivityEditOverlayHost = ({
  activityId,
  municipalityOptions,
  organizationOptions,
  knownTags,
}: {
  activityId: number
  municipalityOptions: RelationOption[]
  organizationOptions: RelationOption[]
  knownTags: string[]
}) => {
  const router = useRouter()
  const { isNarrow } = useNarrowMeasured(640)
  const [request, setRequest] = useState<ActivityOverlayRequest | null>(null)

  const openEdit = useCallback(() => setRequest({ kind: 'edit', activityId }), [activityId])
  useBridgedQuickAction('openActivityEdit', openEdit)

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={openEdit}>
        <PencilIcon data-icon="inline-start" aria-hidden="true" />
        Editar
      </Button>
      <ActivityOverlay
        request={request}
        isNarrow={isNarrow}
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
