# C213 — Analytics da Central de Conteúdos — uso, downloads e compartilhamentos

Status: rascunho
Atualizado em: 2026-09-22
Issue: #1258
Priority: P2
Impeccable: B — encaixe na lista de peças do C211 (contadores) sem tela nova
Design UI: docs/plans/central-conteudos-analytics-ui-design.html
Appetite: ~1–1,5 dia eng; um outcome verificável — contadores por peça na lista do C211, sem serviço novo de analytics
Responsável: —

## Intenção

A Central de Conteúdos (C211 + S27) existe para a assessoria publicar peças e o público abrir, baixar e compartilhar. Mas hoje ninguém sabe se isso acontece: o self-hosted não tem analytics ativo (`@vercel/analytics` só rende com `VERCEL === '1'`; o Meta Pixel é mídia paga, não serve) e não há coleção de eventos. O dono pediu "acompanhar a utilização dos usuários e quanto compartilhamentos e downloads estão sendo feitos" — e a pergunta embutida é se vale criar algo próprio ou integrar algo existente.

Esta fatia responde de forma mínima e anônima: cada peça ganha contadores na lista interna que já existe, sem dashboard novo e sem serviço para operar. A assessoria precisa saber quais peças são abertas, baixadas e compartilhadas; a coordenação precisa saber se o esforço de manter a Central está valendo. Nada além disso.

## Persona e fluxo

- **Persona / contexto:** assessoria e coordenação de comunicação (role `communicator`; `coordinator`/`candidate` veem o mesmo), na mesa, decidindo o que reforçar e o que produzir. Quem gera os eventos é o visitante anônimo da página pública — que nunca é identificado.
- **Job principal:** ler, por peça, o que foi aberto, baixado e compartilhado, e decidir o próximo passo de produção sem abrir outra ferramenta.
- **Fluxo desejado:** entra na lista de peças → lê os contadores de cada linha → "muito aberta e pouco compartilhada" pede novo gancho/capa; "muito compartilhada" pede continuação → decide o que reforçar/reeditar e o que produzir em seguida.
- **Anti-goals de produto:** não é analytics de site (sem pageview, funil, origem, heatmap); não é perfil de visitante (sem cookie de identidade, sem IP persistido, sem rastreio entre páginas ou entre peças); não é dashboard novo nem gráfico de vaidade; não rastreia o que acontece depois do clique — fora do site, nada.

### Esboço de fluxo (B)

```text
[visita anônima abre a peça] → abertura · download · compartilhar (WhatsApp | link) contam na peça
[assessoria] lista interna de peças (C211) → contadores por linha → "abriu muito, compartilhou pouco"
→ reforça/reedita gancho, capa ou chamada → decide a próxima peça
[coordenação] lê as peças mais servidas → decide se a Central vale o esforço de catalogar/publicar
[falha na contagem] a página pública segue idêntica — download e compartilhar nunca dependem do contador
```

### Design UI (B)

- Design UI (gate): `docs/plans/central-conteudos-analytics-ui-design.html` — cenas: lista de peças do C211 com a coluna de contadores (com e sem dados) e o recorte por canal no detalhe da peça. Encaixe na lista existente; sem tela nova.

## Objetivo e aceite

- A lista interna de peças do C211 mostra, por peça, contadores absolutos de aberturas, downloads e compartilhamentos (WhatsApp e link), anônimos e agregados.
- A assessoria responde "qual peça reforçar/reeditar e o que produzir em seguida" e a coordenação responde "a Central está valendo o esforço" lendo a própria lista, sem ferramenta nova.
- Fail-soft: se a contagem falhar, a página pública não quebra nem atrasa; nada bloqueia abertura, download ou compartilhamento — contador a menos é aceitável, dado de visitante não.
- Privacidade: sem PII (sem IP persistido, sem cookie de identidade, sem user-agent completo), sem rastreio entre páginas/peças e sem qualquer dado de eleitor; contagem estritamente anônima.
- Nenhum serviço novo no homeserver para operar/backup; nada de dashboard, gráfico ou rota de analytics.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — contadores anônimos por peça (abertura · download · compartilhamento) na lista interna de peças do C211.
- **Decisões desbloqueadas:**
  - Assessoria de comunicação: qual peça reforçar/reeditar e o que produzir em seguida (aberta e pouco compartilhada = rever gancho/capa; muito compartilhada = desdobrar).
  - Coordenação de comunicação: se a Central está valendo o esforço de catalogar/publicar — as peças estão sendo servidas e circulando?
  - Assessoria: qual canal entrega circulação (WhatsApp × link copiado) para concentrar o CTA onde a rede responde.
