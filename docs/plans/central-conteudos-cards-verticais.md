# S45 — Central de Conteúdos — cards verticais no catálogo e na seção da home

Status: rascunho
Atualizado em: 2026-10-01
Issue: #1410
Priority: P1
Impeccable: B — encaixe no slot/card existente, sem rota ou tela nova
Design UI: docs/plans/central-conteudos-cards-verticais-ui-design.html
Appetite: ~1–2 dias eng; um outcome verificável — o vertical aparece inteiro e o horizontal também, no catálogo e na seção da home
Responsável: —

## Intenção

A Central de Conteúdos (`/conteudos`) tem 281 peças publicadas, quase todas vindas do Instagram: Reels em 9:16 e fotos de feed em 4:5. São justamente as formas verticais que o eleitor reconhece e repassa. Mas os cards do board foram desenhados para mídia horizontal — o slot é `aspect-video` (16:9) em todas as superfícies —, então o enquadramento vertical é cortado no `object-cover` e o board parece uma parede de thumbs horizontais, todos iguais.

O pedido é corrigir o enquadramento na Central e na seção dela na home (S39/S42): o card passa a apresentar a peça na forma em que ela respira — vertical é o padrão do board e nunca é cortado; peça genuinamente horizontal aparece inteira, em letterbox na superfície neutra, nunca esticada nem cortada. O board fica honesto: dá para reconhecer o Reel e a foto antes de decidir assistir ou baixar.

## Persona e fluxo

- **Persona / contexto:** eleitor/simpatizante no celular, chegando por link do WhatsApp ou rolando a home; reconhece o material pelo formato (Reel, foto de feed) e decide o que assistir, baixar ou repassar.
- **Job principal:** reconhecer a peça no formato em que ela foi feita, sem enquadramento cortado que a descaracterize, e escolher o que consumir.
- **Fluxo desejado:** abre `/conteudos` (ou passa pela seção da home) → vê cada peça na forma real: Reel em 9:16, foto em 4:5, arte de modelo vertical; peça horizontal inteira em letterbox → reconhece e escolhe → toca para reproduzir/baixar como hoje → no detalhe, se a página entrar no escopo, o mesmo enquadramento (coerência card→detalhe).
- **Anti-goals de produto:** não é redesenho da Central nem da home; não cria rota, tela, player ou galeria; não mexe em filtros, busca, ações, kill switch ou copy; não carrega mídia sozinha; não vira masonry nem grade de altura variável; não puxa dimensão real de mídia (migration/ffprobe) nesta fatia.

### Esboço de fluxo (B)

```text
[visitante no celular] → /conteudos (ou seção da Central na home)
→ card da peça na forma em que ela respira
   ├─ vertical (Reel 9:16 · foto 4:5 · arte de modelo S38 vertical)
   │     → enquadramento inteiro, nunca cortado
   ├─ horizontal genuíno → peça inteira em letterbox na superfície neutra
   │     → nunca esticado, nunca cortado
   └─ áudio/texto/link → forma decidida pela coerência do board (sem enquadramento a preservar)
→ itens sintéticos de modelo do S38 seguem a mesma grade (convite para /cards intacto)
→ toque reproduz/baixa como hoje (mídia só no toque)
[se a página da peça entrar no escopo] → /conteudos/<slug> com o mesmo enquadramento do card
[peça despublicada] → some como hoje (kill switch intacto)
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-cards-verticais-ui-design.html` — cenas do catálogo e da seção da home em ~390 e ~1280: card full vertical (vídeo 9:16, foto 4:5), compacto de foto, item de modelo S38 vertical, peça horizontal em letterbox e a grade sem overflow.

## Objetivo e aceite

- No catálogo `/conteudos` e na seção da Central na home, peça vertical aparece no enquadramento vertical recomendado, **nunca cortada** — Reel (9:16) e foto/carrossel (4:5) preservam o que o autor enquadrou.
- Peça genuinamente horizontal aparece **inteira**, em letterbox na superfície neutra — nunca esticada nem cortada; o board deixa de ser uma parede de thumbs 16:9.
- Os itens sintéticos de modelo do S38, que dividem a mesma grade, ganham arte vertical para a coerência do board — **sem mudar a semântica de convite para `/cards`** (seguem itens, não peças, sem cromo de mídia).
- Guardrails: sem rota/tela nova; mídia continua só no toque (sem autoplay); reprodução, download, compartilhar, filtros, busca e copy intocados; kill switch instantâneo intocado; sem analytics nem PII nova; **nenhuma migration/schema/ffprobe decidido aqui** — v1 decide a forma pelo tipo, não pela dimensão real da mídia.
- Celular primeiro: nenhum overflow horizontal novo (o e2e mede ≤1 px a 390) e nenhuma mídia pesada antecipada.
- **Decidido no gate:** incluir também a página da peça (`ContentPieceDetail`) no mesmo enquadramento, pela coerência card→detalhe — nada de Issue sucessora.
- Demais seções da home, shell/nav e ficha interna intocados.

