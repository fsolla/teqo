/**
 * C226 — pure rules of the content piece frame: the deterministic
 * `contentMedia` cache name, the ffmpeg still command and the two limits of the
 * self-heal. No I/O and no `server-only`: the frame job, the public route and
 * the unit tests share this module, so the "which second of the video" literal
 * lives in one place.
 *
 * The frame is a derived artifact of the archived file, never a second copy of
 * it: it lives in the PRIVATE `contentMedia` collection (the public `media` is
 * anonymous-read by contract) and is served only by the published-slug route.
 * A piece that is unpublished therefore stops exposing its frame exactly like it
 * stops exposing the video — by construction, not by discipline.
 *
 * C182 (the acervo list frame) is the shape this mirrors — pure rules here, I/O
 * in `utilities/` — but the two previews are different domains with different
 * collections, gates and reading contracts, so nothing is shared but the mold.
 * The public path is not here: the catalogue module owns the Central's URL
 * vocabulary (`contentPieceFramePath`, next to `contentPieceMediaPath`).
 */

/**
 * The still is taken one second in, not at zero: campaign footage almost always
 * opens on a leader/fade to black, and a valid BLACK jpeg is indistinguishable
 * from the neutral "frame indisponível" slot the design uses to say "there is
 * no frame here" — the first frame would destroy the very signal the fallback
 * depends on. The decision stays deterministic (no editorial moment is ever
 * promised) and costs exactly the same single `-ss`.
 *
 * The retry at zero covers what a 1s seek cannot reach: a clip shorter than a
 * second, a lying header, a stream with no keyframe there. One retry, no loop —
 * after that the piece keeps the neutral slot.
 */
export const CONTENT_PIECE_FRAME_SEEK_ATTEMPTS = [1, 0] as const

/**
 * C226 — a frame request may wait this long before answering the neutral slot,
 * while the generation keeps running (the same `after` heal as the C182 poster).
 * Shorter than the acervo's 20s on purpose: here the heal can mean downloading
 * the whole video, and the fallback is a designed state, not an error.
 */
export const CONTENT_PIECE_FRAME_WAIT_MS = 5_000

/**
 * Ceiling of the self-heal: the route has to download the archived file to
 * extract a still, and a full-length recording is not worth a visitor's
 * connection. The job path pays none of this (the file is already on disk), so
 * the cap is a rule about the cost of I/O, never about eligibility.
 */
export const CONTENT_PIECE_FRAME_MAX_SOURCE_BYTES = 256 * 1024 * 1024

/** The single ffmpeg pass writes a JPEG — no `sharp` step, no second encoder. */
export const CONTENT_PIECE_FRAME_MIME_TYPE = 'image/jpeg'

/** Deterministic `contentMedia` filename: the cache key and the idempotence key. */
export const contentPieceFrameFilename = (pieceId: number): string =>
  `content-piece-frame-${pieceId}.jpg`

/** `contentMedia.alt` is required, so the derived row carries a real description. */
export const contentPieceFrameMediaAlt = (title: string): string => `Frame do vídeo «${title}»`

/**
 * The self-heal only touches a source small enough to be worth downloading
 * (256 MB is a size, not a time — `CONTENT_PIECE_FRAME_WAIT_MS` is the other
 * budget). An unknown size is allowed through: the piece row has been ingested
 * already, so the missing number is a projection limit, not a licence to skip.
 */
export const contentPieceFrameSizeAllowed = (filesize?: number | null): boolean =>
  typeof filesize !== 'number' || !Number.isFinite(filesize)
    ? true
    : filesize <= CONTENT_PIECE_FRAME_MAX_SOURCE_BYTES

type ContentPieceFrameFfmpegInput = {
  inputPath: string
  outputPath: string
  atSeconds: number
}

/**
 * One still at `atSeconds`: `-ss` before `-i` seeks fast and `-frames:v 1` takes
 * a single frame; `scale=640:-2` keeps it small (the public piece page renders
 * the slot at ~600px, `object-cover` crops the rest). JPEG in a single ffmpeg
 * pass — no `sharp` step, and `image/jpeg` is already inline-safe in the private
 * media contract. Args as an array — never a shell string.
 */
export const buildContentPieceFrameFfmpegArgs = ({
  inputPath,
  outputPath,
  atSeconds,
}: ContentPieceFrameFfmpegInput): string[] => {
  const at = Math.max(0, Math.round(atSeconds))
  return [
    '-nostdin',
    '-hide_banner',
    '-y',
    '-ss',
    String(at),
    '-i',
    inputPath,
    '-frames:v',
    '1',
    '-vf',
    'scale=640:-2',
    '-q:v',
    '3',
    '-an',
    outputPath,
  ]
}
