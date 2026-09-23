# C212 — Central de Conteúdos — viabilidade da varredura automática do Instagram (e da extração de mídia por link)

Status: entregue (2026-09-22 — investigação; ver "Achados (C212)")
Atualizado em: 2026-09-22
Issue: #1256
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável — as quatro perguntas respondidas com evidência (repo + docs oficiais) e uma recomendação de mecanismo, limites e cortes, sem implementar
Responsável: —

## Intenção

No gate do C211 o dono decidiu duas coisas: peça adicionada por link entra com a mídia extraída e catalogada, não só com o link; e, sobre a ingestão do Instagram, "investigar varredura automática agora". A eleição é 04/10 e a Central (C211/S27) ainda vai nascer — se a varredura for viável, ela muda o desenho da ingestão antes de existir; se não for, o C211 precisa saber com evidência, não por precaução genérica.

O Teqo já tem integração oficial com a Graph API do Instagram (feed da home, S11) e com a YouTube Data API v3 (S2). O que falta saber é se esses mesmos caminhos oficiais bastam para a Central catalogar/transcrever mídia, o que exatamente eles não entregam e a que custo (limites, token, curadoria). Este item entrega a investigação com evidência e recomendação; a implementação (se aprovada) vira item próprio.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (`communicator`) que vai operar a Central; e quem decide produto/engenharia (`coordinator`/`candidate` e o dono no gate).
- **Job principal:** saber, com evidência, se a varredura automática do perfil e a extração de mídia por link são viáveis e sob quais limites — para decidir o que implementar no C211.
- **Fluxo desejado:** pergunta → evidência (o que o repo já faz + docs oficiais datadas) → recomendação (mecanismo, limites, o que fica de fora, próximo item) → decisão no gate.
- **Anti-goals de produto:** não é a implementação da varredura nem da extração; não vira spike de scraping; não redesenha o feed da home; não cria tela; não promete o que não é verificável.

## Objetivo e aceite

- **Q1 — a Graph API oficial já integrada entrega as mídias recentes do perfil do Solla com metadados e `media_url` suficientes para catalogar/transcrever?** Resposta com campos, paginação, rate limit, validade/refresh do token e periodicidade segura, citando o que a integração atual pede e o que descarta (`src/utilities/socialFeed/instagramFeed.ts`) + docs oficiais. Limite/expiração que não se confirmar na doc: declarar **"a confirmar na implementação"** — nunca estimar.
- **Q2 — peça por link (IG/YT):** qual o caminho oficial/aceitável de extração em cada plataforma; o que NÃO é aceitável (scraping, contorno, download de mídia de terceiro); e o que fazer quando não há caminho oficial — a peça circula pelo link e a assessoria pode anexar o arquivo (refina a regra do C211).
- **Q3 — varredura automática do perfil: vale a pena?** Comparar explicitamente (A) API oficial agendada/recebida; (B) scraping; (C) sem varredura (link manual do C211) — com curadoria proposta (o que entra, rascunho, filtro por tipo/período), riscos (ToS da Meta, bloqueio de conta/IP, jurídico/reputacional, fragilidade) e custo operacional.
- **Q4 — recomendação final:** mecanismo, limites, o que fica de fora e o item de implementação que nasceria daí (descrito, não criado).
- **Registro:** os achados ficam anexados a este plano (seção de achados, com links oficiais datados) — o entregável é decisão documentada, não código.
- **Guardrails:** NUNCA scraping/contorno como mecanismo recomendado; se a conclusão for que só o scraping alcança algo desejado, a recomendação é NÃO fazer e dizer o que se perde. Nada entra na Central pública sem curadoria (rascunho → publicado). Sem PII; sem credencial em log. A investigação não altera comportamento de produção (feed da home intocado); evidência = repo + docs oficiais, com probe na API real só leitura, se necessário.

## Dados (intenção)

- **Vou apresentar dados?** Não — não há superfície de dados: o resultado é decisão documentada (evidência citada + recomendação), não métrica ou agregado para usuário.
- **Decisões desbloqueadas:** N/A — a decisão é do gate (dono), a partir da recomendação.
- **Forma:** N/A.

## Dados da decisão (literais)