## Dados (intenção)

- **Vou apresentar dados?** Não — é enquadramento visual, não número: nenhum contador, série, ranking ou métrica nova.
- **Decisões desbloqueadas:** o eleitor reconhece a peça no formato real e decide o que consumir; a comunicação passa a ler o board como ele foi publicado (Reel × foto × horizontal). A contagem de circulação segue no mecanismo anônimo existente (C213), sem métrica nova.
- **Forma:** _adiada ao plano de implementação_ — aqui só a restrição de produto: o formato apresentado é o da própria peça, nunca um recorte inventado.

## Dados da decisão (literais)

- Item `S45`; slug `central-conteudos-cards-verticais`; tipo `feature`; Priority `P1`; Impeccable `B` ("encaixe no slot/card existente, sem rota ou tela nova" — mesmo enquadramento de classe do C226); model `deepseek/deepseek-flash`.
- Superfícies no escopo: (1) catálogo `/conteudos` — cards de peça full (video/audio/link) e compacto (foto/texto), **e** os itens sintéticos de modelo do S38 que compartilham a mesma grade (coerência do board, sem mudar a semântica de convite para `/cards`); (2) seção da home S39/S42 (`ContentPieceHomeCard`, thumb mobile de 124px e bloco `sm+`).
- Regra de produto central: o card apresenta a peça na forma em que ela respira — **vertical é o padrão do board; o enquadramento de peça vertical nunca é cortado**. Peças genuinamente horizontais aparecem inteiras (**letterbox na superfície neutra**), nunca esticadas nem cortadas.
- Formas recomendadas (o designer decide o número final no artefato): vídeo/Reel → **9:16**; foto/carrossel → **4:5**; arte dos itens de modelo S38 → **vertical**; áudio/texto/link não têm enquadramento a preservar — o designer decide a forma pela coerência do board.
- Sem dado de orientação/dimensão no item público hoje: a v1 decide a forma **pelo tipo**, não pela dimensão real da mídia; se o designer/impl optar por forma adaptativa por dimensão real, isso é decisão de implementação, **não requisito de produto**.
- Decisão do gate: incluir também o palco da página da peça (`ContentPieceDetail`) no mesmo item, pela coerência card→detalhe (`docs/plans/central-conteudos-cards-verticais-ui-design.html`, cena 05).
- **Supersessão explícita:** a decisão D5 do C226 ("o slot é 16:9 nas três superfícies", `docs/plans/central-conteudos-preview-frame-video-impl.md:91`) fica **revogada na parte do 16:9**.
- Relação **#1399 C240** (carrossel como conteúdo de primeira classe, `in-progress`, plano+design commitados, ainda sem código): reescreve os MESMOS arquivos (`contentPieceCatalog.ts`, `ContentPieceCard/Media/Detail`, catálogo/página pública) e seu design usa stage `aspect-video`. S45 **não roda em paralelo com C240** — o registrador grava `serializes: []` e a ordem fica **sem fixação** (decisão do gate): o executor coordena no claim; quem rodar depois porta sobre a base do outro (o design do C240 se ajusta ao palco vertical se o S45 vier primeiro).
- Relação **#1358 C228** (P3, aberto): é só cromo do mesmo slot (play 68px, acentos, badge) e o body manda fechá-lo antes de mexer no `ContentPieceMedia`. Para o S45, **C228 não bloqueia** (cromo ≠ ratio); o executor deve saber que ele existe e não puxar o cromo para dentro desta fatia.
- Fora de escopo (literal): galeria multi-mídia do C240; cromo do C228; imagem OG; filtros/busca/ações/kill switch/copy; ficha interna da assessoria; acervo/outras verticais; redesenho do shell/nav/home além do card da seção.

## Direção no codebase (hipótese)