- **Forma:** _adiada ao plano de implementação_ — restrições: contagens absolutas por peça (sem %; a base é anônima e desconhecida), nunca somadas num índice único de "uso", sem série/tendência no v1, sem KPI de vaidade (tempo, scroll, ranking).

## Dados da decisão (literais)

- Eventos v1 (rótulos): "Abertura da peça" · "Download" · "Clique em compartilhar (WhatsApp)" · "Clique em compartilhar (link)" — WhatsApp e link contam **separados** (o canal é a pergunta de produto; somar esconde onde a circulação para).
- "Uso" não vira um número só: os contadores aparecem lado a lado, por peça, sem total "usos" e sem média.
- Nada de PII: sem IP persistido, sem cookie de identidade, sem user-agent completo; contagem anônima e agregada, nunca associável a pessoa; sem rastreio entre páginas ou entre peças.
- Sem `Consent` novo — não há dado pessoal a consentir; qualquer identificação de visitante está fora de escopo (fail-closed de privacidade).
- Superfície: contadores na lista interna de peças (C211) — sem dashboard novo, sem gráfico, sem rota de analytics.
- Decisão própria vs existente: **A** — coleção mínima de eventos anônimos no próprio Payload, escrita por endpoint público fail-soft e agregada na lista do C211; sem serviço novo, sem cookie, atribuição por peça garantida. Alternativas avaliadas: **B** `@10x-media/analytics` (`0.1.0-beta.0`, adapter `native()` self-hosted, rollups no próprio Postgres, superfície no `/admin`) e **C** serviço externo self-hosted (Umami/Plausible — mais um serviço para operar e ainda exigiria eventos customizados). Reavaliar B/C só se a pergunta virar funil/pageview agregado.
- Fail-soft: se a contagem falhar, a página pública não quebra nem atrasa; nada de bloquear abertura, download ou compartilhamento por telemetria.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/` (eventos anônimos por peça), `src/utilities/` (agregação para os contadores), `src/components/campaign/shared/` (coluna/célula na `CampaignTable`) e uma rota pública de escrita em `src/app/(frontend)/api/` chamada pela página do S27.
- **Precedente a olhar:** `src/app/(frontend)/api/revalidate/route.ts` e `src/app/(frontend)/api/social-feed/sync/route.ts` (rota JSON pública, allowlist, fail-soft), `src/components/campaign/shared/CampaignTable.tsx` + `CampaignListOmnibox` + `src/utilities/campaignListUrl.ts` (a superfície), `src/collections/CampaignVoteSummarySnapshot.ts` (contagem/rollup, não dashboard), `src/lib/campaignPageChrome.ts` + `src/components/campaign/shell/nav.ts` (chrome). O rate limit existente (`src/utilities/ai/rateLimit.ts`) é por `userId` e não serve para o público.
- **Risco de acoplamento:** a contagem é acessória — o download/compartilhar e a página do S27 não podem depender dela; a peça é a do C211 (nada de segundo modelo de peça); nenhum identificador de visitante pode nascer daqui.

## Dependências

- **S27** (dura) — sem a página pública não há evento a contar.
- **C211** (dura) — a peça catalogada e a lista interna são a superfície dos contadores.
- Soft: **S28** (busca por tema) é ortogonal; os contadores entram como colunas, como as demais.

## Fora de escopo

- Funil/pageview agregado do site (visitantes, origem, rejeição) — se pedido, reavaliar plugin (B) ou serviço self-hosted (C) em item próprio.
- Heatmap, scroll depth, tempo na página e A/B de título/capa/CTA.
- Rastrear visitante entre páginas ou entre peças (sessão, device, identidade anônima) — o modelo é evento solto.
- Dashboard, rota de analytics, gráfico de série, exportação e alertas.
- Meta Pixel (mídia paga na home/abaixo-assinado), analytics de terceiros no self-hosted e plataformas externas (Instagram/YouTube).
- UTM/encurtador e medição fora do site — o que acontece depois do `wa.me` ou do link copiado não é medível aqui (já adiado em S4/C166).

## Rabbit holes de produto

- **Virar analytics de site.** Se alguém "só completar": pageview, origem, cookie, banner de consent. **Corte neste item:** só eventos de peça, anônimos e sem identidade.
- **Medir a circulação depois do clique.** Se alguém "só completar": encurtador, redirect com token, "quantas pessoas receberam no WhatsApp". **Corte neste item:** o clique é o teto do que o site sabe; pós-clique é fora.
- **Placar único de "uso" / dashboard de vaidade.** Se alguém "só completar": somar tudo num número e desenhar tendência. **Corte neste item:** contadores separados, lado a lado, sem índice composto.
- **Adotar o plugin só pelo widget.** Se alguém "só completar": superfície no `/admin` (errada para a comunicação) e migrations de pacote beta. **Corte neste item:** A; reavaliação B/C só para funil/pageview.
- **Guardar tudo para sempre.** Se alguém "só completar": eventos crus com IP/user-agent e retenção infinita — vira perfil de visitante. **Corte neste item:** mínimo anônimo, sem identificador persistido.

## Questões em aberto (produto)

- **Própria, plugin existente ou serviço self-hosted?** **Opções:** A) coleção mínima própria | B) `@10x-media/analytics` (beta) | C) Umami/Plausible self-hosted. **Recomendação:** A — atribuição por peça garantida e superfície onde a assessoria já está, sem serviço novo para operar/backup; B está em beta e vive no `/admin`; C somaria um serviço e ainda exigiria eventos customizados. Reavaliar se a pergunta virar funil/pageview agregado. _(assumido — validar com produto)_
- **O que conta como "uso"?** **Opções:** A) só download + compartilhar | B) os quatro contadores lado a lado | C) um número "usos" por peça. **Recomendação:** B — a pergunta é "esta peça circula?" e cada contador mostra onde ela para; C esconde a decisão; A descarta o sinal de que a peça foi encontrada. _(assumido — validar com produto)_
- **Granularidade temporal?** **Opções:** A) acumulado por peça desde a publicação | B) janela de 7 dias | C) série diária. **Recomendação:** A no v1 — responde "reforçar/reeditar" e "vale a pena" sem virar dashboard; janela de 7 dias é o próximo passo registrado se a pergunta virar "o que está circulando agora". _(assumido — validar com produto)_
- **Onde a assessoria vê?** **Opções:** A) coluna na lista de peças do C211, com recorte por canal no detalhe | B) bloco no topo da Central | C) rota de analytics. **Recomendação:** A — a lista já é a mesa de trabalho; B/C criam superfície nova e puxam para dashboard. _(assumido — validar com produto)_

## Referências

- Design UI (gate): `docs/plans/central-conteudos-analytics-ui-design.html` (+ assets em `central-conteudos-analytics-ui-design-assets/`)
- Planos irmãos: `docs/plans/central-conteudos-publica.md` (S27 — a página que gera os eventos), `docs/plans/central-conteudos-ingestao.md` (C211 — a lista/superfície), `docs/plans/compartilhar-conteudos-home-whatsapp.md` (S4 — "nada é coletado neste item"), `docs/plans/c166-compartilhar-trecho-link.md` (C166 — "sem telemetria de compartilhamento")
- Plugins avaliados (não adotados): `@10x-media/analytics` (10x-media/payload-plugins, `0.1.0-beta.0`, adapter `native()` self-hosted, superfície no `/admin`) e os serviços Umami/Plausible
- Arquivos como pista, não contrato: `src/app/(frontend)/layout.tsx` (analytics Vercel inerte), `src/components/MetaPixel.tsx`, `src/app/(frontend)/api/revalidate/route.ts`, `src/app/(frontend)/api/social-feed/sync/route.ts`, `src/components/campaign/shared/CampaignTable.tsx`, `src/utilities/campaignListUrl.ts`, `src/collections/CampaignVoteSummarySnapshot.ts`, `src/utilities/documents.ts`
- `AGENTS-campaign.md` / `AGENTS.md` — vertical Comunicação, LGPD fail-closed, naming e `overrideAccess: false`

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (contadores anônimos por peça na lista interna, sem serviço novo); (2) appetite ~1–1,5 dia cabe num encaixe de coluna; (3) persona, job e aceite legíveis sem stack; (4) direção no codebase é hipótese com precedentes abertos; (5) zero decisão dura de engenharia — schema, rota e agregação ficam para a implementação.
