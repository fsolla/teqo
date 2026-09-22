# C212 — Central de Conteúdos — viabilidade da varredura automática do Instagram (e da extração de mídia por link)

Status: rascunho
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
