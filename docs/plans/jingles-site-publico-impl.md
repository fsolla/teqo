# Impl: Jingles de Jorge Solla no site público — ouvir e baixar (S21)

Status: aprovado
Atualizado em: 2026-09-20
Issue: #1222
Intenção: docs/plans/jingles-site-publico.md
Appetite restante: herdado (~1–1,5 dia eng) — sem infra nova, sem dependência de serviço externo; cortes nomeados em "Rabbit holes"

## Leitura da intenção

- **Outcome:** uma página pública `/jingles` lista os jingles publicados com capa, título e player que toca ali mesmo (um por vez, sem abrir terceiros) e cada jingle baixa direto o MP3 com nome de arquivo legível — gerenciável no CMS, com kill switch por item e por página, leve no celular e indexável com título/descrição próprios.
- **O que NÃO negociar:**
  - **Kill switch fail-closed:** cada jingle sai do ar por despublicação (checkbox), a página inteira fica vazia/honesta com zero publicados, o link do rodapé some e os arquivos **nunca são apagados**. Despublicado não aparece em lugar nenhum.
  - **Sem PII/LGPD:** nenhum formulário, consent, Contact ou captura. Consent intocado.
  - **Um jingle por vez**; **sem autoplay**; abrir a página **não baixa os áudios** (áudio só carrega após o play).
  - **Um MP3 por jingle** serve para tocar e baixar; **WAV não vai ao site**; nenhum binário grande commitado — áudio/capa entram pela mídia existente (que não ganha collection paralela).
  - **Home e navegação principal intocadas**; a descoberta é um link condicional no rodapé. Nada de loja/streaming, analytics, share kit, discografia ou páginas por jingle.
- **O que reavaliar (hipóteses da "Direção no codebase"):**
  - "mídia existente" — confirmado, mas com o refinamento de **depth 0 + `getCachedDocumentById`** (senão trocar o arquivo no admin deixa o card velho; ver D2).
  - "Precedente `/corte/[id]` (player)" — o corte usa `<video controls>` nativo; o artefato dos jingles pede controle próprio (play amarelo, progresso, status), então **não há player para reusar** — nasce um client component novo, pequeno.
  - "rodapé" — o `CampaignFooter` é compartilhado com home/cards; esta entrega o edita (link condicional, prop `showJingles`; ele segue sync, ver D5). É a **única** mudança que aparece fora de `/jingles` — deliberada e mínima.
  - "e2e afetado" — a migration classifica todo PR da entrega como high-risk ⇒ CI roda só o conjunto curado; a escolha de entrar no curado é decisão registrada (D7).

## Abordagem recomendada

```mermaid
flowchart LR
  admin[Admin /admin · Jingle] -->|afterChange / afterDelete| bust[revalidateTag 'jingles']
  page[/jingles RSC · campaign-site] --> list[getCachedPublishedJingles<br/>where published · depth 0 · tag 'jingles']
  list --> docs[getCachedDocumentById media<br/>tag 'document_media:id']
  docs --> player[JinglePlayer client<br/>preload none · um por vez]
  list --> empty[JingleEmptyState<br/>200 honesto · noindex]
  footer[CampaignFooter sync] -->|showJingles prop| has[hasPublishedJingles]
  has --> list
```

**Opções consideradas:** A) collection `jingle` nova com checkbox `published` (padrão ShareLink) | B) reusar `post`/`shareLink` existentes | C) drafts/versions via `_status`.

**Recomendação:** **A** — uma collection própria com campos exatos (título, slug, capa, áudio, ordem, publicado), grupo `Publicações`, leitura anônima fail-closed por `where published: true`, escrita `canManagePublishedContent` e hooks que revalidam a tag `jingles`. É o precedente mais próximo (S19), sem carregar richText/taxonomia/drafts de Post.

**Rejeitadas:** **B** — `post` traz corpo richText, `type`/categoria, drafts e o controle eleitoral por tag `hidden`, acoplando o jingle a uma taxonomia de notícias e exigindo migration de enum + semântica de visibilidade compartilhada; `shareLink` é OG/destino externo, sem upload próprio de áudio. **C** — `_status`/versions adiciona cerimônia de drafts/preview/agendamento sem uso; o kill switch por `published` é o contrato estabelecido e mantém o mesmo access fail-closed.

