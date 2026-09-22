# C211 — Central de Conteúdos — enviar, transcrever e catalogar as peças de campanha (interno)

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1254
Priority: P1
Impeccable: C — fluxo novo na vertical `/campanha/comunicacao`
Design UI: docs/plans/central-conteudos-ingestao-ui-design.html
Appetite: ~2–3 dias eng; um outcome verificável — a assessoria sobe um lote de peças (ou cola um link) e cada peça sai catalogada, transcriada e com estado de publicação
Responsável: —

## Intenção

A campanha "Peça voto pra Solla 1313" vai ter uma página pública com todo o material — Reels, textos, fotos, jingles, cards. Mas o material de campanha vive hoje em pastas de celular, grupos e drives: ninguém sabe o que já existe, nada é encontrável por assunto e a peça vira garimpo manual na hora de publicar.

Este item é o lado interno: a assessoria envia peças em lote (ou cola um link do Instagram/YouTube), e cada peça é transcrita, catalogada com o máximo de detalhes e depois publicada/despublicada com um gesto. Peça que entra por link tem a mídia extraída e catalogada quando a plataforma oferecer caminho oficial; onde não houver, ela circula pelo link e a assessoria pode anexar o arquivo original. A página pública é o S27 e a busca semântica pública é o S28 — este item entrega o material catalogado que os dois vão consumir.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`, "Assessor de Comunicação"), na mesa, recebendo muitas peças por dia de gente diferente; `coordinator`/`candidate` também usam. `advisor`/`leader` não veem nada (fail-closed).
- **Job principal:** subir o material da campanha de uma vez e deixá-lo catalogado o bastante para a peça certa ser encontrada e publicada.
- **Fluxo desejado:** abre `/campanha/comunicacao/conteudos` → "Enviar peças" (vários arquivos de uma vez) ou "Adicionar por link" (Instagram/YouTube; a mídia é extraída quando houver caminho oficial) → cada peça tem estado visível → ao ficar "Pronto", a peça já vem com título, descrição, tipo, temas, cidade, região, instituição, data, duração e transcrição/texto → a assessoria revisa e edita o que quiser → "Publicar" quando for a hora; "Despublicar" tira da Central na hora, sem apagar o arquivo → se "Falhou", "Reprocessar".
- **Anti-goals de produto:** não é editor de vídeo nem estúdio de card; não duplica peça que já tem dono no site (jingle/artigo); não espelha o Instagram sozinho; não é dashboard de vaidade; não apaga arquivo em silêncio ao despublicar.

### Esboço de fluxo (C)

```text
[/campanha/comunicacao/conteudos]
  → "Enviar peças": N arquivos de uma vez (ou "Adicionar por link" Instagram/YouTube
    — a mídia é extraída e catalogada quando houver caminho oficial; senão, peça-link)
  → uma peça por arquivo; estados por peça (Processando → Pronto | Falhou)
  → Pronto: catalogação automática preenche os campos; assessoria revisa e edita tudo
  → "Publicar" (entra na Central pública) | "Rascunho" (fora)
  → "Despublicar" tira da Central na hora e preserva o arquivo
  → Falhou: "Reprocessar" (uma peça não derruba as outras)
