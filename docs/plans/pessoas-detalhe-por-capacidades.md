# Pessoas — página de detalhe da pessoa (customizada por capacidades)

Status: rascunho
Atualizado em: 2026-08-11
Issue: #657
Priority: P2
Model: composer-2.5
Impeccable: C — fluxo novo: rota de detalhe + composição de seções por capacidade
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c118-ui-draft.canvas.tsx
Appetite: ~2 dias eng; um outcome verificável — toda pessoa da lista tem um detalhe que mostra só o que ela é
Responsável: —

## Intenção

A lista de pessoas ganhou profundidade de uso (edição in-place na C116, ordenação na C117) e o Nome vira link — mas hoje não existe uma página de detalhe de pessoa: só `/campanha/liderancas/[id]`, que só cobre quem é liderança. Uma dobradinha, um assessor ou um apoiador não têm detalhe nenhum. A mesa precisa de uma ficha única da pessoa que se monta sozinha conforme as capacidades dela: a mesma rota serve para qualquer pessoa e mostra **só as seções que ela tem** (liderança, dobradinha, assessora, assessorado, apoiador).

## Persona e fluxo

- **Persona / contexto:** coordenador e assessores (staff) abrindo a ficha de uma pessoa a partir da lista; leader não acessa.
- **Job principal:** ver a ficha inteira da pessoa num lugar só — dados, vínculos territoriais e capacidades — sem juntar pedaços de várias telas.
- **Fluxo desejado:**
  - Na lista de pessoas, clicar no Nome abre `/campanha/pessoas/<id>` (ou rota equivalente).
  - A página monta as seções pela capacidade: ficha (nome, partido, contato, base), **Liderança** (municípios, status de apoio, acesso ao app), **Dobradinha** (partido, municípios), **Assessora** (carteira), **Assessorado** (quem assessora), **Apoiador** (se houver registro), **Ações** (WhatsApp, convidar, apagar).
  - Seções ausentes não aparecem — uma pessoa só-dobradinha não vê blocos vazios de liderança.
- **Anti-goals de produto:** não vira tela de admin do Payload (sem edição de schema); não duplica o detalhe de liderança existente para sempre — o detalhe de liderança pode ser absorvido ou linkado; não vira dashboard com KPIs da pessoa.

## Objetivo e aceite

- Rota nova de detalhe de pessoa acessível a staff; aberta pelo Nome na lista de pessoas (C116 troca o link para cá quando esta existir).
- Seções por capacidade: cada capacidade presente da pessoa renderiza seu bloco; a página de uma pessoa sem liderança não mostra o bloco de liderança.
- Escopo preservado: assessor só vê/abre pessoas da carteira; leader não acessa a rota; sem migration; `Contact` continua a fonte da ficha.
- O detalhe de liderança existente (`/campanha/liderancas/[id]`) não regride: este item decide convivência (absorver no novo detalhe ou linkar).

## Dados (intenção)

- **Vou apresentar dados?** Não — a página mostra vínculos e ficha (mesmos dados da lista, em profundidade), não métricas. Sem KPI de pessoa (votos/estimativas só nas superfícies que já os exibem, com a assimetria atual intacta — liderança vê `declaredVotes`, nunca estimativas).

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota nova em `src/app/(campaign)/campanha/(app)/pessoas/[id]/`; loader por `contactID` reusando o merge de `src/utilities/people/peopleData.ts` (ou um irmão `loadPersonDetail`); seções como componentes em `src/components/campaign/people/`; dados por capacidade vêm dos utilitários de domínio já existentes (leadership/stateDeputy/advisor/supporter).
- **Precedente a olhar:** `/campanha/liderancas/[id]` (detalhe existente), `peopleData.ts` (merge por Contact), C100 (lista), `municipalityPortfolio`/catálogo para nomes de municípios.
- **Risco de acoplamento:** o escopo do assessor no detalhe deve espelhar o da lista (merge por capacidade, nunca alargado); leader lockdown; assimetria votos declarados × estimados preservada se qualquer bloco mostrar votos.

## Dependências

- **C99/C100** (prontas). **Suaves:** C116 (é quem passa a linkar o Nome para cá quando existir; sem dependência de ordem — o link da C116 nasce apontando para a liderança e troca quando C118 entrar); C117 (mesma lista, sem dependência).

## Fora de escopo

- Edição na página de detalhe (a edição é in-place na lista, C116; editar aqui pode ser item futuro).
- Migração do detalhe de liderança para esta rota (decisão de convivência no item, sem derrubar a rota atual).
- Página de apoiador dedicada; histórico/atividades da pessoa; timeline.

## Rabbit holes de produto

- **"Detalhe vira mini-admin do Payload."** Formulários de edição de todos os campos, histórico de versões, relação de tudo com tudo. **Corte:** página de leitura + navegação; escrita fica na lista (C116) e nas superfícies atuais.
- **"Seções vazias com placeholder 'Nada aqui ainda'."** Pessoa sem liderança não precisa do bloco. **Corte:** seção só quando a capacidade existe (o pedido explícito).
- **"Absorver o detalhe de liderança de uma vez."** Migrar todo o fluxo (incluindo ações/votos) para a rota nova num item só. **Corte:** v1 é leitura + convivência; a migração do detalhe de liderança é avaliada com uso.
- **KPIs da pessoa.** "Engajamento", "score", contagens decorativas no topo. **Corte:** sem métrica nova; a ficha mostra vínculos.

## Questões em aberto (produto)

- **Convivência com o detalhe de liderança:** manter `/campanha/liderancas/[id]` intacto e o novo detalhe linkar para ele na seção de liderança, ou migrar a rota de liderança para o detalhe novo? **Recomendação:** v1 mantém as duas — a seção Liderança do detalhe novo mostra o resumo e linka para a página rica existente (que tem votos/ações). Migração total fica avaliada com uso. _(assumido — validar no gate)_
- **Ações no detalhe:** repetir WhatsApp/convidar/apagar da lista? **Recomendação:** sim, as mesmas ações (padrão da lista) — é o destino natural delas quando a mesa está na ficha. _(assumido — validar no gate)_
- **Apoiador:** a seção de apoiador mostra o registro (fonte, município, intenção de voto)? **Recomendação:** sim, resumo do registro de apoiador quando houver — mesmo consent guardado das superfícies atuais. _(assumido — validar no gate)_

## Referências

- `src/app/(campaign)/campanha/(app)/liderancas/[id]/` — detalhe existente (molde de seções/leitura)
- `src/utilities/people/peopleData.ts` — merge por `Contact` e view model (capacidades da pessoa)
- `src/components/campaign/people/` — componentes de lista (base para seções do detalhe)
- `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` — colunas da lista que viram seções do detalhe
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-c118-ui-draft.canvas.tsx`