### Decisões de engenharia

**D1. Modelo — collection `jingle` (nova) com `published` checkbox e `order` opcional.**

- _Opções:_ A) collection nova (ShareLink) | B) reusar Post/ShareLink | C) `_status` drafts/versions.
- _Recomendação:_ A — campos mínimos (`title`, `slug` único auto-slugificado, `coverImage` upload→media required, `audio` upload→media required, `order` number opcional, `published` default `false`); `admin.group: 'Publicações'`; `read: hasPayloadPanelAccess(req.user) ? true : { published: { equals: true } }`; create/update/delete `canManagePublishedContent`; `afterChange`/`afterDelete` → `revalidateJinglesListing()`. Ordenação `['order', 'title']` (sem `order` vai ao fim — `NULLS LAST` no Postgres; divergência barata do `order` required de `SpeechSegment`).
- _Rejeitadas:_ B (ver acima); C (sem ganho, mais superfície de query/estado).

**D2. Leitura/cache — listagem `unstable_cache` depth 0 + mídia por `getCachedDocumentById`.**

- _Opções:_ A) listing depth 0 (tag `jingles`) + `getCachedDocumentById('media', id)` (tag `document_media:<id>`) | B) listing depth 1 | C) página dinâmica.
- _Recomendação:_ A — trocar o **arquivo** de uma mídia no admin busta `document_media:<id>` (`Media.afterChange`), então capa/áudio ficam frescos mesmo sem editar o jingle. O listing guarda só ids.
- _Rejeitadas:_ B — um arquivo trocado numa mídia existente não dispara hook do jingle e o card serviria filename/URL velhos até alguém editar o jingle; C — mata ISR/indexação e adiciona DB por request sem necessidade.

**D3. Nome do download — helper puro derivado do slug.**

- _Opções:_ A) `jingleDownloadFilename(slug, sourceFilename)` → `jorge-solla-1313-<slug>.<ext>` (ext do filename da mídia em lowercase, fallback `mp3`; slug normalizado com `slugify` e fallback `jingle`) | B) `media.filename` cru | C) nome fixo.
- _Recomendação:_ A — o aceite pede nome legível; o design mostra `jorge-solla-1313-axe.mp3` (o slug do Axé já é `axe`); extensão real mantém honestidade.
- _Rejeitadas:_ B — filename de upload pode ter acento/espaço/maiúscula; C — todos baixariam o mesmo nome.

**D4. Estado vazio — 200 honesto + `noindex` só quando vazio.**

- _Opções:_ A) 200 com estado honesto + "Voltar ao início" + rodapé sem "Jingles"; `robots: noindex,nofollow` quando vazio | B) 404 (padrão `/corte`) | C) 200 sempre indexável.
- _Recomendação:_ A (intenção: "acesso direto mostra estado honesto", "não é descoberta"). Só sobrescrever `robots` **quando vazio** — com conteúdo, omitir `robots` para o `index,follow`/`noindex` de staging do layout raiz valer.
- _Rejeitadas:_ B — o acesso direto é legítimo (diferente do link não listado de um corte); C — anunciar "nenhum jingle publicado" em busca é pior que não aparecer.

**D5. Rodapé — leitura cacheada na página + prop explícita no rodapé (sync).**

- _Opções:_ A) `CampaignFooter` vira async e lê `hasPublishedJingles()` | B) o rodapé segue **sync** recebendo `showJingles` de cada página, com `hasPublishedJingles()` (cacheado, tag `jingles`) resolvido na página | C) footer client com `usePathname`.
- _Recomendação:_ **B** — a execução mostrou que o async child quebra o teste-skeleton da home (`tests/unit/campaignHome.unit.spec.tsx`, RTL não renderiza async components) e faria o rodapé — folha compartilhada e estática — depender do runtime do servidor. Com B o rodapé continua um leaf síncrono e a decisão de descoberta fica explícita na página, sempre pelo mesmo dono cacheado (`hasPublishedJingles`); os call sites são 3 linhas (home, cards, jingles).
- _Rejeitadas:_ A — verificada em execução: erro `CampaignFooter is an async Client Component` no teste da home e acoplamento desnecessário; C — transformaria o rodapé em client component só para saber a rota (JS desnecessário) e não resolve a leitura.

