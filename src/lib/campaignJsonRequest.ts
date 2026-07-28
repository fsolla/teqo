/**
 * Transport half of the list cells' quick edits: the preamble every control
 * repeated around `fetch` (same-origin credentials, JSON headers, the cast of
 * the discriminated response). Deliberately knows nothing about revert, retry
 * or debounce — that is `useCampaignCellAutosave`'s, or the caller's.
 *
 * `ok` travels next to the payload because a route can answer a real body with
 * a non-200 status (`engagement-level` returns its `blocked` state as 409), so
 * the two are not the same question.
 */
export const postCampaignJson = async <TResponse>(
  url: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<{ ok: boolean; payload: TResponse }> => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    credentials: 'same-origin',
    signal,
    body: JSON.stringify(body),
  })

  return { ok: response.ok, payload: (await response.json()) as TResponse }
}
