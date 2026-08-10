# Busca global sem sugestões mostra região em branco — estado vazio honesto

Status: rascunho
Atualizado em: 2026-08-10
Issue: #585
Priority: P2
Model: composer-2.5
Impeccable: B — encaixe na superfície existente (região de resultados do search); só copy/label, sem rearranjo
Canvas UI: N/A — só copy/label em superfície existente (ver ui-draft-canvas.md, linha "Só copy/label sem rearranjo")
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

No search global (`/campanha` Início e o FAB overlay "Ações rápidas"), coordenador/candidato que foca o campo sem digitar recebe as "Sugestões" — municípios com `priority: alta` curados pela equipe (B68). Quando **nenhum** município está priorizado (ambiente recém-provisionado, sem importação da planilha de projeção, ou equipe que ainda não curou nada), o campo foca e a região de resultados renderiza **vazia, sem texto, sem affordance**: o usuário não sabe se o search quebrou, carregou ou não tem nada a mostrar. Medido via trace: POST `/campanha/home-search` responde `success/resultKind:suggest` com `municipalities: []` e a região fica em branco.

Não é um caso raro: é o estado natural de qualquer banco antes do staff importar a projeção. O teste e2e do overlay (que espera a região `Sugestões`) hoje só passa onde há dados — e deveria poder passar em qualquer ambiente **se o estado vazio for honesto e verificado**.

## Persona e fluxo

- **Persona / contexto:** coordenador ou assessor em ambiente novo (ou antes da 1ª importação de projeção) abrindo o search do Início ou o FAB.
- **Job principal:** saber, em meio segundo, que o search está vivo e que não há sugestões ainda — sem assumir que quebrou.
- **Fluxo desejado:** foca o campo → vê uma mensagem curta ("Nenhuma sugestão ainda — priorize municípios na planilha de projeção" ou equivalente, no tom do app) → digita → resultados de busca normais aparecem.
- **Anti-goals de produto:** não inventar sugestões falsas (sem dados não há curadoria); não transformar o empty em um componente pesado de onboarding; não mudar o comportamento quando há sugestões.

## Objetivo e aceite

- Com zero municípios priorizados, focar o search (Início e FAB overlay) mostra uma mensagem de estado vazio clara dentro da região de resultados — nunca uma região muda.
- Com ≥1 município priorizado, o comportamento atual é preservado byte a byte (região `Sugestões` com os hits).
- O e2e do FAB overlay passa em **qualquer** estado de dados (vazio ou com sugestões) — o teste ganha uma asserção para o estado vazio ou uma expectativa tolerante a ambos, decidido no plano de implementação sem enfraquecer o contrato.
- Nenhuma mudança na API `/campanha/home-search` (o cliente já tem tudo que precisa: `status: success` + listas vazias).

## Dados (intenção)

- **Vou apresentar dados?** Não — é estado vazio de UI; sem métrica nova.
- **Decisões desbloqueadas:** usuário decide "o search está funcionando, só não há curadoria ainda" em vez de "quebrou".

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/dashboard/HomeSearchResultsShell.tsx` (onde o vazio de hits já é tratado para o modo busca — `Nenhum resultado.` — mas não para o modo sugestão), `src/components/campaign/dashboard/CampaignHomeSearch.tsx` (região `Resultados da busca`), `src/components/campaign/shell/CampaignQuickActionsOverlay.tsx` (FAB).
- **Precedente a olhar:** o empty-state de `query.isActive` (`Nenhum resultado.` no shell) e o `emptyState` do `SuggestionsPanel` (E11) — o app já tem a gramática de vazios.
- **Risco de acoplamento:** o modo sugestão alimenta três superfícies (Início, FAB overlay desktop, Drawer mobile) pelo mesmo estado — a mensagem deve vir do estado compartilhado, não de uma cópia por superfície; leader lockdown não é tocado (leader nem tem search).

## Dependências

- Nenhuma (o item OPS28 — seed no worktree — reduz o número de ambientes vazios, mas o estado vazio existe por design e vale ser honesto em qualquer banco).

## Fora de escopo

- Curar sugestões por outro critério (frescura de sinal, déficit de meta) quando não há `alta` — mudança de política de produto, precisa de evidência; destino: discutir com produto, não este item.
- Qualquer mudança no ranking `rankHomeSearchSuggestMunicipalities` ou na API.

## Rabbit holes de produto

- **"Sem dados, não mostra nada — é o estado correto."** Tecnicamente verdade, mas uma região que não diz nada é indistinguível de quebrada; o custo do empty é ~uma linha e ele vira o contrato testável em qualquer ambiente. **Corte neste item:** mensagem curta e única, sem ilustrações, sem CTA para tela nova.
- **"Aproveitar e adicionar sugestões por outro critério."** Mudar a curadoria é decisão de produto com evidência de uso; vazia hoje, a área é a prova de que não há critério alternativo aceito. **Corte:** este item só torna o vazio legível.

## Questões em aberto (produto)

- **Qual o texto do estado vazio?** **Opções:** A) "Nenhuma sugestão ainda — priorize municípios na planilha de projeção" | B) "Sem sugestões por enquanto." | C) sem texto, um hint discreto. **Recomendação:** A — diz o que é, por quê e o que desbloqueia, no tom direto do app. _(assumido — validar com produto)_
- **O empty vale também para o assessor (carteira sem sinal)?** **Opções:** A) sim, mesma mensagem | B) mensagem específica por papel | C) assessor não tem empty (carteira sempre lista algo). **Recomendação:** C — a carteira do assessor sempre tem municípios; o empty só se aplica quando a lista do papel pode nascer vazia (unrestricted sem `alta`). Validar no plano de implementação com a regra real do ranking.

## Referências

- Trace da sessão: POST `/campanha/home-search` (`mode: suggest`) → `200`, `status: success`, `resultKind: suggest`, `municipalities: []`, `scopeMunicipalities: 435`; snapshot do FAB com `region "Resultados da busca"` vazia.
- `src/components/campaign/dashboard/HomeSearchResultsShell.tsx`, `HomeSearchMunicipalityGroup.tsx` (a seção `Sugestões` retorna `null` sem hits — é aí que o vazio fica invisível).
- `tests/e2e/campaignMunicipalities.e2e.spec.ts:1063` — spec que hoje depende de dados para a asserção `region 'Sugestões'`.