**D6. `Media.alt` required para áudio — aceitar e documentar.**

- _Opções:_ A) comunicação preenche o alt também no áudio; campo do Jingle descreve isso | B) tocar em `Media` (relaxar required por tipo).
- _Recomendação:_ A — fricção de 1 campo por jingle (3 hoje); o alt ainda ajuda no admin.
- _Rejeitadas:_ B — o alt é contrato compartilhado de todas as mídias; exigiria lógica por MIME que não existe e mexe no owner sem evidência de produto.

**D7. E2E — spec novo no conjunto curado + pin (precedentes C167/S19).**

- _Opções:_ A) criar `tests/e2e/frontendJingles.e2e.spec.ts` e adicionar `frontendJingles` a `E2E_CURATED_SPECS` + pin em `e2eAffectedManifest.unit.spec.ts` | B) não adicionar.
- _Recomendação:_ A — a migration torna **todo** PR desta entrega high-risk (CI roda só o curado); sem a entrada, o spec que nasce neste PR não roda nele (ficaria só no verify full pós-merge) e PRs high-risk futuros tocando jingles não o acordariam.
- _Rejeitadas:_ B — contraria os dois últimos deliveries com migration e deixa o contrato novo sem cobertura no caminho que importa.

**D8. Leveza — `preload="none"` + controle próprio (não nativo, não metadata).**

- _Opções:_ A) `<audio preload="none">` oculto por card + controle do artefato | B) `preload="metadata"` | C) `<audio controls>` nativo.
- _Recomendação:_ A — aceite literal ("abrir a página não baixa os áudios"); B dispara request de mídia no load; C não reproduz o card do artefato.
- _Rejeitadas:_ B e C (acima).

**D9. Exclusividade — um único client component `JinglePlayer` dono do estado.**

- _Opções:_ A) um componente client para a lista (estado `activeId` + refs; ao tocar, pausa os demais) | B) card client + contexto | C) `<audio>` global com source trocada.
- _Recomendação:_ A — 3 itens, sem contexto, estado onde é usado (engineering-standards).
- _Rejeitadas:_ B (cerimônia por <3 call sites); C (complica progresso/duração por card e o seek).

**D10. Rota e slug — estático `/jingles` + reserva no registro existente.**

- _Opções:_ A) `src/app/(frontend)/jingles/` + `'jingles'` em `SHARE_LINK_RESERVED_SLUGS` (dono atual da reserva; o drift test é fail-closed) | B) lista de reservados paralela.
- _Recomendação:_ A — o Next dá precedência ao segmento estático sobre `[type]`; a reserva impede que um shareLink capture `/jingles`. O slug do **jingle** não é URL (não valida reservados; só alimenta o nome do arquivo, sanitizado no helper).
- _Rejeitadas:_ B — twina um registro que o drift test já cobre.

### Componentes / mudanças

