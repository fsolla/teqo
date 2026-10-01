'use client'
import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation.js'
import React, { useEffect, useState } from 'react'

/**
 * The Payload live-preview bridge belongs to the preview surface the admin
 * opens (an iframe in the edit view, or the popup variant). The package fires
 * `router.refresh()` as soon as it mounts to pick up the saved data, and the
 * App Router answers a refresh by rewriting the canonical URL — which drops
 * any `#hash` applied between the click and the refresh (the hero CTA →
 * `#novidades` deploy-verify race). A standalone public load must not pay that
 * refresh, so the bridge mounts only when there is a preview parent
 * (`window.parent` for the iframe, `window.opener` for the popup); the render
 * stays `null` on every other page view.
 */
export const RefreshRouteOnSave: React.FC = () => {
  const router = useRouter()
  const [previewing, setPreviewing] = useState(false)

  useEffect(() => {
    setPreviewing(window.parent !== window || window.opener != null)
  }, [])

  if (!previewing) return null

  return <PayloadLivePreview refresh={() => router.refresh()} serverURL="http://localhost:3000" />
}
