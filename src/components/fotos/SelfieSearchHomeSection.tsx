import { Check, ChevronRight, Images, ShieldCheck, Smartphone, Sparkles } from 'lucide-react'
import Link from 'next/link'

import {
  ARCHIVE_PHOTO_ALBUM_ENTRY_PATH,
  ARCHIVE_PHOTO_ALBUM_PATH,
} from '@/lib/archivePhotoPublicCatalog'

import { ARCHIVE_PHOTO_FOCUS, ARCHIVE_PHOTO_PRIMARY_BUTTON } from './archivePhotoClasses'

/** `.assurance-mark` of the artifact: azure surface with the yellow radial glow. */
const ASSURANCE_SURFACE =
  'rounded-2xl border border-[#184e92]/15 bg-[radial-gradient(circle_at_76%_18%,rgb(255_230_7/66%)_0_8%,transparent_8.5%),linear-gradient(145deg,#f9faff_0%,#eef4fb_100%)]'

/**
 * C243 — the selfie-search section of the public campaign homepage (artefato:
 * `busca-selfie-secao-home-ui-design.html`, cenas 01/02). It only presents and
 * links: no selfie capture, no engine, no archive photos and no counters on the
 * home — the sensitive experience starts at `/fotos/encontre`. Rendered by the
 * homepage only while the search is open (album published + flag +
 * approved photos), so a closed search leaves no dead CTA.
 */
const ASSURANCE_ITEMS = [
  { icon: Smartphone, label: 'Processamento no aparelho' },
  { icon: Images, label: 'Só o acervo público aprovado' },
  { icon: ShieldCheck, label: 'Saída do índice a qualquer momento' },
] as const

export const SelfieSearchHomeSection = () => (
  <section
    aria-labelledby="selfie-home-title"
    data-home-section="selfie-search"
    className="relative overflow-hidden border-b border-(--campaign-line) bg-(--campaign-cream)"
  >
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -top-14 -right-14 size-40 rounded-full bg-(--pt-yellow)/45 sm:-top-24 sm:-right-20 sm:size-64"
    />
    <div
      aria-hidden="true"
      className="pointer-events-none absolute -bottom-32 left-[36%] hidden size-64 rounded-full bg-(--pt-red)/8 sm:block"
    />

    <div className="relative mx-auto grid w-full max-w-[1160px] grid-cols-1 items-center gap-8 px-5 py-12 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,.9fr)] lg:gap-16">
      <div className="max-w-[620px]">
        <p className="campaign-section-eyebrow m-0 font-black tracking-[0.1em] text-(--pt-red) uppercase">
          Fotos da nossa caminhada
        </p>
        <h2
          id="selfie-home-title"
          className="campaign-section-title display m-0 mt-2 max-w-[560px] border-0 p-0 text-[30px]! leading-[1.02]! font-black tracking-[-0.03em] text-balance lg:text-[38px]!"
        >
          Encontre você nas fotos
        </h2>
        <p className="campaign-section-copy mt-4 max-w-[600px] text-(--campaign-muted)">
          <span className="sm:hidden">
            Use uma selfie sua na página da busca para procurar as fotos públicas aprovadas em que
            você aparece.
          </span>
          <span className="hidden sm:inline">
            Use uma selfie sua na página da busca para procurar, entre as fotos públicas aprovadas,
            aquelas em que você aparece.
          </span>
        </p>

        <div className="mt-5 hidden max-w-[610px] items-start gap-3 text-sm leading-6 sm:flex">
          <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-[#184e92] text-white">
            <ShieldCheck aria-hidden="true" className="size-4" strokeWidth={2} />
          </span>
          <p className="m-0 text-[#365472]">
            <b className="text-[#143c70]">A selfie não sai do seu aparelho.</b> A busca cobre o
            índice anônimo do acervo aprovado, e você pode retirar seu rosto quando quiser.
          </p>
        </div>

        <div className="mt-6 hidden flex-wrap items-center gap-x-6 gap-y-2 sm:flex">
          <Link
            href={ARCHIVE_PHOTO_ALBUM_ENTRY_PATH}
            className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} shrink-0`}
          >
            Encontrar minhas fotos
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href={ARCHIVE_PHOTO_ALBUM_PATH}
            className={`inline-flex min-h-11 items-center justify-center gap-1.5 rounded-md px-2 text-sm font-extrabold text-(--pt-red) underline underline-offset-4 hover:text-[#741414] ${ARCHIVE_PHOTO_FOCUS}`}
          >
            Ver o álbum
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className={`mt-6 p-4 sm:hidden ${ASSURANCE_SURFACE}`}>
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#184e92] text-white">
              <ShieldCheck aria-hidden="true" className="size-5" strokeWidth={2} />
            </span>
            <div>
              <p className="text-sm font-extrabold text-[#143c70]">Sua selfie fica no aparelho</p>
              <p className="mt-1 text-xs leading-5 text-[#365472]">
                A selfie não sai deste aparelho. A busca cobre o acervo aprovado, e você pode
                retirar seu rosto do índice quando quiser.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:mt-0 sm:hidden">
          <Link
            href={ARCHIVE_PHOTO_ALBUM_ENTRY_PATH}
            className={`${ARCHIVE_PHOTO_PRIMARY_BUTTON} w-full`}
          >
            Encontrar minhas fotos
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
          <Link
            href={ARCHIVE_PHOTO_ALBUM_PATH}
            className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-md px-2 text-sm font-extrabold text-(--pt-red) underline underline-offset-4 hover:text-[#741414] ${ARCHIVE_PHOTO_FOCUS}`}
          >
            Ver o álbum
            <ChevronRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>

      <div className={`relative hidden overflow-hidden p-6 lg:block ${ASSURANCE_SURFACE}`}>
        <span
          aria-hidden="true"
          className="absolute top-5 right-5 grid size-12 place-items-center rounded-full bg-white text-[#184e92] shadow-[0_8px_28px_rgb(24_78_146/12%)]"
        >
          <Sparkles aria-hidden="true" className="size-6" strokeWidth={2} />
        </span>
        <p className="max-w-[250px] font-[family-name:var(--font-exo2)] text-xl leading-tight font-black text-[#143c70]">
          Sua imagem fica com você. O controle também.
        </p>
        <ul className="mt-7 grid list-none gap-0 p-0">
          {ASSURANCE_ITEMS.map(({ icon: Icon, label }, index) => (
            <li
              key={label}
              className={`flex items-center gap-3 border-[#184e92]/12 py-4 ${
                index === ASSURANCE_ITEMS.length - 1 ? 'border-y' : 'border-t'
              }`}
            >
              <Icon aria-hidden="true" className="size-5 shrink-0 text-[#184e92]" strokeWidth={2} />
              <span className="text-sm font-bold text-[#143c70]">{label}</span>
              <Check aria-hidden="true" className="ml-auto size-4 text-[#184e92]" strokeWidth={2} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  </section>
)