- **`src/collections/Jingle.ts`** (novo): collection acima (D1). `admin.description` explica o fluxo ("Suba o MP3 e a capa pela Mídia; desmarcar Publicado tira o jingle do ar sem apagar nada").
- **`src/payload.config.ts`**: registrar `Jingle` no array `collections` (mesmo PR da migration).
- **Migration:** `pnpm migrate:create add_jingle` (rebase antes) → `src/migrations/<ts>_add_jingle.{ts,json}` + `index.ts`; `pnpm migrate` local; `pnpm generate:types` (`payload-types.ts`). Tabela aditiva, sem backfill; FKs de mídia `ON DELETE set null` (mídia apagada ⇒ item some, fail-closed).
- **`src/lib/jingle.ts`** (novo, puro/client-safe): `JingleViewModel` (`id`, `title`, `coverUrl`, `coverAlt`, `audioUrl`, `downloadFilename`), `toJingleViewModel({ jingle, cover, audio })` → `null` quando faltar URL (fallback de alt quando a mídia não tiver), `jingleDownloadFilename` (D3). Sem `@/payload-types` (precedente `lib/recording.ts`, formas estruturais).
- **`src/utilities/jingleReads.ts`** (novo; `server-only`; registrar no pin de top-level em `codebaseConventions.unit.spec.ts` com comentário): `getCachedPublishedJingles()` (`unstable_cache`, `where { published: true }`, `sort: ['order','title']`, `depth 0`, `limit 0`, tag `getCollectionListingTag('jingle')` = `jingles`, filtro explícito na query como no S19); `getPublishedJingleItems()` (resolve capa/áudio via `getCachedDocumentById('media', id)` e mapeia com `toJingleViewModel`, descartando itens sem mídia); `hasPublishedJingles()` (rodapé).
- **`src/utilities/documents.ts`**: `revalidateJinglesListing = () => revalidateCollectionListing('jingle')` (dono do vocabulário de tags; sem import de config).
- **`src/lib/shareLink.ts`**: adicionar `'jingles'` a `SHARE_LINK_RESERVED_SLUGS` + atualizar o literal em `tests/unit/shareLink.unit.spec.ts` (D10).
- **`src/app/(frontend)/jingles/layout.tsx`**: `data-theme="campaign-site"` + `h-dvh w-full overflow-y-auto bg-(--campaign-cream) text-(--campaign-ink)` (precedente `(home)/layout.tsx`; o root trava `overflow-hidden`).
- **`src/app/(frontend)/jingles/page.tsx`**: RSC estático/ISR; `generateMetadata` (title "Jingles de Jorge Solla · <siteName>", description própria, canonical via `absoluteSitePath`, OG com a capa do primeiro jingle absoluta e fallback do global `metadata`, `robots` só no vazio — e o arquivo chama `resolveSiteMetadata`, exigido pelo guard de convenções); compõe header + hero + lista/`JingleEmptyState` + `CampaignFooter current="jingles"`.
- **`src/components/jingles/JinglePageHeader.tsx`** e **`JingleIntro.tsx`** (server, page-local): header cream com `public/campaign-kit/marca-positiva-completa.png` (via `next/image`) + selo "Jingles oficiais"; hero com blobs, eyebrow "A trilha da nossa caminhada", h1, copy e o cartão "Um por vez. Ao tocar outro, o anterior para." (SVG de nota). Não é o `SiteHeader` (vermelho/breadcrumb) e não se generaliza agora — gatilho de revisitação: uma segunda página campaign-site precisar do mesmo header.
- **`src/components/jingles/JinglePlayer.tsx`** ('use client'): recebe `readonly JingleViewModel[]`; port do artefato classe-a-classe em Tailwind (`data-state`, `.jingle-card`→utilities, capa quadrada com gradiente, play 56px amarelo com sombra 3D, status "Pronto para tocar"/"Em reprodução" com bolinha, trilha 6px + valor vermelho, "Tempo/Duração" uppercase via `formatSpeechClock` — reuso do dono do relógio —, "Baixar MP3" `min-h-11` com borda vermelha 32%, filename truncado). Um `<audio preload="none">` por card; ao tocar um, pausa os outros; `play().catch` reverte o estado (nunca deixa `aria-pressed` preso); botão com `aria-label` Tocar/Pausar + `aria-pressed`; ícones SVG inline do artefato (play/pause/download); `focus-visible` amarelo; `motion-reduce` desliga transições.
- **`src/components/jingles/JingleEmptyState.tsx`** (server): nota cortada, copy "Nenhum jingle publicado por enquanto", "Voltar ao início" (`min-h-11`).
- **`src/components/CampaignFooter.tsx`**: segue sync; props `showJingles?: boolean` (default `false`) e `current?: 'jingles'`; item "Jingles" condicional com `aria-current="page"` e destaque bold/branco (D5). Home e cards resolvem `hasPublishedJingles()` (cached) e passam a prop; a página de jingles passa `items.length > 0`.
- **Testes:** `tests/unit/jingle.unit.spec.ts` (helper/mapper), `tests/unit/jinglePlayer.unit.spec.tsx` (RTL com mock de `HTMLMediaElement`, precedente `speechDetailPlayer.unit.spec.tsx`: play/pausa/exclusividade/tempos/`preload=none`/href+`download`), `tests/int/jingle.int.spec.ts` (mock de `next/cache` como no S19), `tests/e2e/frontendJingles.e2e.spec.ts`, + atualizações dos pins (`shareLink`, `codebaseConventions`, `e2eAffectedManifest`).
- **Fixture e2e/int:** `tests/fixtures/jingle-tone.mp3` (~2–5 KB, MP3 válido gerado uma vez com ffmpeg e commitado) para o áudio; capa segue o padrão do PNG 1×1 base64 do spec do S19. _Rejeitadas:_ base64 gigante no spec (ilegível) e geração em runtime (acopla ffmpeg ao e2e).
- **Manifesto/curated:** entries novas em `E2E_AFFECTED_MANIFEST` — jingles (`src/app/(frontend)/jingles`, `src/lib/jingle`, `src/utilities/jingleReads.ts`, `src/utilities/documents.ts`, `src/collections/Jingle.ts`, `src/components/jingles`) → `frontendJingles`; e `src/components/CampaignFooter.tsx` → `['frontend', 'frontendJingles']` (o rodapé renderiza na home e em `/jingles`). `frontendJingles` entra em `E2E_CURATED_SPECS` com comentário S21 + pin do array em `tests/unit/e2eAffectedManifest.unit.spec.ts` (D7).
- **Changelog:** `docs/changelog/2026-09-20-s21.md` (uma entrada curta, formato do agregado).
- **Operação (fora do código):** os 3 MP3 e as capas são conteúdo — a comunicação sobe no admin (produção) após o merge; a conversão WAV→MP3 é local/ops e nada é commitado. Nenhum seed novo no repo; e2e/int se auto-semeiam e limpam no `afterAll`.

