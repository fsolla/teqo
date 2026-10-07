/**
 * Reel "Sua colinha para 2026" — the script data and the pure timeline of the
 * WhatsApp-style chat reel (a creative piece inspired by the PT-MG "Seu time"
 * reel of dep_padrejoao; the chat walks the voter through the urna order:
 * federal → estadual → senador 1ª/2ª vaga → governador → presidente).
 *
 * No DOM, no ffmpeg, no browser: every constant here is data, and
 * `buildColinhaTimeline` is the deterministic map beat → [atMs, endsAtMs]. The
 * template (`colinhaReelTemplate.mjs`) renders one state per `t`, and the
 * builder (`build-colinha-reel.mjs`) walks `frameCount(totalMs, fps)` — the
 * three share this module, so the script is the single source of the reel.
 *
 * Candidate photos and the star badge live in
 * `scripts/reels/assets/<slug>/` (provenance in the folder README); the
 * official arts (colinha slip, dobradinha santinho) come from `public/`.
 */

export const COLINHA_REEL = {
  slug: 'colinha-time-1313',
  title: 'Sua colinha para 2026 — Time 1313',
  chatTitle: 'Time 1313',
  chatHour: '18:30',
  /** Cover contract of the private library (C195): alt text of the cover art. */
  coverAlt:
    'Conversa no WhatsApp do "Time 1313" montando a colinha de votação: Jorge Solla 1313, Julio Pinheiro 13999, Jaques Wagner 130, Rui Costa 133, Jerônimo 13 e Lula 13.',
  /** The state + election line inside every candidate card. */
  cardState: 'BA · ELEIÇÕES 2026',
  cardParty: 'PT',
  fps: 30,
}

/**
 * The ticket in urna order — the same order the chat asks and the same rows of
 * the official colinha art (`public/cards/modelo-colinha.jpeg`). `ask` is the
 * office as it is spoken in the chat; `office` is the printed label of the
 * card; `number` is the ballot number (digits only). `photo` is a file inside
 * `scripts/reels/assets/<slug>/`.
 */
export const COLINHA_CANDIDATES = [
  {
    id: 'solla',
    ask: 'Deputado Federal',
    office: 'DEPUTADO FEDERAL',
    name: 'JORGE SOLLA',
    number: '1313',
    photo: 'solla.webp',
    /** Card framing: the master is framed shoulder-up from the head down. */
    photoZoom: 1.22,
    /** End screen: the group figure, the slip row and the red-band logo. */
    figure: { cx: 177.5, cy: 235, rx: 67.5, ry: 107.5 },
    row: { top: 458, height: 71 },
    logo: { left: 14, top: 316, width: 158 },
  },
  {
    id: 'julio',
    ask: 'Deputado Estadual',
    office: 'DEPUTADO ESTADUAL',
    name: 'JULIO PINHEIRO',
    number: '13999',
    photo: 'julio.webp',
    photoZoom: 1.18,
    photoShiftY: 3.5,
    figure: { cx: 355, cy: 232.5, rx: 67.5, ry: 107.5 },
    row: { top: 542, height: 59 },
    logo: { left: 185, top: 320, width: 150 },
  },
  {
    id: 'wagner',
    ask: 'Senador (1ª vaga)',
    office: 'SENADOR (1ª VAGA)',
    name: 'JAQUES WAGNER',
    number: '130',
    photo: 'wagner.webp',
    photoZoom: 1.05,
    photoShiftY: 2,
    figure: { cx: 500, cy: 245, rx: 50, ry: 100 },
    row: { top: 607, height: 71 },
    logo: { left: 464, top: 374, width: 72 },
  },
  {
    id: 'rui',
    ask: 'Senador (2ª vaga)',
    office: 'SENADOR (2ª VAGA)',
    name: 'RUI COSTA',
    number: '133',
    photo: 'rui.webp',
    photoZoom: 1.05,
    photoShiftY: 2,
    figure: { cx: 440, cy: 240, rx: 57.5, ry: 102.5 },
    row: { top: 694, height: 67 },
    logo: { left: 386, top: 370, width: 72 },
  },
  {
    id: 'jeronimo',
    ask: 'Governador',
    office: 'GOVERNADOR',
    name: 'JERÔNIMO',
    number: '13',
    photo: 'jeronimo.webp',
    photoZoom: 1.05,
    photoShiftY: 2,
    figure: { cx: 35, cy: 250, rx: 45, ry: 100 },
    row: { top: 771, height: 68 },
    logo: { left: 464, top: 321, width: 72 },
  },
  {
    id: 'lula',
    ask: 'Presidente',
    office: 'PRESIDENTE',
    name: 'LULA',
    number: '13',
    photo: 'lula.webp',
    photoZoom: 1.12,
    photoShiftY: 3.2,
    figure: { cx: 97.5, cy: 235, rx: 62.5, ry: 107.5 },
    row: { top: 847, height: 71 },
    logo: { left: 386, top: 318, width: 72 },
  },
]

