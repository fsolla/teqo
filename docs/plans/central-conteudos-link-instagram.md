# C215 — Central de Conteúdos — link do Instagram do deputado baixa e cataloga a peça

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1302
Priority: P1
Impeccable: B — encaixe na lista/ficha existentes do C211 (estado honesto), sem tela nova
Design UI: docs/plans/central-conteudos-link-instagram-ui-design.html
Appetite: ~1,5–2 dias eng; um outcome verificável — link do próprio perfil deixa de degradar em silêncio
Responsável: —

## Intenção

A assessoria de comunicação colou na Central de Conteúdos (`/campanha/comunicacao/conteudos`) o link de uma peça do **próprio** Instagram do deputado e a peça não foi baixada nem analisada: virou uma "peça-link" em silêncio. A promessa do fluxo — decidida no gate e registrada no C212 — é que peça adicionada por link tenha a mídia extraída e catalogada quando houver caminho oficial. O caminho oficial existe (Graph API da própria conta) e o pipeline existe; o que faltou foi o link do próprio perfil ser encontrado e resolvido. Este item conserta essa quebra.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) na mesa, operando a Central, colando links das peças do perfil oficial (@depjorgesolla) que acabaram de sair.
- **Job principal:** colar o link de uma peça do próprio Instagram e receber a peça baixada, transcrita e catalogada — como se tivesse enviado o arquivo.
- **Fluxo desejado:** cola o link → a peça nasce "Processando" → o post é procurado no perfil oficial → achou e é extraível: arquivo baixado, transcrito e catalogado → não achou/não extraível: peça-link **com motivo honesto na ficha** → assessoria revisa/edita ou anexa o arquivo; nada é apagado.
- **Anti-goals de produto:** não vira varredura automática do perfil; não vira tela nova nem segundo fluxo de configuração; não vira scraping/contorno; não baixa mídia de terceiro; não apaga peça-link; não encosta no board da home.

### Esboço de fluxo (B)

```text
[Central] → "Adicionar por link" → cola link do próprio perfil
  (ex.: instagram.com/depjorgesolla/reel/ABC/ · .../reel/ABC/?igsh=… · .../p/ABC/)
  → peça "Processando" → busca o post no perfil oficial (além das 50 mais recentes)
  → achou + extraível: baixa o arquivo → transcreve → cataloga (igual ao envio por arquivo)
  → não achou / não extraível: peça-link com motivo na ficha
    ("Link não encontrado…" · "Carrossel…" · "Instagram indisponível…" · "Sem credencial…")
  → revisa, edita, anexa o arquivo se quiser — a peça nunca é apagada
[outcome: link do próprio perfil vira peça baixada e catalogada — ou falha com motivo, nunca em silêncio]
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-link-instagram-ui-design.html`

## Objetivo e aceite

- Colar um link do próprio perfil — nas formas que o browser copia — resulta em peça com mídia baixada, transcrita e catalogada, igual ao envio por arquivo.
- A busca pelo post colado não para na janela atual: vai para trás o suficiente para o uso real, com limite declarado; post além do limite recebe motivo honesto (não silêncio).
- Quando a extração não acontecer, a ficha mostra o motivo em linguagem de produto (vocabulário literal abaixo). Peça-link é resultado legítimo, não "Falhou".
- Peça-link continua fallback: circula pelo link, o arquivo original pode ser anexado e a peça nunca é apagada.
- Curadoria preservada: campos que a assessoria editou não são sobrescritos pela catalogação.
- **Guardrails:** extração só por caminho oficial (Graph API da própria conta) — nunca scraping/contorno; mídia de terceiro nunca é baixada; token nunca em log; o contrato do feed/board da home (cache de 5 min, snapshot, kill switch) não é reusado nem alterado; YouTube segue link-only por desenho (a Data API não entrega arquivo) — sem motivo de falha.

## Dados (intenção)

- **Vou apresentar dados?** Não — não há agregado nem KPI; o que muda é o estado da peça e o motivo visível na ficha.
- **Decisões desbloqueadas:** N/A — a decisão da assessoria é editorial/operacional ("anexar o arquivo original?"), não numérica.
- **Forma:** N/A — restrição: motivo em linguagem de produto, sem código de erro, stack ou jargão de API.

## Dados da decisão (literais)

- **Decisão do gate (C212, verbatim):** "Quando o assessor adiciona uma peça por link do Instagram ou Youtube, a mídia deve ser automaticamente extraída e catalogada." — com o corte do C211: **quando houver caminho oficial**.
- **Motivos (verbatim):** "Link não encontrado entre as mídias recentes do perfil" · "Carrossel: sem arquivo único para baixar" · "Instagram indisponível no momento" · "Sem credencial do Instagram configurada".
- **Formas de link aceitas:** `instagram.com` com `p|reel|reels|tv` + shortcode, com ou sem `www.`/`m.`, query ignorada (`?igsh=` ok) e **caminho prefixado pelo perfil** (`/depjorgesolla/reel/<shortcode>/`, `/depjorgesolla/p/<shortcode>/`); rejeitar `/stories/`, `instagr.am` e hosts fora de Instagram/YouTube (como hoje).
- **Fallback:** peça-link permanece, com aviso na ficha; "Mídia de terceiro nunca é baixada"; o arquivo original pode ser anexado pela assessoria; a peça nunca é apagada.

## Direção no codebase (hipótese)

