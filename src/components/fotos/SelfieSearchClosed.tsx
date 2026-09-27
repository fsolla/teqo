import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { ARCHIVE_PHOTO_ALBUM_PATH } from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_SECONDARY_BUTTON } from './archivePhotoClasses'

/**
 * C234 — the fail-closed state of the selfie search (artefato: cena 07): the
 * query Consent is not configured, so the flow never opens and no selfie can be
 * captured or processed. Server-rendered on `/fotos/encontre` and reused by the
 * client flow when the flag/consent flips mid-session.
 */
export const SelfieSearchClosed = () => (
  <section className="mx-auto w-full max-w-[920px] rounded-2xl border border-amber-300 bg-amber-50 px-6 py-10 text-center">
    <div className="mx-auto grid size-12 place-items-center rounded-full border border-amber-300 bg-white text-amber-800">
      <TriangleAlert aria-hidden="true" className="size-6" strokeWidth={2} />
    </div>
    <p className="mt-5 text-xs font-black tracking-[0.1em] text-amber-800 uppercase">
      Proteção de dados
    </p>
    <h2 className="mt-2 border-0 pb-0 font-[family-name:var(--font-exo2)] text-2xl font-black text-amber-950">
      A busca por selfie está indisponível
    </h2>
    <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-amber-900">
      O texto de consentimento necessário ainda não está configurado. Por segurança, não podemos
      receber nem processar sua selfie agora.
    </p>
    <p className="mx-auto mt-3 max-w-lg text-sm font-bold text-amber-950">
      Nenhuma imagem foi capturada ou enviada.
    </p>
    <Link href={ARCHIVE_PHOTO_ALBUM_PATH} className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} mt-6`}>
      Voltar ao álbum de fotos
    </Link>
  </section>
)
