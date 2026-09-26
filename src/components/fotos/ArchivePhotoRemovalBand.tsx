import { ARCHIVE_PHOTO_SECONDARY_BUTTON } from './archivePhotoClasses'

/**
 * C233 — the removal channel at the foot of the album (artefato: cena 05): a
 * person who appears in a photo asks the human team to take it down. The
 * address is data configured in the album global, never invented here — the
 * band only renders when a valid channel exists (fail-closed).
 */
export const ArchivePhotoRemovalBand = ({ href }: { href: string }) => (
  <section className="bg-white">
    <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-5 px-5 py-7 sm:flex-row sm:items-center sm:px-8">
      <div>
        <p className="font-[family-name:var(--font-exo2)] text-base font-black">
          Aparece em alguma foto?
        </p>
        <p className="mt-1 text-sm text-(--campaign-muted)">
          Se você não quiser que ela fique pública, fale com a equipe responsável pelo acervo.
        </p>
      </div>
      <a href={href} className={`${ARCHIVE_PHOTO_SECONDARY_BUTTON} w-full shrink-0 sm:w-auto`}>
        Pedir remoção de uma foto
      </a>
    </div>
  </section>
)
