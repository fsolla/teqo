import Link from 'next/link'

/**
 * S21 — honest access state with zero published jingles (artefato: cena 03):
 * the page still answers 200, discovery is gone (header badge and footer link)
 * and the copy never promises releases.
 */
export const JingleEmptyState = () => (
  <section className="bg-(--campaign-cream) px-6 py-20 text-center">
    <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-(--campaign-band) text-(--pt-red)">
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-9 w-9"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
        <path d="M3 3l18 18" />
      </svg>
    </div>
    <p className="mt-7 font-[family-name:var(--font-exo2)] text-xs font-black tracking-[0.14em] text-(--pt-red) uppercase">
      Jingles
    </p>
    <h1 className="mx-auto mt-2 max-w-2xl text-center font-[family-name:var(--font-exo2)] text-4xl font-black tracking-[-0.035em] text-wrap">
      Nenhum jingle publicado por enquanto
    </h1>
    <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-(--campaign-muted)">
      Quando houver jingles disponíveis, eles aparecerão nesta página para ouvir e baixar.
    </p>
    <p className="mt-8 text-sm text-black/55">Você pode voltar ao site de Jorge Solla.</p>
    <Link
      href="/"
      className="mt-3 inline-flex min-h-11 items-center rounded-[10px] border-2 border-(--pt-red) px-5 font-[family-name:var(--font-exo2)] font-extrabold text-(--pt-red) no-underline hover:bg-(--pt-red) hover:text-white focus-visible:shadow-[0_0_0_2px_var(--pt-red-dark)] focus-visible:outline-[3px] focus-visible:outline-offset-[3px] focus-visible:outline-(--pt-yellow)"
    >
      Voltar ao início
    </Link>
  </section>
)
