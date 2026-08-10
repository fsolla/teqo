# Sollinha: lideranças pendentes de abordagem + assessores responsáveis (gestão)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #524
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (resposta em texto no chat existente; nenhuma superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; uma tool nova read-only + testes; sem migration/collection/Consent

## Intenção

O Sollinha hoje responde perguntas de leitura **por entidade** ("quais lideranças temos em X?", "como está o município Y?"), mas não consegue responder perguntas de **acompanhamento de campanha** que cruzam dados: "Quais lideranças ainda precisamos abordar no Vale do Jiquiriça?", "Quais são os assessores das lideranças que ainda precisam ser abordadas em Salvador?". O usuário quer que o Sollinha monte essas listas com confiança — critério de "pendente" explícito na resposta e responsáveis à vista para agir.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor em `/campanha`, no chat, planejando o trabalho de campo de um território; quer saber o que **falta fazer** e **com quem**.
- **Job principal:** descobrir, em linguagem natural, quais lideranças de um território ainda precisam ser abordadas e quem são os assessores responsáveis por elas.
- **Fluxo desejado:**
  1. "Quais lideranças ainda precisamos abordar no Vale do Jiquiriça?" → o Sollinha filtra pelo território de identidade (`municipality.region`), aplica o critério "pendente de abordagem", responde lista (nome, municípios, status de apoio, última atualização) **declarando o critério usado** e oferece links de navegação (precedente B162).
  2. "Quais são os assessores das lideranças que ainda precisam ser abordadas em Salvador?" → mesma leitura, agrupada por assessor responsável, com link para cada assessor/liderança.
  3. O assessor pede o recorte do próprio escopo e usa a lista para acionar o campo; o coordenador pede por região/cidade.
- **Anti-goals de produto:** não virar estatística/dashboard no chat; não incluir dados eleitorais (leader lockdown B180); não virar write tool (abordagem registrada pelo chat fica fora).

## Objetivo e aceite

- O Sollinha responde "quais lideranças ainda precisam ser abordadas" por **território de identidade** (ex.: Vale do Jiquiriçá), **cidade** (ex.: Salvador — os 19 ZE juntos) ou **município**, com a resposta declarando o critério aplicado ("status 'a abordar'/'em disputa' ou sem compromisso de votos").
- Quando perguntado, agrupa ou lista os **assessores responsáveis** das lideranças pendentes (campo "Assessores responsáveis" da liderança) com link.
- Liderança com status engajado **e** compromisso de votos recente não aparece na lista.
- A resposta inclui links de navegação (liderança/município/assessor) via a tool de links existente.
- **Escopo por papel:** assessor enxerga apenas os municípios que administra (RBAC atual); leader recebe resposta de acesso negado, fail-closed, sem nenhum dado.
- Tipografia de nomes tolerante: "Vale do Jiquiriça" (sem acento) casa com "Vale do Jiquiriçá".
- **Filtro "sem assessor" (C3):** com o filtro ativo, a lista traz apenas as lideranças pendentes que **não têm assessor responsável** — as órfãs de responsabilidade, que o coordenador precisa atribuir antes de cobrar.
- **Modo "municípios sem liderança" (C4):** quando perguntado "quais municípios não têm liderança cadastrada?", a tool responde com os municípios do escopo sem **nenhuma** liderança vinculada — buraco de registro, não de abordagem.

## Dados (intenção)

- **Vou apresentar dados?** Sim — listas de lideranças com recência/status, como superfície deste item (no chat).
- **Decisões desbloqueadas:** coordenador decide em qual território atacar a seguir; assessor decide quais lideranças do seu escopo abordar primeiro; coordenador direciona assessores pelas listas agrupadas por responsável.
- **Forma:** *adiada ao plano de implementação*. Restrições de produto: leitura relativa/local (território ou escopo do usuário), nunca % estadual; lista, não mapa; o critério de pendência **sempre** visível na resposta.

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova tool em `src/utilities/ai/tools/` (mesma família de `getLeaderships`, `getMunicipalityOverview`, `getDobradinhas`), registrada no `index.ts`; reuso de `buildCampaignLinks` para os links; campos: `leadership.supportStatus`/`updatedAt`/`advisors`, `votePledge` (declaredAt), `municipality.region`/`city`.
- **Precedente a olhar:** `docs/plans/sollinha-tool-urls-navegacao.md` (B162 — links na resposta); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — padrão de gate fail-closed por papel); `docs/plans/ai-chat-sollinha.md` (entrega original, `in-prod` — não editar).
- **Risco de acoplamento:** tools eleitorais são staff-only (B180); o recorte por `region` depende do texto canônico do território; não duplicar o sufixo de status já usado em `getLeaderships`.