/**
 * The "sem estadual" step: instead of one ballot number, the card tells the
 * voter to pick a state deputy from Lula's team — no party is named.
 */
export const COLINHA_GENERIC_ESTADUAL = {
  id: 'estadual-livre',
  ask: 'Deputado Estadual',
  office: 'DEPUTADO ESTADUAL',
  /** The card headline: no name, the instruction itself. */
  name: 'DO TIME DO LULA',
  number: '',
  generic: true,
  /** The chat beat where the voter asks who is on Lula's team. */
  voterText: 'e quem é do time do Lula?',
  figure: { cx: 355, cy: 232.5, rx: 67.5, ry: 107.5 },
  row: { top: 542, height: 59 },
  logo: { left: 185, top: 320, width: 150 },
}

/**
 * The urna order of the chat, derived from the candidates (the reel never
 * repeats the ticket): federal (4 digits) → estadual (5) → two senators (3+3)
 * → governador (2) → presidente (2).
 */
export const COLINHA_URNA_ORDER = COLINHA_CANDIDATES.map((candidate) => candidate.id)

/**
 * Holding times of the chat beats (ms). The first ask is the full question and
 * every following ask is the short "e pra …?"; the holds follow the reference
 * reel rhythm (each candidate cycle ≈ 3.2 s).
 */
export const COLINHA_BEAT_DURATIONS = {
  hook: 1200,
  typing: 650,
  reply: 600,
  ask: 700,
  number: 500,
  card: 1950,
  closingTyping: 650,
  closing: 1250,
  /** Screen flip transition between the chat and the end screen. */
  flip: 420,
  /** The end screen: flip in, then one reveal per candidate, then the slogan. */
  endHold: 400,
  reveal: 700,
  brand: 2200,
  /** The static finale: the slip arrives complete and holds. */
  staticHold: 5000,
}

/**
 * The end screen of the reel — the official colinha art assembles itself: one
 * reveal beat per candidate (their figure in the sky band, their row in the
 * slip and their logo in the red band), then the "Mais Saúde, Mais Futuro"
 * title appears last over the complete slip. Positions are CSS px on the
 * 540×960 stage (the art is measured at 1080×1920 → /2).
 */
export const COLINHA_END = {
  /** The printed title band of the art (revealed last, with the slogan). */
  titleBand: { top: 0, height: 125 },
  /** The group/sky band of the art (kept covered by the composed sky). */
  groupBand: { top: 125, height: 225 },
  /** The red band of the art (its own lockups are covered and redrawn). */
  band: { color: '#e50e2f' },
  /** The white slip rows are masked per candidate before their reveal. */
  rowMask: { left: 100, width: 360 },
}

const candidateById = new Map(COLINHA_CANDIDATES.map((candidate) => [candidate.id, candidate]))

export const getColinhaCandidate = (id) => candidateById.get(id)

/**
 * The chat script: voter beats on the right, assistant beats on the left, one
 * number bubble + one card per candidate, then the closing and the end screen.
 * `finale: 'motion'` assembles the slip candidate by candidate; `finale:
 * 'static'` and `'card'` flip straight into the complete slip and hold — the
 * latter is the site's own personalized-card output.
 *
 * @param {{ finale?: 'motion' | 'static' | 'card', candidates?: typeof COLINHA_CANDIDATES }} [options]
 * @returns {Array<{ id: string, kind: 'voter' | 'assistant' | 'typing' | 'number' | 'card' | 'end' | 'reveal' | 'brand', text?: string, candidateId?: string, screen?: 'colinha', seen?: boolean, durationMs: number, enterMs: number, hideAtMs?: number }>}
 */