[outcome: acervo de peças de campanha catalogado e publicável, sem garimpo]
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-ingestao-ui-design.html` — lista com estados, envio em lote, adicionar por link, ficha da peça (catalogação editável) e publicação, na linguagem visual do `/campanha`.

## Objetivo e aceite

- `communicator` — e `coordinator`/`candidate` — opera a Central; `advisor`/`leader` negados (fail-closed).
- Envio em lote: vários arquivos numa ação → uma peça por arquivo; falha de um não derruba os outros e cada peça tem estado próprio ("Processando" | "Pronto" | "Falhou").
- Vídeo e Áudio saem com transcrição; Texto sai com o texto extraído; Foto e Card não exigem transcrição.
- Catalogação automática é ponto de partida: título, descrição, tipo, temas, cidade, região, instituição, data, duração e transcrição/texto sempre editáveis pela assessoria.
- Adicionar por link (Instagram/YouTube) cria a peça e, quando a plataforma oferecer caminho oficial de acesso à mídia (ex.: API do Instagram para a própria conta), o arquivo é extraído e passa pelo mesmo pipeline de transcrição/catalogação; sem caminho oficial, a peça circula pelo link e a assessoria pode anexar o arquivo original.
- "Rascunho" fica fora da Central pública; "Publicado" aparece; despublicar tira na hora e preserva o arquivo; "Falhou" permite "Reprocessar".
- **Guardrails:** extração só por caminhos oficiais, nunca scraping/contorno (a varredura automática é investigada no C212); sem PII de eleitor; sem disparo em massa; acervo de falas e cortes só entram se a assessoria adicionar manualmente como peça; sem segundo cadastro de pessoa.

## Dados (intenção)

- **Vou apresentar dados?** Sim, só derivado — a catalogação (metadados + transcrição/texto) é dado estruturado consumido por S27/S28 e, depois, pelo C213; este item não apresenta agregado nem KPI.
- **Decisões desbloqueadas:** N/A — a escolha da assessoria é editorial ("qual peça publicar/despublicar"), não numérica.
- **Forma:** N/A — restrição de produto: sem contadores de vaidade (views/curtidas) e sem score de busca exposto na tela.

## Dados da decisão (literais)

- **Rota interna:** `/campanha/comunicacao/conteudos`; sub-item "Conteúdos" na nav de Comunicação.
- **Papel:** `communicator` = "Assessor de Comunicação"; `coordinator`/`candidate` também; `advisor`/`leader` negados (gate de comunicação, fail-closed).
- **Tipos de peça:** "Vídeo" | "Foto" | "Texto" | "Áudio" | "Card".
- **Publicação:** "Rascunho" | "Publicado" — despublicar tira da Central na hora, arquivo preservado.
- **Processamento:** "Processando" | "Pronto" | "Falhou" (com "Reprocessar").
- **Envio em lote:** vários arquivos numa vez → uma peça por arquivo; falha de um não derruba os outros.
- **Catalogação automática (revisável):** título, descrição, tipo, temas, cidade, região, instituição, data, duração, transcrição/texto.
- **Adicionar por link:** Instagram/YouTube (colar link) — a peça entra com a mídia extraída e catalogada quando houver caminho oficial; sem caminho oficial, circula pelo link e o arquivo pode ser anexado pela assessoria. Mídia de terceiro nunca é baixada.
- **Varredura automática do Instagram:** investigação aprovada no gate → **C212** (viabilidade com API oficial × scraping; o C211 aplica o mecanismo que ela recomendar). Scraping não é mecanismo — nem no C211 nem no C212.
- **Acervo de falas e cortes:** fora por produto; entram só se a assessoria adicionar manualmente como peça.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/comunicacao/conteudos/`, `src/components/campaign/<dominio>/`, `src/utilities/<dominio>/`, `src/collections/`, `src/lib/campaignPaths.ts` + `src/components/campaign/shell/nav.ts`.
- **Precedente a olhar:** C199 (`src/collections/Recording*.ts`, `src/utilities/recordings/recordingUpload.ts|recordingJob.ts|recordingScheduler.ts`, rota `.../acervo/gravacoes/enviar/route.ts`, estados em `src/lib/recording.ts`, retry em `src/app/(campaign)/campanha/actions/recording.ts`); catalogação (`speechClassifier.ts`, `speechCutMetadata.ts`, taxonomias em `src/lib/speechFacets.ts|municipalityCatalog.ts|bahiaTerritories.ts|institutionCatalog.ts`); kill switch + revalidação (`Jingle.ts`, `src/utilities/documents.ts`, `jingleReads.ts`); listas (`CampaignTable.tsx`, `CampaignListOmnibox.tsx`, `campaignListUrl.ts`); feeds oficiais (`SocialFeedSettings`, `instagramFeed.ts`, `youtubeFeed.ts`) — hoje não há fetch por link (oEmbed), só listagem do perfil.
- **Risco de acoplamento:** (1) não existe upload em lote no app — o job roda via `after()` no mesmo processo, então N arquivos = N jobs concorrentes (o lote precisa de política própria; decisão do plano de implementação); (2) mídia da peça publicada vs mídia privada do C199/C193 — respeitar o dono de cada mecanismo, sem segunda cópia de arquivo que já tem dono; coleção de upload nova precisa entrar na lista do plugin S3; (3) sub-item novo na nav exige serializar com itens em voo; (4) gate de comunicação já existe — não criar gate gêmeo.

## Dependências

- Nenhuma dura aberta — reusa C199 (upload + transcrição), C193 (mídia privada) e C194 (biblioteca interna, kill switch/revalidação) entregues.
- Soft: **C212** (investigação da varredura/extração) refina o caminho de link; S27 (página pública) e S28 (busca semântica) consomem este item; C213 (analytics) vem depois. Não invadir esses escopos.

## Fora de escopo

