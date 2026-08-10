# Sollinha: municípios sem dobradinha (cobertura de parcerias)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #527
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (resposta em texto no chat existente; nenhuma superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; uma tool nova read-only + testes; sem migration/collection/Consent

## Intenção

O pedido original de gestão cobre três domínios — municípios, lideranças e **dobradinhas** — e o Sollinha ainda não enxerga a cobertura de parcerias: "em quais municípios ainda não temos dobradinha?" Um município sem dobradinha é uma frentes de mobilização a explorar (o deputado estadual parceiro puxa voto para a chapa); saber onde a parceria **não existe** é o primeiro passo para decidir onde buscá-la. O mesmo vale no sentido inverso: dobradinhas cadastradas **sem município vinculado** são parceiros órfãos que o coordenador pode estar esquecendo de usar.

## Persona e fluxo

- **Persona / contexto:** coordenador em `/campanha`, no chat, planejando onde ativar/formalizar dobradinhas; assessor conferindo o próprio escopo.
- **Job principal:** saber, em linguagem natural, quais municípios do escopo estão sem dobradinha (ou quais dobradinhas estão órfãs), com contagem e links para agir.
- **Fluxo desejado:**
  1. "Em quais municípios ainda não temos dobradinha?" → o Sollinha cruza o catálogo de municípios do escopo com os vínculos `municipality.stateDeputies` e responde lista + contagem, com link para cada município.
  2. "Quais dobradinhas estão sem município?" → responde os parceiros órfãos, com link.
  3. O usuário refina por região/cidade; liderança nunca vê nada (fail-closed).
- **Anti-goals de produto:** não qualificar/ranquear dobradinhas existentes; não sugerir deputados estaduais-alvo para abordar (depende de dado de candidato estadual que não está garantido no escopo do app); não virar consulta eleitoral.

## Objetivo e aceite

- O Sollinha responde "quais municípios estão sem dobradinha" no **escopo do usuário**, com **contagem** e um item por município, ordenável por região/cidade.
- Responde "quais dobradinhas estão sem município vinculado" (órfãs), com contagem e links.
- Salvador aparece **agrupada por cidade** por padrão (19 ZE como uma unidade), com opção de detalhar por ZE.
- Links de navegação para o detalhe de cada município/dobradinha (precedente B162).
- Assessor vê apenas o próprio escopo; leader recebe acesso negado (fail-closed, sem dados).

## Dados (intenção)

- **Vou apresentar dados?** Sim — lista de cobertura de parcerias, como superfície deste item (no chat).
- **Decisões desbloqueadas:** coordenador decide onde buscar/formalizar dobradinha; assessor identifica parceria faltando no seu território.
- **Forma:** *adiada ao plano de implementação*. Restrições de produto: lista exaustiva com contagem (cobertura, não top N); leitura relativa ao escopo do usuário; sem % estadual.

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova tool em `src/utilities/ai/tools/` (família de `getDobradinhas`), registrada no `index.ts`; fonte: `municipality.stateDeputies` (hasMany) e a coleção `stateDeputy` (municípios vinculados); reuso de `buildCampaignLinks` (destinations `municipality`/`dobradinha`).
- **Precedente a olhar:** `src/utilities/ai/tools/getDobradinhas.ts` (leitura atual de dobradinhas por município); `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185 — fonte da semântica compartilhada da família); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — gate fail-closed por papel).
- **Risco de acoplamento:** dobradinhas são dados de campanha (staff-only por RBAC) — gate por papel igual à família; não tocar dados eleitorais (lockdown B180 intacto).

## Dependências

- Soft: B185/B186/B189 (família de gestão — mesma convenção de escopo e gate por papel; sem ordem obrigatória).

## Fora de escopo

- Sugerir **quais** deputados estaduais abordar em municípios sem dobradinha (exigiria catálogo de candidatos estaduais — não garantido no escopo de dados atual; registrar como candidato futuro se o dado existir).
- Avaliar qualidade/potencial das dobradinhas existentes.
- Dashboard/mapa de cobertura de parcerias.

## Rabbit holes de produto

- **Virar consulta de candidatos estaduais.** Se alguém "só completar", o item cresce para "monte a chapa ideal por município". **Corte:** só a cobertura (tem/não tem), sem ranking de quem abordar.
- **Salvador vira 19 linhas.** Listar os ZE separados polui a leitura de cobertura. **Corte:** agrupar por cidade; detalhar por ZE só quando pedido.
- **Confundir "sem dobradinha" com "sem dado".** Município sem vínculo pode ser dado faltando no cadastro. **Corte:** a resposta declara que a leitura é sobre o cadastro atual ("não há dobradinha vinculada no sistema").

## Questões em aberto (produto)

- **Dobradinhas órfãs entram no mesmo aceite?** **Opções:** (A) sim — mesma tool, dois modos de saída (recomendado no menu do gate); (B) só municípios sem dobradinha. **Recomendação:** (A) — o parceiro órfão é a mesma lacuna vista pelo outro lado. _(assumido — validar)_
- **Salvador agrupada por cidade?** **Opções:** (A) agrupar (recomendado); (B) 19 ZE individualizados por padrão. **Recomendação:** (A) — cobertura é leitura por unidade operacional (cidade), com drill-down opcional. _(assumido — validar)_
- **Incluir "sem liderança" e "sem dobradinha" num mesmo modo de cobertura do município?** **Opções:** (A) não — domínios separados (liderança é B185, dobradinha é este item); (B) sim, um modo "raios-X do município". **Recomendação:** (A) — cada lacuna tem dono e aceite próprios; combo vira dashboard (anti-goal). _(assumido — validar)_

## Referências

- `src/utilities/ai/tools/getDobradinhas.ts` — leitura atual de dobradinhas (precedente)
- `src/collections/StateDeputy.ts` + `Municipality.ts` (campo `stateDeputies`) — vínculos
- `src/utilities/ai/tools/buildCampaignLinks.ts` — links na resposta (B162)
- `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185) — família de gestão (escopo/gate)
- `docs/plans/ai-chat-sollinha.md` — arquitetura do chat (imutável, `in-prod`)
