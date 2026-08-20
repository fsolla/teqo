'use client'

import { useAllFormFields } from '@payloadcms/ui'
import type { FieldClientComponent } from 'payload'
import { useEffect, useState } from 'react'

type InstagramSyncStatusValue = {
  lastSyncAt?: string
  postCount?: number
  error?: string
  errorAt?: string
}

type SyncResponse = {
  ok: boolean
  status?: InstagramSyncStatusValue
  error?: string
}

const isSyncStatus = (value: unknown): value is InstagramSyncStatusValue =>
  typeof value === 'object' && value !== null

const relativeTimeFormatter = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

const formatSyncTime = (iso?: string): string => {
  if (!iso) return ''
  const time = new Date(iso).getTime()
  if (Number.isNaN(time)) return ''
  const seconds = Math.floor((time - Date.now()) / 1000)
  if (seconds > -60) return 'agora'
  const absSeconds = -seconds
  if (absSeconds < 3_600) {
    return relativeTimeFormatter.format(-Math.floor(absSeconds / 60), 'minute')
  }
  if (absSeconds < 86_400) {
    return relativeTimeFormatter.format(-Math.floor(absSeconds / 3_600), 'hour')
  }
  return relativeTimeFormatter.format(-Math.floor(absSeconds / 86_400), 'day')
}

const postCountLabel = (count?: number): string =>
  count === undefined ? '' : `${count} ${count === 1 ? 'post' : 'posts'}`

/**
 * Sync-status panel of the Instagram feed (S11) — the S3 fail-closed silence
 * made the assessoria blind: a wrong token left no trace beyond an empty
 * picker. This panel shows, in the same global where the credentials live,
 * the state of the last sync — "Sincronizado · há X min · N posts",
 * "Falha na última sincronização" with the product-language reason, or
 * "Instagram ainda não configurado" — with a "Tentar sincronizar de novo"
 * button that runs `POST /api/social-feed/sync` (admin session) and renders
 * the outcome. The status itself is persisted server-side by the render
 * path, the global's `afterChange` and the sync route; this component only
 * reads it from the form and keeps the in-flight result locally.
 */
export const InstagramSyncStatusPanel: FieldClientComponent = () => {
  const [fields] = useAllFormFields()
  const [outcome, setOutcome] = useState<SyncResponse | null>(null)
  const [pending, setPending] = useState(false)
  const [requestError, setRequestError] = useState<string | null>(null)

  const enabled = fields.enabled?.value !== false && fields.instagramEnabled?.value !== false
  const accessToken = fields.instagramAccessToken?.value
  const userId = fields.instagramUserId?.value
  const stored = fields.instagramSyncStatus?.value
  const persisted = isSyncStatus(stored) ? stored : {}

  // The panel shows the SERVER-persisted state; the transient retry result in
  // `outcome` must not outlive an edit of the credentials it was produced with
  // (otherwise it keeps showing the failure of the old token pre-save).
  const credentialKey = typeof accessToken === 'string' ? accessToken : ''
  const userIdKey = typeof userId === 'string' ? userId : ''
  useEffect(() => {
    setOutcome(null)
    setRequestError(null)
  }, [credentialKey, userIdKey])

  const configured =
    typeof accessToken === 'string' &&
    accessToken !== '' &&
    typeof userId === 'string' &&
    userId !== ''

  const status = outcome?.status && isSyncStatus(outcome.status) ? outcome.status : persisted
  const failureMessage = status.error ?? null
  const lastSyncAt = status.lastSyncAt
  const postCount = status.postCount

  const retrySync = async () => {
    setPending(true)
    setRequestError(null)
    try {
      const response = await fetch('/api/social-feed/sync', { method: 'POST' })
      const body = (await response.json()) as SyncResponse
      if (response.status === 401) {
        setRequestError(
          'Sessão do admin expirada. Salve a página e recarregue o admin para reautenticar.',
        )
        return
      }
      if (!response.ok || body.error) {
        throw new Error(body.error ?? 'Falha na sincronização')
      }
      setOutcome(body)
    } catch {
      setRequestError('Não foi possível sincronizar agora. Tente novamente em instantes.')
    } finally {
      setPending(false)
    }
  }

  const retryButton = (label: string = 'Tentar sincronizar de novo') => (
    <button
      type="button"
      onClick={retrySync}
      disabled={pending}
      aria-busy={pending}
      className="mt-3 rounded-md bg-red-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? 'Sincronizando…' : label}
    </button>
  )

  if (!enabled) {
    return (
      <div className="rounded-lg border border-zinc-300 bg-white p-4">
        <p className="text-sm font-bold text-zinc-800">Instagram desativado</p>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Os posts do Instagram não aparecem no board enquanto o feed estiver desativado.
        </p>
      </div>
    )
  }

  if (!configured) {
    return (
      <div className="rounded-lg border border-zinc-300 bg-white p-4">
        <p className="text-sm font-bold text-zinc-800">Instagram ainda não configurado</p>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Informe o token de acesso e o ID da conta para publicar posts do Instagram na home. Sem
          configuração, o board funciona com artigos e YouTube.
        </p>
      </div>
    )
  }

  if (failureMessage) {
    return (
      <div className="rounded-lg border border-red-300 bg-red-50 p-4" aria-live="polite">
        <p className="text-sm font-bold text-red-800">Falha na última sincronização</p>
        <p className="mt-1 max-w-2xl text-sm text-red-700">{failureMessage}</p>
        {requestError ? <p className="mt-2 text-sm text-red-700">{requestError}</p> : null}
        {retryButton()}
      </div>
    )
  }

  if (lastSyncAt) {
    return (
      <div className="rounded-lg border border-zinc-300 bg-white p-4">
        <p className="text-sm font-bold text-zinc-800">
          Sincronizado · {formatSyncTime(lastSyncAt)}
          {postCount !== undefined ? ` · ${postCountLabel(postCount)}` : ''}
        </p>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">
          Próxima atualização automática em ~5 min.{' '}
          {postCount !== undefined
            ? `Os ${postCountLabel(postCount)} mais recentes estão no board "Acompanhe de perto" da home.`
            : 'Os posts mais recentes estão no board "Acompanhe de perto" da home.'}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-zinc-300 bg-white p-4" aria-live="polite">
      <p className="text-sm font-bold text-zinc-800">Aguardando a primeira sincronização</p>
      <p className="mt-1 max-w-2xl text-sm text-zinc-500">
        Clique em &quot;Tentar sincronizar&quot; para buscar os posts do Instagram agora, ou aguarde
        a próxima atualização automática.
      </p>
      {requestError ? <p className="mt-2 text-sm text-red-700">{requestError}</p> : null}
      {retryButton('Tentar sincronizar')}
    </div>
  )
}
