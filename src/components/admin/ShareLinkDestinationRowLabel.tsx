'use client'

import { useRowLabel } from '@payloadcms/ui'

type ShareLinkDestinationRow = { label?: string | null; live?: boolean | null }

/**
 * S29 — array row header of the destination pool (design artefato cena 05):
 * shows the row number, the registered label (`01 · Google Meet`) and a "no ar"
 * marker on the destination that is on air, so the team finds it without
 * opening every row. Read-only: it only reads the row data from the form
 * context, never writes it. The row container itself is native Payload chrome
 * (no per-row styling hook), so the marker lives in the header.
 */
export const ShareLinkDestinationRowLabel = () => {
  const { data, rowNumber } = useRowLabel<ShareLinkDestinationRow>()
  const name = data?.label?.trim() || 'Destino'
  const index = String((rowNumber ?? 0) + 1).padStart(2, '0')

  return (
    <span style={{ alignItems: 'center', display: 'inline-flex', gap: 8 }}>
      {`${index} · ${name}`}
      {data?.live ? (
        <span
          style={{
            background: '#333',
            borderRadius: 999,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.04em',
            lineHeight: 1.6,
            padding: '1px 8px',
            textTransform: 'uppercase',
          }}
        >
          no ar
        </span>
      ) : null}
    </span>
  )
}