### Dados → forma

N/A — a intenção já registra "Vou apresentar dados? Não": é superfície de mídia (áudio + capa), sem dado agregado, sem PII e sem decisão desbloqueada por números. Nada a definir em forma de apresentação; a "forma" aqui é o card/player do artefato aprovado.

## Fases verificáveis

1. **Tracer / schema+server (~0.4 dia)** — `Jingle` + registro + `pnpm migrate:create add_jingle` + `pnpm migrate` + `pnpm generate:types`; `revalidateJinglesListing`; `src/lib/jingle.ts`; `jingleReads.ts` + pin de top-level; `'jingles'` reservado + literal do unit. Testes: unit do helper/mapper; int do access fail-closed (anônimo não vê draft, não escreve; `campaignUser` não escreve), filtro publicado, ordenação (`order` asc, sem ordem ao fim, empate por título), `revalidateTag('jingles')` em create/update/delete, resolução das mídias e descarte de item sem mídia. Prova: `pnpm gate:fast` + `pnpm test:int`.
2. **UI (~0.4 dia)** — layout/page/header/hero/player/empty + `CampaignFooter`; RTL do player. Verificação visual local em 390/1280 com 2–3 jingles semeados no admin local (converter WAV→MP3 só localmente; capas otimizadas do artefato como arquivos locais de teste). Sem dispatch do designer aqui: o artefato cobre a superfície e é portado classe-a-classe (triggers a/b/d não disparam; ícones vêm do artefato).
3. **E2E + manifesto (~0.2 dia)** — fixture MP3; `frontendJingles` (seeding via REST admin com `adminHeaders`/`seedTestUser`, limpeza em `afterAll`; asserções: lista renderizada + rodapé com link + `robots index,follow`; **nenhum request de áudio antes do play**; play/pausa/exclusividade com `audio.paused` real; download dispara com `suggestedFilename()` = `jorge-solla-1313-<slug>.mp3`; kill switch despublica → 200 vazio honesto + rodapé sem "Jingles" + `noindex`, republica → volta); manifest entries + curated + pin.
4. **Gates e fechamento (~0.2–0.3 dia)** — `pnpm gate:fast` → `pnpm test:int` → e2e local (loop rápido: `pnpm test:e2e --no-deps -- tests/e2e/frontendJingles.e2e.spec.ts --workers=1`; canônico: `pnpm test:e2e:affected`, que em high-risk roda a suíte **full** local — OPS86) → **crítica final do designer (trigger c)** contra o app renderizado (390/1280 + estados vazio/tocando; `DEGRADED` ⇒ **para antes do `pnpm push`**, comenta a Issue e flipa `blocked` no modo `--auto`) → changelog → `pnpm push` → PR `Closes #1222`.