export const buildColinhaBeats = ({ finale = 'motion', candidates = COLINHA_CANDIDATES } = {}) => {
  const {
    hook,
    typing,
    reply,
    ask,
    number,
    card,
    closingTyping,
    closing,
    flip,
    endHold,
    reveal,
    brand,
    staticHold,
  } = COLINHA_BEAT_DURATIONS
  const beats = [
    {
      id: 'hook',
      kind: 'voter',
      text: 'oi! me ajuda a montar minha colinha pra 2026?',
      seen: true,
      durationMs: hook,
    },
    { id: 'typing-1', kind: 'typing', durationMs: typing },
    { id: 'reply-1', kind: 'assistant', text: 'claro! vamos na ordem da urna.', durationMs: reply },
  ]

  candidates.forEach((candidate, index) => {
    beats.push({
      id: `ask-${candidate.id}`,
      kind: 'assistant',
      text: index === 0 ? 'pra Deputado Federal, quem você escolheu?' : `e pra ${candidate.ask}?`,
      durationMs: ask,
    })
    if (candidate.generic) {
      // The "sem estadual" step: the voter asks who is on Lula's team and the
      // card instructs them to pick a state deputy from that team.
      beats.push({
        id: `number-${candidate.id}`,
        kind: 'voter',
        text: candidate.voterText,
        seen: true,
        durationMs: number,
      })
    } else {
      beats.push({
        id: `number-${candidate.id}`,
        kind: 'number',
        text: candidate.number,
        candidateId: candidate.id,
        seen: true,
        durationMs: number,
      })
    }
    beats.push({
      id: `card-${candidate.id}`,
      kind: 'card',
      candidateId: candidate.id,
      durationMs: card,
    })
  })

  beats.push({ id: 'typing-end', kind: 'typing', durationMs: closingTyping })
  beats.push({
    id: 'closing',
    kind: 'assistant',
    text: 'prontinho! colinha completa. bom voto! ✅',
    durationMs: closing,
  })
  beats.push({
    id: 'end-colinha',
    kind: 'end',
    screen: 'colinha',
    durationMs: flip * 2 + (finale === 'motion' ? endHold : staticHold),
  })
  if (finale !== 'motion') {
    // The static/card finales: the slip arrives complete and holds.
    beats.push({ id: 'brand', kind: 'brand', durationMs: 1 })
  } else {
    for (const candidate of candidates) {
      beats.push({
        id: `reveal-${candidate.id}`,
        kind: 'reveal',
        candidateId: candidate.id,
        durationMs: reveal,
      })
    }
    beats.push({ id: 'brand', kind: 'brand', durationMs: brand })
  }

  return beats.map((beat) => ({
    ...beat,
    durationMs: beat.durationMs,
    /** Entrance window of the beat (the renderer eases over it). */
    enterMs: beat.kind === 'end' ? flip * 2 : 260,
  }))
}

/**
 * Deterministic timeline: beats in order, each starting where the previous
 * ends. `totalMs` is the reel duration; `frameCount` is what the builder
 * screenshots at `fps` (the last frame is held for one frame slot).
 *
 * @param {ReturnType<typeof buildColinhaBeats>} [beats]
 * @param {number} [fps]
 */
export const buildColinhaTimeline = (beats = buildColinhaBeats(), fps = COLINHA_REEL.fps) => {
  let atMs = 0
  const entries = beats.map((beat) => {
    const entry = { ...beat, atMs, endsAtMs: atMs + beat.durationMs }
    atMs = entry.endsAtMs
    return entry
  })
  entries.forEach((entry, index) => {
    const next = entries[index + 1]
    if (entry.kind === 'typing' && next) entry.hideAtMs = next.atMs
  })
  return {
    entries,
    totalMs: atMs,
    fps,
    frameCount: Math.max(1, Math.round((atMs / 1000) * fps)),
    byId: new Map(entries.map((entry) => [entry.id, entry])),
  }
}