- **Cards hoje:** `ContentPieceCard.tsx:99-129` compacto (foto/texto/outro) com thumb `h-24 w-32`; `:132-162` card full com `ContentPieceMedia className="aspect-video"` (`:143`). `ContentPieceCatalog.tsx:47-53` divide large (video/audio/link) vs compact (image/text/other); grids `sm:grid-cols-2 lg:grid-cols-3` (`:67`) e `sm:grid-cols-2` (`:79`). `ContentPieceHomeCard.tsx:74-87`: mobile `grid-cols-[124px_1fr]`, mídia `aspect-video self-start` (`:86`); `ContentPieceHomeBoard.tsx:241-245` grade `sm:grid-cols-2 lg:grid-cols-3`. `ContentCatalogCardItem.tsx:23-58,68-109`: arte `min-h-40 sm:aspect-video` (`:26`) e `grid-cols-[128px_1fr] sm:block` (`:75`).
- **Slot de mídia:** `ContentPieceMedia.tsx:110-126` — o slot não tem aspecto próprio; o host passa a classe. Imagem `object-cover` (`:190`), frame de vídeo `object-cover` (`:277`), vídeo em play `object-contain` (`:235`). Usado por catálogo, card da home e página da peça (`ContentPieceDetail.tsx:53-61`, slot `aspect-video` em `:60`).
- **Sem dado de orientação:** `ContentPiecePublicItem` (`contentPieceCatalog.ts:364-404`) não tem width/height; `ContentPiecePublicFile` (`:406-411`) só id/path/mimeType/downloadFilename; `mediaOf` (`:672-680`) descarta `url/thumbnailURL/width/height`. O DB tem dims só para imagem (`src/payload-types.ts:1398-1399`; sharp em `payload.config.ts:188`), mas o VM descarta; vídeo não tem dims em lugar nenhum (sem ffprobe). O frame do C226 preserva o aspecto com ffmpeg `scale=640:-2` (`contentPieceFrame.ts:102`) e o VM só expõe `framePath` (`contentPieceCatalog.ts:757-763`), nunca dims.
- **Precedentes visuais verticais:** `CampaignStorySection.tsx:50-52` (`aspect-[9/16]`, `max-w-[420px] lg:max-w-[300px]`); reels internos `ReelLibraryCard.tsx:13`/`ReelPlayer.tsx:12,26` (`aspect-[9/16]`); home S3 `CampaignContentCard.tsx:16-17,44` (`coverAspect 'video'|'square'`); `/fotos` `ArchivePhotoCard.tsx:37` (`aspect-square sm:aspect-[4/3]`); `/cards` `CardModelTile.tsx:16,44-45` usa spacer in-flow (bug WebKit com aspect-ratio); modelos verticais em `cardModels.ts:90-161` (1080×1440, 1000×1440, 1080×1920).
- **Evidência do volume:** 281 peças publicadas, todas Instagram (`docs/changelog/2026-10-01-c230-prune.md:1`); Reels = vídeo e feed = foto pelo MIME (`contentPiece.ts:248-264`); stories nunca entram (C230). Não há medição de proporção vertical×horizontal no repo.
- **Testes a respeitar:** `tests/e2e/frontendConteudos.e2e.spec.ts` (contagens `article[data-content-piece]`, frame antes/depois do play `:342,360`, seção da home `:745-805`, overflow ≤1 em 390, bounding boxes `:908-912`; frame stubado 320×180 `:212-224`); units `contentPieceMedia.unit.spec.tsx`, `contentPieceHomeSelection.unit.spec.ts:84-108` (pina keys da projeção lean — não engordar), `contentPieceCatalog.unit.spec.ts`; manifesto e2e já cobre `components/conteudos`/`(home)`/`conteudos` (`scripts/lib/e2e-affected-manifest.mjs:170-201`).
- **Risco de acoplamento:** o slot `ContentPieceMedia` é compartilhado (catálogo, home, detalhe) — o ratio vale para os hosts atuais e futuros; C240 reescreve os mesmos arquivos; os bounding boxes do e2e e o frame stub 320×180 podem acusar a mudança de ratio; não editar as seções irmãs da home.

## Dependências

- Nenhuma dura — catálogo (S27/S28), itens de modelo (S38), seção da home (S39/S42) e frame do C226 já estão no repo.
- **#1399 C240** — relação registrada acima: serializa (ordem sem fixação; coordenação no claim); sem código ainda. **#1358 C228** — não bloqueia (cromo ≠ ratio); ciência do executor.
- Design UI aprovado no gate.

## Fora de escopo

- Galeria multi-mídia do C240 e a promoção de carrossel a conteúdo de primeira classe.
- Cromo do C228 (play 68px, acentos radiais, badge, sombra) e qualquer polimento visual do slot.
- Imagem OG; filtros, busca, ações, kill switch e copy; ficha interna da assessoria.
- Acervo de falas e outras verticais internas; redesenho do shell/nav/home além do card da seção.
- Forma adaptativa por dimensão real de mídia (migration/ffprobe) e qualquer mudança de schema.

