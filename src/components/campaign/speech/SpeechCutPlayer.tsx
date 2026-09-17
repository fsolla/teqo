import type { SpeechCutLibraryItemViewModel } from '@/lib/speechCut'
import { youtubeThumbnailUrl } from '@/lib/speechVod'

/**
 * C168 — the cut is a plain MP4 (never the YouTube/VOD source): the same
 * `<video>` the public page plays, with the session cover as poster when known.
 */
export const SpeechCutPlayer = ({ cut }: { cut: SpeechCutLibraryItemViewModel }) => {
  if (!cut.mediaUrl) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-xl border bg-muted/40 text-sm text-muted-foreground">
        O arquivo do corte ainda não está disponível.
      </div>
    )
  }

  const poster = youtubeThumbnailUrl(cut.youtubeVideoId) ?? undefined

  return (
    <video
      controls
      preload="metadata"
      playsInline
      poster={poster}
      src={cut.mediaUrl}
      className="aspect-video w-full rounded-xl border bg-black"
    />
  )
}
