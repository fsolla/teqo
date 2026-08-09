# B178 — Salvador: cidade agregada no /campanha (página virtual + linha na lista, sem dupla contagem)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #461
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: C — fluxo novo (página de leitura agregada da capital + linha na lista de municípios + busca)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-7/canvases/plan-b178-ui-draft.canvas.tsx
Appetite: ~2–3 dias eng; agregação virtual sobre as 19 ZEs; sem migration / collection / Consent
Responsável: —

## Intenção

O Sollinha (chat IA em `/campanha`) alucinou um link para a “página de detalhe de Salvador” que **não existe** — e o link fazia sentido: “Salvador” é uma cidade real que o time e o candidato citam como cidade. O problema de fundo: desde o remodel, o catálogo representa Salvador como 19 unidades operacionais (`salvador-ze-1…19`) — correto para operar, mas a capital ficou **sem leitura agregada** (`/campanha/municipios/salvador` → 404) e sem representação como cidade nas superfícies de município. Produto quer que **Salvador apareça como cidade** em três pontos, mantendo as ZEs como operação: (1) página de detalhe virtual (rollup eleitoral + demandas/atividades); (2) **linha agregada na lista de municípios**; (3) busca mostrando agregado e zonas. Com um guardrail central: **nunca somar a cidade e as zonas juntas** em qualquer total/média/TI/mapa.

## Persona e fluxo

- **Persona / contexto:** coordenador, candidato ou assessor raciocinando sobre a capital como um todo (votação, posição, comparação com o interior, demandas, agenda) — ou recebendo um link da Sollinha apontando “Salvador”.
- **Job principal:** abrir/achar “Salvador” como cidade (link do chat, busca da lista, digitação do slug), ler o desempenho agregado da capital e navegar para as ZEs quando quiser operar.
- **Fluxo desejado:**
  1. Busca na lista de municípios por “Salvador” → aparecem a **linha agregada da cidade** e as **19 ZEs**.
  2. Clicar na linha/página da cidade → `/campanha/municipios/salvador` resolve para a página virtual read-only.
  3. Página: header “Salvador”, nota “ZE 1–19 · unidade de operação é a zona”; rollup eleitoral (votos por ano, % da própria votação, **posição por cidade**); entradas demandas/agenda/19 ZEs/mapa.
  4. Quem quer operar vai para a ZE; a cidade é leitura.
- **Anti-goals de produto:**
  - Salvador **não** vira nova unidade operacional (o remodel fixou ZE como unidade — operação, pledges e lideranças continuam por zona).
  - **Dupla contagem proibida:** o agregado da cidade **substitui** suas 19 zonas em qualquer somatória (totais da lista, médias, rollup por Território de Identidade, mapa, “conta da cadeira”) — nunca soma cidade + zonas.
  - Não “engole” as 19 ZEs: cada ZE mantém sua ficha, dossiê e linha.
  - Não reforma o mapa (polígono da cidade segue como base não-interativa).
  - A cidade não vira um 436º município no catálogo de operação (agregação virtual, derivada).

## Objetivo e aceite

- `/campanha/municipios/salvador` resolve para uma página **read-only** da cidade, coerente com o shell das páginas de município (header + abas/seções).
- A página mostra o **rollup eleitoral da capital** (série de votos do candidato por ano + % da própria votação + **posição por cidade**, ex.: “12º de 663 em 2022”) e as seções de **demandas e agenda/atividades** da cidade (como nas páginas de município, que apontam para Demandas/Agenda).
- A **lista de municípios** ganha uma **linha agregada da cidade** (nome “Salvador – cidade” / “Salvador (agregado)”, mesmos números do rollup), **mantendo as 19 ZEs**.
- A **busca da lista** por “Salvador” retorna **agregado + zonas** (e, no detalhe, a página da cidade é o destino do link).
- **Guardrail duro (aceite):** em todos os agregados que consomem a lista (totais, médias, TI, mapa, rollups descendentes) a cidade agregada e as suas ZEs **nunca somam juntas** — presentes os dois, vale a cidade OU as ZEs, uma única vez por município “Salvador”. Isso é testável com contagem invariante (cada voto do catálogo entra no máximo uma vez em qualquer soma).
- O link da Sollinha para “Salvador” passa a ser canônico e não quebra mais.
- Leader lockdown: página/linha staff-only (mesmo acesso das demais páginas de município).
- Sem migration, sem collection nova (cidade é agregação virtual), sem Consent, sem persistência.

## Dados (intenção)