- **Áreas prováveis:** resolução do link `src/utilities/content/contentPieceLink.ts`; job `src/utilities/content/contentPieceJob.ts`; parse `src/lib/contentPiece.ts`; feed `src/utilities/socialFeed/instagramFeed.ts`; action `src/app/(campaign)/campanha/actions/contentPieces.ts`; lista/ficha em `src/components/campaign/content/` e `.../comunicacao/conteudos/[id]/page.tsx`.
- **Fatos verificados (a revalidar):** hoje degradam para peça-link sem erro nem motivo — origem ≠ Instagram, parse falho, credencial ausente, `loadInstagramFeed` lançando, post fora da janela de 50, carrossel/sem `mediaUrl`; o job termina "Pronto" (`contentPieceJob.ts:278`). O parse rejeita caminho prefixado pelo perfil (`src/lib/contentPiece.ts:352-407`). Não há paginação no repo (`INSTAGRAM_MAX_RESULTS_CAP=50`). Falha depois de um match/download já vira "Falhou" com mensagem.
- **Precedente a olhar:** `docs/plans/central-conteudos-varredura-instagram.md` (C212 §Q1/Q2/Q4 — limites e regra de terceiro) e `downloadSource` (`src/utilities/speech/speechMediaPipeline.ts`) como download remoto→mídia.
- **Risco de acoplamento:** não reusar o caminho do sync do board (lock transacional do hook, snapshot, kill switch, cache de 5 min); o `sourceUrl` canônico é a identidade (não criar peça gêmea); `curatedFields` da assessoria não podem ser sobrescritos; nada de import que feche ciclo.

## Dependências

- **Dura: C211 (#1254)** — o fluxo de link, a ficha e o pipeline existem; este item corrige o comportamento (defeito).
- **Soft: C212 (#1256, entregue)** — os achados (janela de 50 sem paginação, `media_url`, regra de terceiro) são a base da decisão.
- Credencial do Instagram já governada pelo `SocialFeedSettings` (admin-only) — a ausência dela vira motivo honesto, não tela nova.

## Fora de escopo

- Varredura agendada do perfil (webhook + reconciliação + cursor próprio) — recomendação do C212 §Q4; vira item próprio se produto quiser.
- oEmbed/embed de terceiro (C211-FOLLOWUP-OEMBED, #1263) e download/persistência de mídia de terceiro (permanente).
- Backfill/reprocessamento em massa de peças-link antigas — item próprio, se produto quiser; "anexar arquivo" segue como caminho.
- Montar carrossel/álbum a partir dos filhos; redesenhar feed/board da home; nova tela ou novo estado de sync.

## Rabbit holes de produto

- **"Já que vai paginar, varre o perfil inteiro".** Se alguém "só completar": webhook, agendador, cursor e painel de status. **Corte neste item:** só o link colado é procurado; a varredura é outro item (C212 §Q4).
- **"A API não achou → scraping/yt-dlp".** Se alguém "só completar": crawler e download de terceiro. **Corte:** nunca; o resultado é motivo honesto + anexar arquivo.
- **"Carrossel vira álbum".** Se alguém "só completar": baixar cada filho, montar álbum, inventar capa. **Corte:** carrossel fica peça-link com motivo.
- **"Reprocessar todo o acervo".** Se alguém "só completar": job em massa sobre peças-link antigas. **Corte:** o fix vale para colagens novas; o resto é item próprio.
- **"Consertar o token/tela de config".** Se alguém "só completar": novo painel de credencial. **Corte:** `SocialFeedSettings` já é o dono; falta de credencial é motivo na ficha.

## Questões em aberto (produto)

- **Até onde a busca pelo post deve ir para trás?** **Opções:** A) paginação limitada (tudo dentro de uma janela declarada) | B) só as N mais recentes | C) só a janela atual (50). **Recomendação:** A, com motivo honesto quando o post estiver além da janela. _(assumido — validar com produto)_
- **O que o operador vê quando a extração falha?** **Opções:** A) motivo só na ficha | B) motivo na ficha + selo na lista. **Recomendação:** A — a lista mantém o estado atual (evita ruído novo); o detalhe é onde a decisão acontece. _(assumido — validar com produto)_
- **Aceitar também links prefixados pelo perfil e outras grafias?** **Opções:** A) sim, as grafias que o copiar-e-colar do browser produz | B) só a forma canônica atual. **Recomendação:** A — nunca aceitar stories/terceiros; o que muda é só a grafia do próprio post. _(assumido — validar com produto)_

## Referências

- GitHub Issue — a registrar com `pnpm agent:register`.
- Design UI (gate): `docs/plans/central-conteudos-link-instagram-ui-design.html` (+ assets em `central-conteudos-link-instagram-ui-design-assets/`)
- Planos irmãos: `docs/plans/central-conteudos-ingestao.md` (C211) · `docs/plans/central-conteudos-varredura-instagram.md` (C212)
- Arquivos-pista: `src/utilities/content/contentPieceLink.ts` · `src/utilities/content/contentPieceJob.ts` · `src/lib/contentPiece.ts` · `src/utilities/socialFeed/instagramFeed.ts` · `src/app/(campaign)/campanha/actions/contentPieces.ts` · `src/components/campaign/content/AddContentPieceLinkDialog.tsx` · `src/components/campaign/content/ContentPieceCardList.tsx` · `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/[id]/page.tsx`
- `AGENTS.md` — guardrails de campanha (sem scraping, sem credencial em log) e convenções de UI/nav

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — link do próprio perfil deixa de degradar em silêncio (baixa e cataloga, ou explica).
2. Appetite declarado e a intenção cabe? **Sim** (~1,5–2 dias; varredura, backfill e scraping cortados).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — áreas e fatos como pista, sem contrato técnico.
5. Zero decisões duras de engenharia no plano? **Sim** — paginação, armazenamento do motivo e shape ficam no plano de implementação.

**Score: 5/5.**
