import type { ContentPieceViewModel } from '@/lib/contentPiece'

/** Wire contract of `POST .../conteudos/enviar` (C211) — raw-body upload. */
export type ContentPieceUploadResponse =
  | { status: 'success'; piece: ContentPieceViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../conteudos/link` (C211) — add by link. */
export type ContentPieceLinkResponse =
  | { status: 'success'; piece: ContentPieceViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../conteudos/status` (C211) — status poll. */
export type ContentPieceStatusResponse =
  | { status: 'success'; pieces: ContentPieceViewModel[] }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../conteudos/[id]/retry` (C211). */
export type ContentPieceRetryResponse =
  | { status: 'success'; piece: ContentPieceViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../conteudos/[id]/publicacao` (C211) — kill switch. */
export type ContentPiecePublicationResponse =
  | { status: 'success'; piece: ContentPieceViewModel }
  | { status: 'error'; message: string }

/** Wire contract of `POST .../conteudos/[id]/arquivo` (C211) — attach original. */
export type ContentPieceAttachResponse =
  | { status: 'success'; piece: ContentPieceViewModel }
  | { status: 'error'; message: string }