- **Vou apresentar dados?** Sim — superfície neste item (página + linha + busca).
- **Decisões desbloqueadas:** staff decide **prioridade/comparação da capital** (maior caixa de votos do estado) e navega às zonas para agir; leitura relativa/local (posição entre candidatos votados na cidade, % da própria votação) — nunca % estadual absoluto como âncora.
- **Forma:** adiada ao plano de implementação; restrições de produto: cidade = **agregação virtual** sobre as 19 ZEs (mesmo princípio do rollup por Território de Identidade / padrão MAUP); posição por cidade = uma colocação para a capital inteira.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota de detalhe `/campanha/municipios/[slug]` reconhecendo o caso “cidade” (Salvador) no shell existente; loader da lista de municípios estendido para inserir a **linha agregada** e a busca (agregado + zonas); reuso dos loaders de baseline (baseline por zona, somados) e da fonte de rank por cidade — **sem** paralelo novo de query.
- **Precedente:** [`ranking-votos-municipio.md`](ranking-votos-municipio.md) (A11 — posição por município); [`camada-territorios-identidade.md`](camada-territorios-identidade.md) (E12 — rollup/TI resolveu o mesmo problema de “não somar duas vezes” com salvaguardas MAUP); [`dossie-municipio.md`](dossie-municipio.md) (E16 — dossiê por ZE).
- **Risco de acoplamento:** o guardrail de dupla contagem atravessa **todos** os consumidores de agregados de municípios (lista, TI, mapa, conta da cadeira) — é o risco central do item; não reabrir o remodel (ZE = unidade operacional); cutover do detalhe (B152/B155+) segue valendo para as ZEs; leader lockdown.

## Dependências

- Nenhuma dura.
- Soft: **B162** (Sollinha URL tool, ready) — apontar município “Salvador” respira a página da cidade; **B177** — quando o contexto é a capital, o link pode levar à página da cidade.
- Atenção: o guardrail de dupla contagem conversa com rollups já entregues (E12/TI, A11, mapa B13) — o executor deve auditá-los, sem os reabrir (não são dep aberta; é invariante a preservar).

## Fora de escopo

- Operação por cidade no v1 (pledges, lideranças, níveis, avaliação de assessor) — item sucessor se a mesa pedir.
- Substituir ou redesenhar as 19 páginas de ZE, seus dossiês e linhas.
- Mudanças no mapa (polígono/legenda/interação da cidade).
- O catálogo continua com **435** unidades operacionais; a cidade é derivada, nunca seed.

## Rabbit holes de produto

- **“Salvador vira um 436º município operacional.”** Quebra remodel, snapshot e contagem. **Corte:** cidade é leitura derivada; operação segue por zona.
- **“Somar a cidade + as zonas só porque ‘aparecem juntas’.”** É exatamente o bug que o user vetou. **Corte:** guardrail testável de “cada voto entra uma única vez”; sempre cidade **ou** zonas.
- **“Espelhar todas as abas do detalhe de município.”** Amplicaria para coisas sem decisão clara por cidade. **Corte:** abas com dono de dado para a cidade (eleitoral, demandas, agenda); o resto espera pedido.
- **Rollup por cidade de pledges/lideranças (mesma pessoa em 2 zonas).** Decisão de dados não deste item. **Corte:** fora do v1.

## Questões em aberto (produto)

Resolvidas no gate (2026-08-09):

- **Página real, redirecionamento ou só-tool?** **Decisão:** página virtual read-only + manter (e não substituir) as ZEs.
- **Linha na lista de municípios?** **Decisão:** sim — linha agregada da cidade **além** das 19 ZEs (viável: agregação virtual sobre as ZEs; não é 436º no catálogo).
- **Busca da lista?** **Decisão:** “Salvador” retorna agregado + zonas.
- **O que o v1 mostra além do eleitoral?** **Decisão:** + demandas e agenda/atividades da cidade (não inclui conta da cadeira/benchmark por cidade no v1).
- **Dupla contagem?** **Decisão:** guardrail duro — cidade e zonas nunca somam juntas em qualquer total/média/TI/mapa (invariante testável).

## Referências

- Canvas UI (gate): [plan-b178-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-7/canvases/plan-b178-ui-draft.canvas.tsx)
- `src/lib/municipalityCatalog.ts` (Salvador = 19 ZEs), `src/lib/bahiaElectionAggregates.ts` (série + rank por cidade), `src/app/(campaign)/campanha/(app)/municipios/[slug]/page.tsx` (shell do detalhe), loader da lista de municípios (`src/utilities/municipality/…`)
- [`ranking-votos-municipio.md`](ranking-votos-municipio.md) (A11) · [`camada-territorios-identidade.md`](camada-territorios-identidade.md) (E12/MAUP) · [`dossie-municipio.md`](dossie-municipio.md) (E16) · [`sollinha-tool-urls-navegacao.md`](sollinha-tool-urls-navegacao.md) (B162)
- AGENTS.md — Municípios model (Salvador por ZE), leader lockdown
