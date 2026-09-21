# Player próprio da Rádio 1313 na home (S25)

Status: rascunho
Atualizado em: 2026-09-21
Issue: #1239
Priority: P2
Impeccable: C — componente novo (player) dentro da seção de som existente da home
Design UI: docs/plans/radio-player-proprio-ui-design.html
Appetite: ~1 dia eng; um outcome verificável — a rádio toca num player próprio, discreto, sem marca zeno, com CTA de compartilhar
Responsável: —

## Intenção

O embed oficial do zeno.fm que o S24 (#1235) montou na home ficou pequeno: o iframe de 150/168px corta título e capa e carrega a marca zeno. O humano quer um player próprio, mais discreto e com a cara da campanha, sobre o mesmo stream (`https://stream.zeno.fm/hys86kx6k16tv`), mais um CTA de compartilhar que manda o link público da rádio no Zeno.

Esta Issue é a **sucessora explícita** do S24: nova evidência de produto reverte os anti-goals dele ("não vira player custom", "não cria framework de consent/CSP"). Planos de Issues `done`/`in-prod` são imutáveis — `docs/plans/radio-embed-direto.md` não é editado nem reaberto; a reversão de propósito fica registrada aqui.

Ganho colateral a registrar com honestidade: o iframe do S24 traz GA `G-2T527NZWVM` + redes de anúncio em todo pageview da home (trade-off assumido lá). Com player próprio + `preload="none"`, nenhum request de terceiro sai antes do gesto de play; a conexão com o stream só acontece ali. Isso **reverte o trade-off para melhor**, mas não promete analytics nem contador — não há dado nosso novo.

## Persona e fluxo

- **Persona / contexto:** visitante e militante que chega pela home no celular (link no WhatsApp, busca, indicação), com pressa e em conexão qualquer.
- **Job principal:** ouvir a Rádio Jorge Solla 1313 num player que parece da campanha e poder mandar o link da rádio para alguém.
- **Fluxo desejado:** abre a home → rola até a seção de som → vê o player discreto "Rádio Jorge Solla 1313" com indicador "Ao vivo" → dá play e ouve (a conexão com o stream começa só agora); se um jingle estiver tocando, ele pausa → toca o "Compartilhar" e escolhe WhatsApp (mensagem pronta) ou copiar link → se o play falhar, vê um estado honesto com link para ouvir no Zeno.
- **Anti-goals de produto:** não redesenha a seção de som nem a grade/`/jingles`; não vira proxy nem player de streaming próprio; não autoplay com som; não busca "tocando agora" nem analytics/contador; não cria consent/CSP novo; não mexe em schema.

### Esboço de fluxo (C)

```text
[visitante na home] → seção de som
→ player próprio: "Rádio Jorge Solla 1313" · [Ao vivo] · [▶] · [Compartilhar]
→ dá play → conecta no stream (sem request de terceiro antes) · toca
   [jingle tocando] → pausa o jingle · [play no jingle] → pausa a rádio
→ "Compartilhar" → WhatsApp (mensagem pronta) | copiar link → feedback
[play falha/estola] → estado de erro + "ouvir no Zeno" + compartilhar (nunca spinner infinito)
[0 jingles] → rádio sozinha (compact) · [N jingles] → grade + "Ver todos" → /jingles
```

### Design UI (C)

- Design UI (gate): `docs/plans/radio-player-proprio-ui-design.html` — cenas: 390 mobile, 1280 desktop, variante compacta (0 jingles) e estados do player (parado, carregando, ao vivo, erro). Capa/arte é NEEDS ASSET: ativo oficial do kit 1313 (`public/campaign-kit/README.md`) ou disco neutro — nunca inventar capa nem usar banco de imagens.

## Objetivo e aceite

- O iframe zeno some da home; o player próprio é a única superfície de rádio da seção, com título fixo "Rádio Jorge Solla 1313" e indicador "Ao vivo" — sem corte de título/capa.
- Só toca com gesto do visitante; com `preload="none"` nenhum request ao stream ou a terceiros acontece antes do play.
- Um áudio por vez na seção de som: play na rádio pausa o jingle em reprodução e vice-versa.
- Compartilhar envia a mensagem literal `Ouça a Rádio Jorge Solla 1313 — https://zeno.fm/radio/jorge-solla-1313/` (WhatsApp + copiar link com feedback), reusando o padrão público.
- Fail-soft: play que falha ou estola vira estado de erro com alternativa honesta (ouvir no Zeno / compartilhar) — nunca spinner infinito.
- Kill switch do S21 e variante compact preservados: 0 jingles → rádio sozinha; com jingles, grade e "Ver todos" seguem abaixo; `/jingles` e o player dos jingles ficam intocados além da exclusividade.
- Home segue estática (leitura única de `getPublishedJingleItems()`, cache tag `jingles`); sem PII nova, sem Consent novo; MetaPixel da home intocado; sem overflow horizontal a 390px e operável por teclado com rótulos acessíveis.

## Dados (intenção)

- **Vou apresentar dados?** Não — **N/A**: nenhum dado nosso é apresentado ou coletado; não há contador de ouvintes, analytics de reprodução nem metadados "tocando agora". A decisão do visitante é ouvir agora, não ler números.
- **Decisões desbloqueadas:** N/A — sem métrica que desbloqueie escolha de ator.
- **Forma:** N/A — sem dado agregado a definir.

## Dados da decisão (literais)

- ID `S25`; slug `radio-player-proprio`; tipo `feature`; Priority `P2`; Impeccable `C`; rota: a home `/` (sem rota nova).
- Stream a tocar: `https://stream.zeno.fm/hys86kx6k16tv` → 302 para CDN `stream-*.surfernetwork.com` com token assinado por request; resposta final `content-type: audio/mpeg`, `icy-name: Jorge Solla 1313`, 128 kbps, 44.1 kHz; **sem headers CORS/ACAO** (playback em `<audio>` funciona; Web Audio/`AnalyserNode` é impossível — fora de escopo).
- Página pública da rádio (destino do compartilhar): `https://zeno.fm/radio/jorge-solla-1313/` (HTTP 200, título "Listen to Jorge Solla 1313 | Zeno.FM").
- Nome exibido fixo: **"Rádio Jorge Solla 1313"** (confirmado pelo `icy-name` do stream). Sem metadado de "tocando agora".
- Mensagem de compartilhamento literal: `Ouça a Rádio Jorge Solla 1313 — https://zeno.fm/radio/jorge-solla-1313/`.
- iframe que sai: `https://zeno.fm/player/jorge-solla-1313/` (moldura 150/168px é o defeito); com ele sai o rastro de terceiros por pageview do S24 — GA `G-2T527NZWVM` + redes de anúncio.
- Design UI (gate): `docs/plans/radio-player-proprio-ui-design.html`.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/jingles/` — `RadioEmbed.tsx` (iframe) é o que sai de cena; `JingleHomeSection.tsx:63` troca a composição; o player novo nasce ao lado, reusando o padrão de `<audio>` já existente em `JingleCards.tsx:92-140` (play exclusivo com `activeId`, `preload="none"`, revert do `play()` rejeitado). CSS: só `.campaign-sound-title` em `styles.css:1158-1164` é da seção; tokens `--campaign-line`/`--campaign-band` (`:184-185`) seguem.
- **Precedente a olhar:** `ContentShareButton.tsx:44-108` + builders `src/lib/contentShare.ts:11-48` + `wa.me` sem destinatário (`src/lib/phone.ts:62-67`) + feedback de cópia (`src/lib/copyFeedback.ts:68`); S24 `docs/plans/radio-embed-direto.md` e S22 `docs/plans/jingles-radio-homepage.md` (histórico; não editar).
- **Risco de acoplamento:** a exclusividade rádio↔jingle precisa de coordenação sem tocar em `/jingles`; os testes pinam o iframe e terão de ser reescritos (`tests/unit/radioEmbed.unit.spec.tsx`, `tests/unit/jingleHomeSection.unit.spec.tsx:42-53`, `tests/e2e/frontend.e2e.spec.ts:560-616`, `tests/e2e/frontendJingles.e2e.spec.ts:248-291`) e a fixture do e2e só stuba o player zeno (`tests/e2e/fixtures/e2eTest.ts:118-129`); `scripts/lib/e2e-affected-manifest.mjs:99-108` mapeia `src/components/jingles` → `frontendJingles`; home estática/cache `jingles`; sem CSP/middleware no caminho.

## Dependências

- Nenhuma dura. S24 = Issue #1235 (entregue 2026-09-20) — sucessora explícita; decisão revertida de propósito, plano imutável, não reabrir. Estação ativa no zeno.fm. Design hi-fi aprovado no gate.

## Fora de escopo

- Visualizador/Web Audio (sem CORS no stream); "tocando agora" via API do Zeno; analytics de reprodução/contador de ouvintes.
- Proxy/stream próprio ou troca de provedor; download da rádio (é stream).
- Consent/CSP/banner de terceiros; migration/schema; qualquer Consent novo.
- Mudanças em `/jingles` e na grade além da coordenação de exclusividade.

## Rabbit holes de produto

- **Virar proxy/CDN do áudio.** Se alguém "só completar": infra de streaming, tokens, cache, uptime. **Corte neste item:** `<audio>` apontando direto para o stream do Zeno.
- **"Tocando agora" e programação.** Se alguém "só completar": API do Zeno, polling, metadado frágil. **Corte:** nome fixo + "Ao vivo".
- **Analytics de ouvintes.** Se alguém "só completar": contador, dashboard, vaidade. **Corte:** a rádio é um play, não um painel.
- **Redesenhar a seção de som inteira.** Se alguém "só completar": copy, headings, hero, grade. **Corte:** só o player e o CTA mudam.
- **Capa inventada ou banco de imagens.** **Corte:** ativo oficial do kit 1313 ou disco neutro.

## Questões em aberto (produto)

- **Acesso a "ouvir no Zeno" fora do erro?** **Opções:** A) só no estado de erro, mantendo o player discreto | B) link persistente ao lado do player. **Recomendação:** A — o CTA de compartilhar já expõe a página da rádio; validar no design.
- **Escopo da exclusividade rádio↔jingle?** **Opções:** A) coordenação só na seção da home | B) coordenação global (inclui `/jingles`). **Recomendação:** A — `/jingles` fica intocado; o mecanismo é da implementação.
- **Forma do controle de compartilhar?** **Opções:** A) popover com WhatsApp + copiar link (padrão dos cards) | B) botão único que abre o WhatsApp. **Recomendação:** A — reusa o padrão público com feedback; design decide a forma visual. _(assumido — validar com produto)_
- **Capa/arte do player?** **Opções:** A) ativo oficial do kit 1313 (`public/campaign-kit/README.md`, ex.: `estrela.png`/`marca-*`) | B) disco neutro. **Recomendação:** A — asset oficial, sem inventar arte. Design resolve (NEEDS ASSET).

## Referências

- GitHub Issue: a registrar (`S25`); S24 = Issue #1235 (entregue; decisão revertida de propósito, não reabrir).
- Design UI (gate): `docs/plans/radio-player-proprio-ui-design.html` (+ assets em `docs/plans/radio-player-proprio-ui-design-assets/` se houver).
- `docs/plans/radio-embed-direto.md`, `docs/plans/jingles-radio-homepage.md` — histórico do embed/facade (não editar).
- `src/components/jingles/RadioEmbed.tsx`, `JingleHomeSection.tsx`, `JingleCards.tsx` — o que sai/encaixa/reusa.
- `src/components/ContentShareButton.tsx`, `src/lib/contentShare.ts`, `src/lib/phone.ts`, `src/lib/copyFeedback.ts` — padrão público de compartilhar.
- `public/campaign-kit/README.md` — dona da marca/ativos.
- `tests/unit/radioEmbed.unit.spec.tsx`, `tests/unit/jingleHomeSection.unit.spec.tsx`, `tests/e2e/frontend.e2e.spec.ts`, `tests/e2e/frontendJingles.e2e.spec.ts`, `tests/e2e/fixtures/e2eTest.ts`, `scripts/lib/e2e-affected-manifest.mjs` — contratos que pinam o iframe.
- `AGENTS.md` — home estática/cache tag `jingles` e postura LGPD.