## Rabbit holes de produto

- **"Já que verticaliza, redesenha a Central inteira".** Se alguém "só completar": novo board, nova hierarquia, header, filtros. **Corte neste item:** só o enquadramento dos cards e a grade existentes.
- **"Masonry/altura variável por peça".** Se alguém "só completar": layout novo, colunas quebradas, e2e de overflow refeito. **Corte:** grade atual, uma forma por tipo de peça.
- **"Detecta a dimensão de toda mídia agora".** Se alguém "só completar": migration de width/height, ffprobe no acervo, backfill. **Corte:** v1 decide pelo tipo; adaptativa é decisão de implementação futura, não requisito.
- **"Cover em tudo para o board ficar uniforme".** Se alguém "só completar": corta o vertical para preencher o slot e destrói o pedido. **Corte:** vertical inteiro; horizontal em letterbox.
- **"Autoplay no card para aproveitar o formato".** Se alguém "só completar": vídeo carregando no board, quebra do contrato do S27. **Corte:** mídia só no toque, como hoje.

## Questões em aberto (produto)

- **Forma por tipo ou adaptativa pela dimensão real da mídia?** **Decidido no gate:** **A** — por tipo na v1 (vídeo 9:16, foto 4:5, arte de modelo 3:4); adaptativa por dimensão real vira decisão de implementação posterior, sem migration/ffprobe nesta fatia.
- **Foto compacta continua linha ou vira card vertical cheio?** **Decidido no gate:** **A** — mantém a linha compacta e corrige o enquadramento do thumb (96×120, 4:5), preservando a leitura de varredura do board.
- **A página da peça entra no mesmo item?** **Decidido no gate:** **A** — sim, `ContentPieceDetail` com o mesmo palco vertical (coerência card→detalhe; cena 05 do artefato).
- **Onde ficam as ações no card vertical?** **Decidido no gate:** **A** — abaixo da mídia, como hoje; mantém os alvos de toque do S27.
- **Áudio e link ficam verticais ou largos?** **Decidido no gate:** **B** — permanecem largos (não há enquadramento a preservar); decisão fechada no artefato.

## Referências

- GitHub Issue — a registrar (`pnpm agent:register`).
- Design UI (gate): `docs/plans/central-conteudos-cards-verticais-ui-design.html`.
- Planos irmãos: `central-conteudos-publica.md` (S27) · `central-conteudos-cards-no-catalogo.md` (S38) · `central-conteudos-secao-home.md` (S39) · `central-conteudos-secao-home-share-filtro.md` (S42) · `central-conteudos-preview-frame-video.md` e `-impl.md:91` (C226, D5 superseded na parte do 16:9) · `central-conteudos-carrossel.md` (C240, #1399).
- Arquivos-pista: `src/components/conteudos/ContentPieceCard.tsx:99-162` · `ContentPieceCatalog.tsx:47-79` · `ContentPieceHomeCard.tsx:74-87` · `ContentPieceHomeBoard.tsx:241-245` · `ContentCatalogCardItem.tsx:23-109` · `ContentPieceMedia.tsx:110-277` · `ContentPieceDetail.tsx:53-61` · `src/lib/contentPieceCatalog.ts:364-411,672-680,757-763` · `src/components/campaign/.../CardModelTile.tsx:16,44-45` e `src/lib/cardModels.ts:90-161`.
- Testes: `tests/e2e/frontendConteudos.e2e.spec.ts:212-224,342,360,745-805,908-912` · units de `contentPieceMedia`/`contentPieceHomeSelection`/`contentPieceCatalog` · `scripts/lib/e2e-affected-manifest.mjs:170-201`.
- `AGENTS-public.md` — convenções do site público (mídia, cache, kill switch).

## Self-score (shaping)

**5/5** — (1) fatia = um outcome verificável (vertical inteiro, horizontal em letterbox, no catálogo e na home); (2) appetite ~1–2 dias cabe: enquadramento no slot/cards existentes, sem rota, tela ou migração; (3) persona/job/aceite em linguagem de produto, com a regra central e os guardrails; (4) direção no codebase é hipótese, com achados e precedentes citados como pista; (5) zero decisão dura de engenharia — sem schema/migration/ffprobe, com as cinco dúvidas de produto posicionadas e as relações C240/C228 registradas.
