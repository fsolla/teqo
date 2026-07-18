'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Share2Icon } from 'lucide-react'

import type { NucleusShareRecipientsResult } from '@/app/(campaign)/campanha/(app)/nucleos/[slug]/shareRecipientsActions'
import { LazyDialogModuleFallback } from '@/components/campaign/LazyDialogModuleFallback'
import { useLazyDialogModule } from '@/components/campaign/useLazyDialogModule'
import { Button } from '@/components/ui/button'
import { Dialog, DialogTrigger } from '@/components/ui/dialog'

type ShareNucleusDialogModule = {
  default: typeof import('./ShareNucleusDialog').ShareNucleusDialog
}

const loadShareNucleusDialog = (): Promise<ShareNucleusDialogModule> =>
  import('./ShareNucleusDialog').then((module) => ({
    default: module.ShareNucleusDialog,
  }))

export type LoadNucleusShareRecipientsAction = () => Promise<NucleusShareRecipientsResult>

export const ShareNucleusDialogShell = ({
  loadDialogModule = loadShareNucleusDialog,
  loadRecipients,
  nucleusName,
  senderName,
}: {
  loadDialogModule?: () => Promise<ShareNucleusDialogModule>
  loadRecipients: LoadNucleusShareRecipientsAction
  nucleusName: string
  senderName: string
}) => {
  const [activated, setActivated] = useState(false)
  const [data, setData] = useState<NucleusShareRecipientsResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const requestId = useRef(0)
  const {
    component: DialogComponent,
    load,
    resetAfterClose,
    status,
  } = useLazyDialogModule(loadDialogModule)

  const fetchRecipients = useCallback(async () => {
    const currentRequest = ++requestId.current
    setLoading(true)
    setLoadError(false)
    setData(null)
    try {
      const result = await loadRecipients()
      if (requestId.current !== currentRequest) return
      setData(result)
    } catch {
      if (requestId.current !== currentRequest) return
      setLoadError(true)
    } finally {
      if (requestId.current === currentRequest) setLoading(false)
    }
  }, [loadRecipients])

  const openDialog = () => {
    setActivated(true)
    load()
  }

  const closeDialog = () => {
    setActivated(false)
    setData(null)
    setLoading(false)
    setLoadError(false)
    requestId.current += 1
    resetAfterClose()
  }

  useEffect(() => {
    if (!activated) return
    void fetchRecipients()
    return () => {
      requestId.current += 1
    }
  }, [activated, fetchRecipients])

  return (
    <Dialog
      open={activated}
      onOpenChange={(open) => {
        if (open) {
          openDialog()
          return
        }
        closeDialog()
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11">
          <Share2Icon data-icon="inline-start" aria-hidden="true" />
          Compartilhar
        </Button>
      </DialogTrigger>
      {activated ? (
        DialogComponent ? (
          <DialogComponent
            data={data}
            loadError={loadError}
            loading={loading || status === 'loading'}
            nucleusName={nucleusName}
            onRetry={() => {
              load()
              void fetchRecipients()
            }}
            senderName={senderName}
          />
        ) : (
          <LazyDialogModuleFallback
            description={`${nucleusName} · envia apenas o link, não concede acesso`}
            loadingLabel="Carregando compartilhamento"
            onRetry={load}
            status={status === 'ready' ? 'loading' : status}
            title="Compartilhar núcleo"
          />
        )
      ) : null}
    </Dialog>
  )
}