## Dependências

- Nenhuma dura. Soft: B186 (prioridades) reusa a semântica de "atualização recente" definida aqui.

## Fora de escopo

- Write tools (marcar abordagem/atualizar liderança via chat) — decisão de produto separada, não pedida.
- Estatísticas agregadas/percentuais por território — dashboard, não chat.
- Incluir dados eleitorais na lista — leader lockdown B180 continua valendo.
- Alertas proativos (o Sollinha avisar sem ser perguntado).

## Rabbit holes de produto

- **Definição de "pendente" ambígua.** Se alguém "só completar", vira um filtro de status sem critério declarado. **Corte:** o critério é fixo por default (status ≠ engajado **ou** sem compromisso), sempre exibido na resposta; o usuário pode estreitar com filtros, nunca expandir para "todos os dados".
- **Lista gigante.** 435 municípios × lideranças → resposta impossível. **Corte:** top N por padrão com total, escalonável por território/página.

## Semântica compartilhada da família (B185/B186/B189)

Este item é a **fonte** das definições que B186 (prioridades) e B189 (cobertura de atualizações) reusam, para a família não redefinir o mesmo conceito três vezes:

- **"Atualização recente"** = data da última `municipalityUpdate` (createdAt); município **sem nenhuma** atualização conta como "nunca atualizado" (estagnação máxima). Limiar padrão proposto: 30 dias, ajustável por filtro/pergunta.
- **Escopo** = o do usuário: assessor vê só os municípios que administra; coordenador vê o estado, filtrável por região/cidade.
- **"Pendente de abordagem"** = status ≠ `engajado` **ou** sem `votePledge` no município (critério declarado na resposta).

## Questões em aberto (produto)

- **O que define "ainda precisa ser abordada"?** **Opções:** (a) `supportStatus` ≠ `engajado` (campo mantido pelo staff); (b) sem `votePledge` (compromisso de votos) no município; (c) sem atualização recente (ex.: >30 dias); (d) combinação configurável. **Recomendação:** (a) + (b) — status é a verdade do staff e o compromisso é o resultado da abordagem; o critério aplicado aparece na resposta e pode ser estreitado por filtros. _(assumido — validar)_
- **"Assessores das lideranças" = quem?** **Opções:** (A) `leadership.advisors` ("Assessores responsáveis" da liderança); (B) `municipality.advisors` (assessores do município); (C) os dois. **Recomendação:** (A) — é o vínculo direto pessoa→liderança; quando útil, o nome do assessor do município vem como contexto. _(assumido — validar)_
- **Escopo "Salvador" e "Vale do Jiquiriça":** interpretar "Salvador" como os 19 ZE juntos (cidade) e território pelo campo região? **Recomendação:** sim, com a tool aceitando região | cidade | município como filtros. _(assumido — validar)_
- **C4 (municípios sem liderança) merece item próprio?** **Opções:** (A) fold-in aqui, como modo de saída (recomendado no menu do gate); (B) item próprio. **Recomendação:** (A) — mesma tool, mesma família de dado (cadastro de lideranças), aceite único "saber o que falta no território". _(assumido — validar)_

## Referências

- `src/utilities/ai/tools/getLeaderships.ts` — precedente de tool de lideranças (estende o surface)
- `src/utilities/ai/tools/getMunicipalityOverview.ts` — contagens e visão por município
- `src/utilities/ai/tools/buildCampaignLinks.ts` — links na resposta (B162)
- `src/collections/Leadership.ts` — campos `supportStatus`, `advisors`, `updatedAt`
- `docs/plans/ai-chat-sollinha.md` — arquitetura do chat (imutável, `in-prod`)