## Débitos do simplify (triage do Passo 6)

Achados dos dois revisores que **não** viraram fix da sessão:

| ID  | Resumo                                                                                     | Origem            | Score | Tipo          | Destino                                                         |
| --- | ------------------------------------------------------------------------------------------ | ----------------- | ----- | ------------- | --------------------------------------------------------------- |
| S1  | 3ª cópia da resolução de mídia do global `metadata` (corte, shareLinkReads, página)        | review estrutural | 2     | defer_trigger | gatilho: 4º consumidor **ou** mexer em uma das superfícies      |
| S2  | Esqueleto "listing publicado + `unstable_cache` + tag" repetido entre `posts.ts` e jingles | review estrutural | 2     | defer_trigger | gatilho: 3ª collection de listagem pública                      |
| S3  | `src/utilities/documentReads.ts` sem entry no `E2E_AFFECTED_MANIFEST`                      | review estrutural | 2     | defer_trigger | gatilho: `documentReads` virar risk prefix ou mudar de contrato |
| S4  | Copy por breakpoint duplicada em spans no `JingleIntro` (literal do artefato)              | review qualidade  | 1     | descartar     | o artefato define as duas copies; não é débito                  |

Já resolvidos na sessão (não reabrir): corrida do `play()` superado (catch por id), `isNotFoundError` extraído para `documentReads`, `publishedOrPanelAccess` no dono do access, `hasPublishedJingles` derivado da lista renderizável, `role="progressbar"`, ref callback estável, `data-jingle-audio` removido, `hasItems`, `h1` no estado vazio, validação do slug, cobertura int de create/update/delete negados, comentário/`async` dos testes e comentário do `.gitignore`.

## Rabbit holes / Não escopo (engenharia)

- **Pré-carregar áudio** (`preload="metadata"`/`"auto"` ou `<link rel=preload>`): viola o aceite de leveza — D8 fixa `preload="none"`.
- **Player rico** (ondas, equalizador, visualizador, velocidade): o artefato fixa o controle; nada além de play/pausa/progresso/tempo.
- **Upload de WAV / conversão no app / ffprobe de duração**: um MP3 por jingle é decisão de produto; duração vem do browser em runtime.
- **Collection paralela de mídia ou mudar `Media`** (mimeTypes, validação de áudio, `alt` opcional): mídia existente, contrato compartilhado intocado (D6).
- **Discografia / página por jingle / letras / destaques**: uma página, 3 cards. O slug do jingle não vira URL.
- **CDN, Spotify/YouTube embed, "ouvir no…"**: hospedagem e mídia existentes.
- **Analytics de play, contador de download, captura de dados/consent**: LGPD N/A; não introduzir consent por engano.
- **Share kit social dos jingles**: item futuro se pedido.
- **Redesign de home/nav ou seção de jingles na home**: só o link condicional no rodapé.
- **Rodapé dinâmico** (`payload.find` cru / `force-dynamic`): quebraria ISR da home — a leitura é cacheada por tag (D5).
- **Binários em `public/`** (a pasta vai para a imagem Docker) e seed automático dos 3 jingles no repo.
- **Colisão com `[type]`/shareLink**: o segmento estático novo é reservado (D10) — não criar rota `[slug]` paralela.
- **Duas fontes de verdade do relógio**: não criar formatador novo; `formatSpeechClock` é o dono (se a crítica de design reprovar o "02:45" vs "2:45", revisitar com gatilho).

## Riscos e mitigação