- **Decisão do dono no gate (verbatim):** "Quando o assessor adiciona uma peça por link do Instagram ou Youtube, a mídia deve ser automaticamente extraída e catalogada."; e "Investigar varredura automática agora".
- Peça por link entra com a mídia extraída e catalogada **quando houver caminho oficial**; sem caminho oficial, a peça circula pelo link e a assessoria pode anexar o arquivo (isto é o C211; aqui só se refina).
- **NUNCA scraping/contorno de plataforma como mecanismo recomendado**; se a investigação concluir que scraping é a única via para algo desejado, a recomendação é NÃO fazer e dizer o que se perde.
- **Curadoria:** nada entra na Central pública sem passar pela assessoria ("Rascunho" → "Publicado" — regra do C211).
- **Nada de PII; nada de credencial em log.**
- **Escopo de plataformas:** Instagram (`@depjorgesolla`, conta Business/Creator) e YouTube (canal oficial `@JorgeSollaDep`) — demais redes fora.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/socialFeed/` (`instagramFeed.ts`, `instagramFeedView.ts`, `instagramSync.ts`, `youtubeFeed.ts`), `src/globals/SocialFeedSettings.ts`, `src/lib/speechVod.ts` (parse de link de YouTube já existente) e o runbook `docs/ops/instagram-feed-token-runbook.md`; a Central é o C211.
- **Fatos já verificados no repo (ponto de partida, a revalidar):** a integração pede `id,caption,media_type,media_url,permalink,thumbnail_url,timestamp,children{...}` em `GET /{userId}/media` (`instagramFeed.ts:94`) — o `media_url` chega, mas hoje é descartado no parse (vira thumbnail, `instagramFeed.ts:111`); `limit` é capado em 50 (`instagramFeed.ts:223`) e o sync busca `maxItems + 10` (`instagramSync.ts:103`); não há paginação (`paging.cursors.after`) nem fetch por link (grep por oEmbed = 0); o refresh é `grant_type=ig_refresh_token` (`instagramFeed.ts:237`); a YouTube Data API (`search.list`/`videos.list`) não fornece arquivo de vídeo; o feed é atualizado por render com cache de 5 min (`instagramFeedView.ts:96`) — cadência de board, não de acervo.
- **Precedente a olhar:** S3 (`docs/plans/secao-conteudos-home-instagram.md`) e o runbook do token; C199 (`src/utilities/recordings/recordingScheduler.ts`) se a varredura agendada for aprovada; C211 para o encaixe da peça-link.
- **Risco de acoplamento:** o feed da home tem contrato próprio (fail-closed, snapshot, kill switch) — a investigação não o redesenha; se a varredura usar o mesmo token/global, a proposta deve explicitar como não ampliar o escopo do board nem criar segundo estado de sync.

## Dependências

- **Soft: C211** — este item informa a implementação dele (ingestão por link e eventual varredura); o C211 começa sem este (link manual é o fallback). **S27 não depende.**
- Credenciais Meta/Google já existentes (token/ID IG e API key YT no `SocialFeedSettings`); a validade real do token é parte da investigação (painel de status + runbook).

## Fora de escopo

- Implementar a varredura (se aprovada, vira item próprio) e implementar a extração de mídia por link.
- Qualquer scraping/contorno, download de mídia de terceiro ou automação de conta.
- Mudar a integração do feed da home (S3) ou o board público.
- Criar UI nova (o resultado é decisão documentada; a UI da Central é do C211).
- Transcrição/embeddings (C211/S28) e analytics (C213).

## Rabbit holes de produto

- **"Investigar virou implementar".** Se alguém "só completar": cria coleção, agendador, rota e migration dentro da investigação. **Corte neste item:** o entregável é evidência + recomendação; implementação é item próprio.
- **"Scraping porque a API não dá conta".** Se alguém "só completar": crawler, login em conta, contorno para pegar mídia de terceiro ou perfil fora do caminho oficial. **Corte:** nunca como recomendação; a investigação diz o que se perde e para.
- **"Cobrir todas as redes".** Se alguém "só completar": TikTok, Facebook, X, Kwai. **Corte:** escopo é Instagram + YouTube, as duas com oficialidade já decidida.
- **"Credencial/estado no lugar errado".** Se alguém "só completar": token em arquivo/log, cursor de varredura em memória, mídia em pasta sem dono. **Corte:** credencial só no `SocialFeedSettings` (admin-only), nunca em log; estado novo tem dono definido no item de implementação.

## Questões em aberto (produto)

- **Se a varredura for aprovada, o que ela traz?** **Opções:** A) só as mídias recentes do perfil oficial, tudo como rascunho para a assessoria triar | B) varredura com filtro (ex.: só Reels/vídeos, janela de período) que já descarta o que não interessa | C) tudo entra direto na Central. **Recomendação:** A — rascunho é a regra do C211 e a triagem é editorial; filtro fino (tipo/período) é decisão de implementação com a assessoria. _(assumido — validar com produto)_
- **Peça por link de perfil de terceiro (ex.: post que menciona o Solla):** **Opções:** A) entra só pelo link, sem extrair/baixar mídia | B) entra com thumbnail/embed quando o caminho oficial (oEmbed) permitir | C) não aceitar link de terceiro. **Recomendação:** B, com o arquivo nunca baixado — o caminho oficial de terceiro dá embed/thumbnail, não o arquivo; extração de mídia só para conteúdo próprio (conta do Solla via Graph API). _(assumido — validar com produto)_
- **Periodicidade, se aprovada:** **Opções:** A) varredura diária agendada + "Sincronizar agora" | B) semanal | C) só sob demanda. **Recomendação:** A — a Central é acervo, não tempo real; a cadência de board (5 min) não serve, e o custo em chamadas da API é assunto da implementação. _(assumido — validar com produto)_

## Achados (C212)

> Investigação entregue em **2026-09-22**. Baseline de código verificado no commit `6d721ec7` (worktree C212); docs oficiais consultadas e datadas na mesma data; probes públicos somente leitura, sem credencial. Nada aqui é implementação — nenhum arquivo de `src/` foi tocado.

### Q1 — a Graph API oficial já integrada entrega as mídias recentes do perfil com metadados e `media_url` para catalogar/transcrever?

**Sim, em campo — e não no que o Teqo guarda hoje.** A integração atual (`src/utilities/socialFeed/instagramFeed.ts`, Instagram API com Instagram Login, host `graph.instagram.com`) **pede** os campos certos e **descarta** o `media_url` de vídeo/Reel por decisão de design do board ("never the mp4", `:105-108`).

Campo a campo (pedido em `instagramFeed.ts:94-103` × parse `:146-180` × o que a doc diz):

| Campo pedido                        | Hoje no repo                                                                                                           | O que a doc oficial diz                                                                                                                                                  | Serve para catalogar/transcrever?                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                | guardado (`InstagramPost.id`)                                                                                          | id do IG Media                                                                                                                                                           | sim — chave de dedupe                                                                                                                         |
| `caption`                           | guardado                                                                                                               | legenda                                                                                                                                                                  | sim                                                                                                                                           |
| `media_type`                        | guardado (`IMAGE`/`VIDEO`/`REEL`/`CAROUSEL_ALBUM` no repo)                                                             | doc de referência lista `CAROUSEL_ALBUM`, `IMAGE`, `VIDEO` (`REELS` aparece em `media_product_type`) — enum real do host do Instagram Login a confirmar na implementação | sim                                                                                                                                           |
| `media_url`                         | **descartado** no parse; usado só como thumbnail quando `IMAGE`/filho de carrossel (`pickInstagramThumbnail :111-136`) | "The URL for the media"; **omitido** em mídia com material protegido por direito autoral (ex.: áudio em Reels)                                                           | **é o campo do arquivo**: imagem → imagem; vídeo/Reel → arquivo de vídeo (o comentário do módulo registra que é o mp4). É o que falta guardar |
| `permalink`                         | guardado                                                                                                               | URL permanente do post                                                                                                                                                   | sim                                                                                                                                           |
| `thumbnail_url`                     | guardado                                                                                                               | capa; doc: "Only available on `VIDEO` media"                                                                                                                             | sim (capa)                                                                                                                                    |
| `timestamp`                         | guardado                                                                                                               | criação em ISO 8601                                                                                                                                                      | sim                                                                                                                                           |
| `children{media_url,thumbnail_url}` | só o primeiro filho com URL vira capa de carrossel; nenhum filho é guardado                                            | filhos do carrossel                                                                                                                                                      | para catalogar carrossel item a item, hoje não; o `media_url` de cada filho é o arquivo                                                       |

**Paginação — não existe no repo; existe na doc.** Grep: `paging|cursors` = 0 em `src/utilities/socialFeed/`. Hoje: só `limit` (capado em 50, `INSTAGRAM_MAX_RESULTS_CAP` `:10`, `instagramFeed.ts:221-225`) e o sync busca `maxItems+10` (`instagramSync.ts:103-110`). A doc da edge `/{ig-user-id}/media` documenta **time-based pagination** (`since`/`until`); a Graph API documenta **cursor pagination** (`paging.cursors.after`/`next` + `limit`) como paginação geral — é o caminho para backfill (varredura inicial e reconciliação). Limite da edge: "Returns a maximum of 10K of the most recently created media"; **stories não são suportados** nessa edge. _(IG User Media — developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media · Graph API Results — developers.facebook.com/docs/graph-api/results, consultados em 2026-09-22.)_

**Rate limit — documentado, e não é número fixo.** A Overview da plataforma: as edges estão sujeitas ao Instagram Business Use Case rate limiting, `Calls within 24 hours = 4800 * Number of Impressions` (impressões de conteúdo da conta nas últimas 24 h), e recomenda **webhooks** "to receive notifications about your app users' media objects" em vez de polling. _(Instagram Platform Overview — developers.facebook.com/documentation/instagram-platform/overview, consultado em 2026-09-22.)_ O número absoluto para @depjorgesolla depende das impressões reais — **a confirmar na implementação** (nunca estimado).

**Token — documentado.** Long-lived Instagram User Access Token expira em **60 dias**; `GET /refresh_access_token?grant_type=ig_refresh_token` aceita token com **≥24 h de idade e não expirado** e devolve token novo por mais 60 dias, com `expires_in` em segundos na resposta. _(Refresh Access Token — developers.facebook.com/documentation/instagram-platform/reference/refresh_access_token · Access Token — developers.facebook.com/documentation/instagram-platform/reference/access_token, consultados em 2026-09-22.)_ Hoje o repo chama o refresh **só depois de uma falha**, não lê `expires_in` e não persiste validade (`instagramFeed.ts:236-255`); o `SocialFeedSettings` não tem campo de expiração. O runbook já registra que page token do Facebook Login é recusado (`docs/ops/instagram-feed-token-runbook.md:26-29`).

**Periodicidade segura.** A cadência de board (cache de 5 min, `instagramFeedView.ts:96`) **não serve** para acervo. A doc não fixa cadência; com a fórmula de rate limit e o webhook como caminho recomendado, a proposta do plano (A: diária + "Sincronizar agora") cabe — número final e estratégia (webhook de mídia + reconciliação periódica) são **decisão da implementação**, com as impressões reais como dado.

**Lacunas para o C211 (o que falta para a peça sair do perfil próprio e chegar ao pipeline de transcrição):** (1) guardar `media_url` (o parse descarta); (2) baixar o arquivo do próprio perfil e gravá-lo em `media` — precedente é `downloadSource` do acervo (`src/utilities/speech/speechMediaPipeline.ts:25-59`), não há uploader genérico remote-URL→media; (3) paginar/backfill por cursor; (4) estado próprio da varredura (cursor, última varredura, dedupe por `id`) — **sem** reusar o caminho do board: o sync do hook roda dentro da transação do save segurando o row lock (`instagramSync.ts:28-34,59-79`) e o módulo do feed não pode importar `@payload-config` (gate de ciclos, `instagramFeedView.ts:44-48`); o acervo não pode herdar kill switch, snapshot nem cache de 5 min do board.

### Q2 — peça por link (IG/YT): qual o caminho oficial de extração; o que não é aceitável

**Instagram — conteúdo próprio (conta do Solla):** Graph API oficial; o `media_url` do próprio media é o arquivo (com a ressalva de áudio protegido, em que o campo é omitido). É o caminho para extrair e catalogar no C211.

**Instagram — conteúdo de terceiro (ex.: post que menciona o Solla):** o caminho oficial é oEmbed/embed, e ele tem limite duro. Probe (2026-09-22, sem credencial): `GET /instagram_oembed?url=…` devolveu **200** com o HTML do embed (post público), mas pedir metadados (`fields=thumbnail_url,author_name`) sem app devolveu **403 `(#200) Provide valid app ID`**. A doc do oEmbed é explícita: o endpoint é **só para exibir o post embutido** — "consuming, manipulating, extracting, or persisting the metadata and content … is strictly prohibited" _(Embed an Instagram Post — developers.facebook.com/documentation/instagram-platform/oembed, consultado em 2026-09-22)_. Consequência para o C211: a peça de terceiro circula **pelo link**, o embed/thumbnail pode ser **renderizado** (visão de front-end) e **nada é persistido/baixado**. A edge `mentioned_media` (leitura) cobre mídia em que a conta foi mencionada — as `mentions` são de comentário em menção; nenhuma delas muda a regra de produto: mídia de terceiro nunca é baixada.

**YouTube:** a Data API v3 **não entrega arquivo de vídeo** — as partes de `videos.list` são `brandPartner, contentDetails, fileDetails, id, liveStreamingDetails, …, player, …, snippet, statistics, …`, e a reprodução oficial é o embed do player (`player.embedHtml`); `fileDetails` é só do dono e é metadado do arquivo, não URL de download _(Videos: list — developers.google.com/youtube/v3/docs/videos/list, consultado em 2026-09-22)_. O oEmbed público funciona **sem chave** — probe (2026-09-22): `www.youtube.com/oembed?url=https://www.youtube.com/watch?v=i_fbclWWC5o` devolveu **200** com `title`, `author_name: "Jorge Solla"`, `thumbnail_url` e `html` (iframe) — serve para título/capa/embed, não para o arquivo.

**O que NÃO é aceitável (nem como recomendação, nem como evidência):** scraping; login/automação de conta; contorno de embed, privacidade ou limite; baixar mídia de terceiro (yt-dlp ou similar) — bases citáveis em Q3.

**Sem caminho oficial:** a peça circula pelo link; o arquivo que a assessoria **já tem em mãos** pode ser anexado por ela (gesto humano do C211) — da plataforma nada é extraído, baixado ou persistido. O embed é permitido como visão de front-end.

### Q3 — varredura automática do perfil: vale a pena?

| Critério              | (A) API oficial agendada/recebida                                                                                                                  | (B) Scraping                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | (C) Sem varredura (link manual)              |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| Entrega               | mídias recentes do perfil oficial com metadados e `media_url` (próprias); sem stories e além das 10K mais recentes                                 | o que for público (e mais, com sessão)                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | só o que a assessoria colar                  |
| Curadoria             | tudo como **Rascunho**; dedupe por `id`; filtro tipo/período é decisão da implementação                                                            | idem, com triagem maior                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | natural (gesto humano)                       |
| ToS                   | permitido — é a API oficial                                                                                                                        | **proibido** sem permissão escrita: Automated Data Collection Terms ("You will not engage in Automated Data Collection without first obtaining Meta's express written permission"; Effective October 7, 2024) + Platform Terms §3.a (uso fora dos propósitos permitidos; enforcement pode remover App e conta, §7) + Developer Policies do YouTube ("must not … scrape … or obtain scraped YouTube data or content"; "must not … download, import, backup, cache, or store copies of YouTube audiovisual content") | isento                                       |
| Risco operacional     | erro vira status no painel (precedente S11)                                                                                                        | bloqueio de conta/IP, quebra de markup, manutenção permanente; barato agora, caro depois                                                                                                                                                                                                                                                                                                                                                                                                                           | nenhum                                       |
| Jurídico/reputacional | baixo (conteúdo próprio, caminho oficial)                                                                                                          | direito autoral de terceiros, dados pessoais em legendas, vínculo do mandato com prática não permitida                                                                                                                                                                                                                                                                                                                                                                                                             | baixo                                        |
| Custo                 | ~1 chamada de mídia por varredura + download das próprias peças; o rate limit tende a sobrar para a cadência diária — número real a confirmar (Q1) | crawler + sessão + proxy + retrabalho contínuo                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | triagem manual                               |
| Veredito              | **recomendado**                                                                                                                                    | **não fazer**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | fallback permanente e caminho padrão do C211 |

_(Bases datadas em 2026-09-22: Automated Data Collection Terms — facebook.com/legal/automated_data_collection_terms · Meta Platform Terms — developers.facebook.com/terms · YouTube API Services Developer Policies — developers.google.com/youtube/terms/developer-policies · YouTube API Services Terms of Service — developers.google.com/youtube/terms/api-services-terms-of-service.)_

**O que se perde sem scraping (declarado, aceito):** stories, posts de terceiros/colaborativos, mídias além das 10K mais recentes (limites da edge `/media`, Q1) e conteúdo de contas que desabilitem embeds. Nada disso justifica o caminho proibido — a recomendação é NÃO fazer e dizer o que se perde.

### Q4 — recomendação final

1. **Mecanismo:** varredura pelo **caminho oficial** — Instagram API com Instagram Login (a mesma credencial já governada pelo `SocialFeedSettings`, admin-only), com webhook de mídia como recebimento preferencial e **reconciliação agendada** (diária + "Sincronizar agora") como rede; paginação por cursor para backfill; tudo entra como **Rascunho** com dedupe por `id`; download do arquivo só do **próprio perfil** (`media_url`) e só no mesmo pipeline de transcrição/catalogação do C211.
2. **Limites:** token long-lived de 60 dias renovável (≥24 h de idade, antes de expirar; guardar `expires_in`/status — decisão de implementação); rate limit pela fórmula BUC (impressões reais, a confirmar na implementação); limites da edge `/media` e a ressalva do `media_url` estão em Q1 — a implementação precisa de fallback (thumb/peça-link) e status visível; **estado da varredura com dono próprio**, sem reusar o caminho do board (lock transacional do hook, snapshot, kill switch e cache de 5 min do S3 não se ampliam).
3. **Fica de fora:** scraping e qualquer contorno (definitivo); download/persistência de mídia de terceiro; stories; automatizar publicação (curadoria humana é regra do C211); redesenhar o feed da home.
4. **Item de implementação que nasceria daí (descrito, não criado):** um item irmão do C211 — "varredura oficial do perfil + extração de mídia por link" — com: (a) cliente Graph API com paginação e estado de cursor/última varredura/dedupe; (b) webhook de mídia + rota de reconciliação (agendador no precedente C199 `after()`/`src/utilities/recordings/recordingScheduler.ts`, ou cron do deploy — decisão do item); (c) download do `media_url` próprio → coleção de mídia do C211 (entra na lista do plugin S3) → pipeline C199 de transcrição; (d) link por plataforma com embed quando oficial (IG oEmbed; YT oEmbed/iframe) e o botão "anexar arquivo" quando não houver caminho; (e) painel de estado (token/expiração/última varredura) e kill switch próprios. Dependências: C211 (dono da peça/catalogação) e S3 (contrato do board intocado); S27/S28 consomem depois. O ID/prioridade são do roadmap (`plan-issue`), não deste plano.

### A confirmar na implementação (sem credencial neste item; verificar quando houver credencial e o item de implementação aprovado; nunca estimado)

- Número absoluto de chamadas disponíveis para @depjorgesolla (depende das impressões reais na fórmula BUC; fonte: Insights da conta profissional no app/painel do Instagram).
- Comportamento da edge `/{ig-user-id}/media` no host `graph.instagram.com` com `limit` + cursor na conta real (a referência da edge descreve time-based; cursor é a paginação geral da Graph API).
- Validade/expiração do CDN por trás de `media_url` (a doc consultada não declara; a implementação deve baixar e gravar na mesma execução, sem depender de reuso do link).
- Enum real de `media_type` para Reels no host do Instagram Login (a referência lista `VIDEO`; o repo trata `REEL` defensivamente).
- oEmbed de **perfil** e com token de app (o probe sem credencial devolveu `Invalid URL`; a doc lista perfis como formato aceito) e a disponibilidade de `thumbnail_url` com token.
- Existência/limites do webhook de mídia para a conta e o atraso de entrega.

### Questões em aberto (produto) — respondidas com a evidência

- **O que a varredura traz?** A (tudo rascunho) **validada** — e delimitada: a varredura só entrega mídia própria; dedupe por `id` é requisito.
- **Peça por link de terceiro:** a hipótese B ("entra com thumbnail/embed quando o caminho oficial permitir") fica **corrigida no limite**: o embed/thumbnail pode ser **renderizado**, mas o oEmbed proíbe persistir metadados/conteúdo — então a peça de terceiro **circula pelo link**, sem catalogar/baixar mídia (C211 preservado).
- **Periodicidade:** A (diária + "Sincronizar agora") **cabe**, condicionada às impressões reais (a confirmar na implementação).

### Método e evidência

- Repo: leitura no commit `6d721ec7` (worktree C212), com greps de controle: `oembed` em `src/` = 0; `paging|cursors|429|rate.?limit` em `src/utilities/socialFeed/` = 0; `expires_in` só em `src/utilities/googleCalendarClient.ts` (fora do social feed).
- Docs oficiais: consultadas e datadas em **2026-09-22** (URLs nas respostas acima).
- Probes: somente leitura, **sem credencial**, em 2026-09-22 — transcrições:
  - `https://www.youtube.com/oembed?url=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Di_fbclWWC5o&format=json` → **200** com `title`, `author_name:"Jorge Solla"`, `author_url:"https://www.youtube.com/@JorgeSollaDep"`, `thumbnail_url:"https://i.ytimg.com/vi/i_fbclWWC5o/hqdefault.jpg"` e `html` (`<iframe … youtube.com/embed/i_fbclWWC5o …>`).
  - `https://graph.facebook.com/v25.0/instagram_oembed?url=https%3A%2F%2Fwww.instagram.com%2Fp%2FfA9uwTtkSN%2F` → **200** com `html` (blockquote do embed), sem metadados.
  - o mesmo com `&fields=thumbnail_url,author_name` → **403** `(#200) Provide valid app ID`.
  - oEmbed com `url` de perfil (`/depjorgesolla/`) → **400** `Invalid URL`.
  - Nenhum probe na Graph API autenticada; token de produção não acessado.
- Nenhum scraping, nenhum download, nenhum PII, nenhuma credencial em log.

## Referências

- Planos irmãos: `docs/plans/central-conteudos-ingestao.md` (C211) · `docs/plans/central-conteudos-publica.md` (S27) · `docs/plans/secao-conteudos-home-instagram.md` (S3) · `docs/plans/secao-conteudos-home-youtube.md` (S2)
- Runbook: `docs/ops/instagram-feed-token-runbook.md` · decisões do board: `docs/campanha/plano-site-campanha-2026.md` §4.2
- Arquivos-pista: `src/globals/SocialFeedSettings.ts` · `src/utilities/socialFeed/instagramFeed.ts` · `src/utilities/socialFeed/instagramFeedView.ts` · `src/utilities/socialFeed/instagramSync.ts` · `src/utilities/socialFeed/youtubeFeed.ts` · `src/lib/speechVod.ts`
- Docs oficiais a abrir e datar na investigação: Instagram Platform / Graph API (`developers.facebook.com/docs/instagram-platform` — media, paginação, refresh de token) · Instagram oEmbed (`developers.facebook.com/docs/instagram/oembed`) · Termos da Plataforma Meta (`developers.facebook.com/terms`) · YouTube Data API v3 (`developers.google.com/youtube/v3/docs/videos` e `/search`) · YouTube oEmbed (`www.youtube.com/oembed`) · Termos/Developer Policies do YouTube (`developers.google.com/youtube/terms`)

## Self-score (shaping)

1. Fatia = um outcome verificável? **Sim** — as quatro perguntas respondidas com evidência + recomendação.
2. Appetite declarado e a intenção cabe? **Sim** (~0,5–1 dia; implementação, scraping e UI fora).
3. Persona + job + aceite claros sem jargão de stack? **Sim**.
4. Direção no codebase é hipótese? **Sim** — fatos verificados + áreas prováveis, sem contrato técnico.
5. Zero decisões duras de engenharia no plano? **Sim** — schema, agendador e limites ficam no item de implementação, se aprovado.

**Score: 5/5.**
