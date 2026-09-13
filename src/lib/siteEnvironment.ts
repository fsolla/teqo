/**
 * Staging detection for the public site (OPS103).
 *
 * Staging runs the same build with
 * `NEXT_PUBLIC_SITE_URL=https://staging.jorgesolla1313.com.br` — anything
 * served under a `staging.` hostname must stay out of search indexes.
 * Client-safe: no Payload/Next imports; `isStagingSite` reads the public
 * origin that the build already carries.
 */

/** Whether a public origin belongs to a staging deployment. */
export function isStagingSiteUrl(url: string | null | undefined): boolean {
  if (!url) return false

  try {
    return new URL(url).hostname.startsWith('staging.')
  } catch {
    return false
  }
}

/** Whether THIS build is the staging deployment (reads the public origin). */
export function isStagingSite(): boolean {
  return isStagingSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
}
