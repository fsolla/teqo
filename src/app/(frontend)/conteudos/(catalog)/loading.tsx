/**
 * S27 — the loading state of the Central (artefato: cena 05): the skeleton
 * shape of the board, so a slow connection sees the page it is about to get.
 */
export default function ConteudosLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="h-44 animate-pulse rounded-xl bg-(--campaign-band)" />
      <div className="mt-9 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[14px] border border-(--campaign-line) bg-white p-4"
          >
            <div className="h-44 animate-pulse rounded-xl bg-(--campaign-band)" />
            <div className="mt-4 h-5 w-3/4 animate-pulse rounded bg-(--campaign-band)" />
            <div className="mt-3 h-4 w-full animate-pulse rounded bg-(--campaign-band)" />
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="h-11 animate-pulse rounded bg-(--campaign-band)" />
              <div className="h-11 animate-pulse rounded bg-(--campaign-band)" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
