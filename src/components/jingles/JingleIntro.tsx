/**
 * S21 — the jingles hero (artefato: cena 01 desktop / cena 02 mobile): cream
 * band with the decorative blobs, the eyebrow and the "um por vez" reassurance.
 * Copy differs per breakpoint in the artefato, so each state keeps its literal.
 */
const MusicNoteIcon = () => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    className="h-4 w-4 flex-none text-(--pt-red) sm:h-5 sm:w-5"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
  >
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
)

export const JingleIntro = () => (
  <section
    aria-labelledby="jingles-title"
    className="relative overflow-hidden bg-(--campaign-cream) px-5 pt-9 pb-8 sm:px-8 sm:pt-16 sm:pb-12"
  >
    <div
      aria-hidden="true"
      className="absolute -top-14 -right-14 h-40 w-40 rounded-full bg-[#ffe607]/60 sm:-top-32 sm:-right-24 sm:h-72 sm:w-72 sm:bg-[#ffe607]/55"
    />
    <div
      aria-hidden="true"
      className="absolute top-16 -left-28 hidden h-60 w-60 rounded-full bg-[#184e92]/8 sm:block"
    />

    <div className="relative mx-auto max-w-6xl">
      <p className="m-0 font-[family-name:var(--font-exo2)] text-[10px] font-black tracking-[0.14em] text-(--pt-red) uppercase sm:text-xs">
        A trilha da nossa caminhada
      </p>

      <div className="mt-2 sm:mt-3 sm:grid sm:grid-cols-[1fr_auto] sm:items-end sm:gap-10">
        <div>
          <h1
            id="jingles-title"
            className="m-0 max-w-2xl text-left font-[family-name:var(--font-exo2)] text-[34px] leading-[1] font-black tracking-[-0.04em] text-black sm:text-[52px] sm:leading-[0.98]"
          >
            Jingles de
            <br className="sm:hidden" /> Jorge Solla
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-6 text-black/70 sm:mt-5 sm:text-[17px] sm:leading-7">
            <span className="sm:hidden">
              Dê o play para ouvir aqui. Se quiser levar, baixe o MP3.
            </span>
            <span className="hidden sm:inline">
              Escolha um jingle, dê o play e escute aqui mesmo. Para levar com você, baixe o MP3.
            </span>
          </p>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs font-bold text-black/60 sm:mt-0 sm:mb-1 sm:gap-3 sm:rounded-xl sm:border sm:border-black/10 sm:bg-white/75 sm:px-4 sm:py-3 sm:text-sm sm:font-normal sm:text-black/65 sm:backdrop-blur">
          <MusicNoteIcon />
          <span className="sm:hidden">Um jingle toca por vez.</span>
          <span className="hidden sm:block">
            <strong className="text-black">Um por vez.</strong>
            <br />
            Ao tocar outro, o anterior para.
          </span>
        </div>
      </div>
    </div>
  </section>
)