- Página pública da Central (S27) e busca semântica pública (S28).
- Analytics de consumo (C213).
- Scraping/varredura do perfil do Instagram — a viabilidade é o C212; a implementação, se aprovada, é item próprio.
- Download/espelho de mídia de terceiro (só a própria conta, por caminho oficial).
- Editor de vídeo, gerador de card personalizável e edição de mídia.
- Ingestão automática do acervo de falas/cortes.
- Aprovação editorial multi-etapas e fluxo de revisão com mais de um aprovador.

## Rabbit holes de produto

- **Scraping do Instagram.** Se alguém "só completar": crawler, login em conta, bloqueio e risco jurídico. **Corte neste item:** caminhos oficiais e link; a varredura é investigada no C212 e nunca por scraping.
- **Segundo CMS/acervo paralelo.** Se alguém "só completar": reupload de jingle/artigo que já têm dono, com duas fontes de verdade. **Corte neste item:** peça convive com o dono existente; sem cópia de arquivo que já tem dono.
- **Estúdio de criação.** Se alguém "só completar": templates, corte, legenda queimada, editor embutido. **Corte neste item:** catalogar, transcrever e publicar — criar peça é de outra ferramenta.
- **Publicação automática sem curadoria.** Se alguém "só completar": tudo que sobe já aparece no público. **Corte neste item:** "Rascunho" é o padrão e publicar é gesto explícito.
- **Infra de fila/upload genérico.** Se alguém "só completar": fila, retomada, chunking, retry global, tempo real. **Corte neste item:** lote com estado por peça e "Reprocessar".

## Questões em aberto (produto)

- **Varredura automática do Instagram?** **Decidido no gate:** investigar agora, via **C212** (viabilidade com a API oficial; scraping fora). O C211 mantém o link manual como caminho e aplica o mecanismo que o C212 recomendar. _(decidido)_
- **Peça nasce "Rascunho" ou "Publicado"?** **Opções:** A) "Rascunho" por padrão, publicar é gesto explícito | B) publica no envio | C) escolher no envio. **Recomendação:** A — evita material sem revisão no ar e deixa o kill switch com lugar claro. _(assumido — validar com produto)_
- **Peça por link: circula ou é baixada?** **Decidido no gate:** extrair e catalogar quando houver caminho oficial (conteúdo próprio); sem caminho oficial, circular pelo link. **Corte que permanece:** mídia de terceiro nunca é baixada. _(decidido — refinar no C212)_
- **Limite do envio em lote?** **Opções:** A) limite generoso com aviso claro acima dele | B) sem limite | C) limite baixo (≈10). **Recomendação:** A — o caso real é despejo de material de um evento; o valor é decisão da implementação. _(assumido — validar com produto)_

## Referências

- Design UI (gate): `docs/plans/central-conteudos-ingestao-ui-design.html` (+ assets em `central-conteudos-ingestao-ui-design-assets/`)
- Planos irmãos: `docs/plans/acervo-gravacoes-enviadas.md` (C199) · `docs/plans/reels-reel-privado.md` (C193) · `docs/plans/reels-biblioteca.md` (C194) · `docs/plans/central-conteudos-publica.md` (S27) · `docs/plans/central-conteudos-busca-semantica.md` (S28) · `docs/plans/central-conteudos-varredura-instagram.md` (C212)
- Arquivos-pista: `src/collections/Recording.ts` · `src/collections/RecordingMedia.ts` · `src/utilities/recordings/recordingUpload.ts` · `src/utilities/recordings/recordingJob.ts` · `src/utilities/recordings/recordingScheduler.ts` · `src/lib/recording.ts` · `src/utilities/speech/speechClassifier.ts` · `src/utilities/speech/speechCutMetadata.ts` · `src/collections/Jingle.ts` · `src/globals/SocialFeedSettings.ts` · `src/utilities/socialFeed/instagramFeed.ts` · `src/utilities/socialFeed/youtubeFeed.ts` · `src/lib/campaignPaths.ts` · `src/components/campaign/shell/nav.ts` · `src/lib/campaignRoles.ts` · `src/utilities/campaignPageActor.ts`
- `AGENTS-campaign.md` — RBAC da vertical `/campanha`, comunicação interna e leader lockdown

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — lote/link entra e a peça sai catalogada e publicável.
2. Appetite declarado e a intenção cabe? **Sim** (~2–3 dias; scraping e editor cortados para fora).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — precedentes e riscos, sem contrato técnico.
5. Zero decisões duras de engenharia no plano? **Sim** — schema, fila, limites e coleção ficam para o plano de implementação.

**Score: 5/5.**
