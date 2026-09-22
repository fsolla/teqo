/**
 * S21 — the jingles hero (artefato: cena 01 desktop / cena 02 mobile): cream
 * band with the decorative blobs, the eyebrow and the "um por vez" reassurance.
 * Copy differs per breakpoint in the artefato, so each state keeps its literal.
 */

export const JingleIntro = () => (
  <section
    aria-labelledby="jingles-title"
    className="relative overflow-hidden bg-(--campaign-cream) px-5 pt-9 pb-6 sm:px-8 sm:pt-16 sm:pb-12"
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
            <span className="hidden sm:inline">
              Escolha um jingle, dê o play e escute aqui mesmo. Para levar com você, baixe o MP3.
            </span>
          </p>
        </div>
      </div>
    </div>
  </section>
)
