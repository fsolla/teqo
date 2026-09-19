/**
 * S19 — the share-link page exists for the crawler's card and for the instant
 * handoff. It renders no chrome and no visible interstice: the meta refresh
 * covers clients without JS, and the inline script navigates before paint. The
 * destination is JSON-escaped so a URL containing `</script>` cannot break out.
 */
export const ShareLinkRedirect = ({ destination }: { destination: string }) => (
  <>
    <meta httpEquiv="refresh" content={`0;url=${destination}`} />
    <script
      dangerouslySetInnerHTML={{
        __html: `window.location.replace(${JSON.stringify(destination).replace(/</g, '\\u003c')})`,
      }}
    />
  </>
)
