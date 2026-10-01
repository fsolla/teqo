/**
 * S27 — the loading state of the Central (artefato: cena 05): the skeleton
 * shape of the board, so a slow connection sees the page it is about to get.
 * S45 — the vertical board shape (4 columns from `lg`; the dominant 9:16 video
 * slot, an approximation of the mixed board) with the media edge-to-edge like
 * the real card.
 */
export default function ConteudosLoading() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8">
      <div className="h-44 animate-pulse rounded-xl bg-(--campaign-band) motion-reduce:animate-none" />
      <div className="mt-9 grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <div
            key={index}
            className="overflow-hidden rounded-[14px] border border-(--campaign-line) bg-white"
          >
            <div className="aspect-[9/16] animate-pulse bg-(--campaign-band) motion-reduce:animate-none" />
            <div className="p-4">
              <div className="h-5 w-3/4 animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              <div className="mt-3 h-4 w-full animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-11 animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
                <div className="h-11 animate-pulse rounded bg-(--campaign-band) motion-reduce:animate-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