- **Home/cards estáticas e o rodapé:** a flag do rodapé vem de leitura cacheada (tag `jingles`) resolvida na página — nunca `payload.find` cru, que tornaria a home dinâmica; o rodapé em si segue sync (D5, divergência registrada). A tabela `jingles` existe desde a migration (build-after-migrate); falha de DB continua falhando alto.
- **Link do rodapé stale após despublicar o último jingle:** o mesmo `afterChange` busta a tag `jingles` que alimenta `hasPublishedJingles`; o e2e de kill switch cobre o flip (com no máximo um request stale, como S19).
- **Arquivo/capa trocados no admin sem editar o jingle:** coberto por D2 (`document_media:<id>`); teste int garante que o item usa a URL resolvida na leitura.
- **Mídia apagada com jingle publicado:** FK `ON DELETE set null` + descarte de item sem mídia no mapper ⇒ fail-closed (não renderiza player quebrado).
- **Fixture MP3 precisa decodificar no Chromium (asserção de `paused`):** fixture válida e pequena; se o headless se mostrar instável, manter as asserções de `aria-pressed`/exclusividade e marcar a de playback com o motivo no spec.
- **Fricção do `Media.alt` no áudio:** descrições nos campos do Jingle orientam a comunicação (D6); nenhum código de Media muda.
- **Guardas fail-closed que este PR precisa atualizar juntas:** drift de reservados (`shareLink.unit`), pin de top-level (`codebaseConventions.unit`) e pin do curado (`e2eAffectedManifest.unit`) — esquecer qualquer uma quebra a própria CI e o aviso é o teste.
- **E2E local high-risk = suíte full (OPS86) consome orçamento:** loop de iteração no spec direto; o `test:e2e:affected` roda uma vez antes do push, com o tempo reservado no appetite.

## Aceite de engenharia

- [ ] Aceite de produto da intenção ainda coberto (lista publicados; play sem sair; um por vez; download MP3 com nome legível; kill switch item+página com rodapé condicional; sem autoplay e sem baixar áudio ao abrir; indexável com title/description próprios; LGPD N/A).
- [ ] Invariantes AGENTS/engineering-standards: access explícito e fail-closed; `lib/` pura sem `payload-types`; `utilities` server-bound com `server-only`; top-level pinado; tag vocabulary em `documents.ts`; migration aditiva via `migrate:create` + `push:false`; sem binário grande/`public/`; `pnpm push` (nunca `git push` nu); changelog só a entrada nova.
- [ ] Testes de domínio previstos (unit/int) onde access/write paths mudam: int do fail-closed + hooks de revalidação; unit do helper; RTL do player; e2e do contrato público (play/exclusividade/leveza/download/kill switch).
- [ ] Designer (trigger c) certificado antes do push; `Design tier` registrado no PR (ou `DEGRADED` ⇒ parada/sign-off).

## Self-score decision-quality (gate ≥4)

1. **Decisões caras com rejeitadas (5/5):** D1–D7 (modelo, cache, nome, vazio, rodapé, Media.alt, curado) têm opções, recomendação e o porquê de cada rejeitada; D8–D10 idem em forma compacta.
2. **Cabe no appetite (4/5):** ~1,2 dia entre schema/server, UI e testes; nada de infra nova. O custo não-compressível é o e2e local full (OPS86) + crítica do design no fechamento — por isso todos os rabbit holes foram cortados.
3. **Rabbit holes nomeados (5/5):** lista explícita (player rico, WAV, mídia paralela, discografia, CDN, analytics, rodapé dinâmico, binários, colisão de rota…).
4. **Depth check (5/5):** reusa ShareLink (template de kill switch), `documentReads`/`documents` (tags), `lib/slug`, `formatSpeechClock`, `CampaignFooter`, `adminHeaders`/`seedTestUser` e o padrão de fixture dos e2e; novos são só os donos que faltam (collection, `lib/jingle`, `jingleReads`, componentes page-local) — 1 top-level novo, pinado.
5. **Intenção preservada (5/5):** cada aceite de produto mapeia para um mecanismo do plano; a engenharia não reescreveu outcome (nenhum escopo novo, nenhuma PII/consent).

**Média: 4,8/5 — aprovado.**
