# Status de apoio "Lembrança" em lideranças

Status: registrado
Atualizado em: 2026-08-11
Issue: #661
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe no seletor/badge de status existentes
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-36/canvases/plan-c119-ui-draft.canvas.tsx
Appetite: ~1 dia eng; um estado novo nos lugares onde status já existe
Responsável: —

## Intenção

No campo existe um perfil de liderança que não cabe em nenhum dos quatro status atuais: ela **não se compromete** com a campanha — já está comprometida com outra campanha ou tem outro impedimento — mas é **favorável** e vai trazer alguns votos por respeito/admiração ao mandato.

Hoje o assessor que encontra esse caso só tem duas saídas ruins: marcar "Em disputa" (status pendente, que promete trabalho de abordagem que não existe) ou "Negativo" (que apaga a informação mais valiosa — ela é favorável e conta no planejamento). O status "Lembrança" é o registro de que a conversa terminou bem: não vamos conquistar o compromisso, mas podemos contar com os votos dela.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador no campo (celular ou desktop), classificando lideranças após visitas e conversas.
- **Job principal:** registrar em um clique que a liderança não se compromete, mas é favorável — para a equipe parar de gastar esforço de abordagem e ainda contabilizá-la no planejamento.
- **Fluxo desejado:** abre a lista de lideranças → toca no badge de status da célula → escolhe "Lembrança" no popover → o badge muda e o valor salva sozinho (o auto-save da célula já existe) → a liderança sai dos "pendentes de abordagem" e segue visível como favorável nos filtros e nas leituras do Sollinha.
- **Anti-goals de produto:** não é um "negativo leve" — a liderança é favorável e os votos dela importam; não vira um estado que o assessor marque por dó. Não cria segundo eixo de classificação.

### Esboço de fluxo (B)

```text
[lista de lideranças — célula "Status"] → [toque no badge → popover com 5 opções]
→ [escolhe "Lembrança"] → [badge muda + salva sozinho]
→ [sai dos pendentes de abordagem] → [segue nos filtros/leituras como favorável]
```

## Objetivo e aceite

- O assessor consegue marcar "Lembrança" em **todas** as superfícies onde os quatro status atuais aparecem (célula da lista, ficha, wizard, admin, filtro da lista de pessoas).
- Liderança "Lembrança" **não** aparece nos pendentes de abordagem — nem na ferramenta do Sollinha ("quais lideranças precisam ser abordadas") nem no critério de pendência usado por ela. (Guardrail: mesmo padrão de exclusão do "Negativo".)
- O badge "Lembrança" é visualmente distinto dos quatro atuais.
- O filtro por status (lista de lideranças e lista de pessoas) inclui o novo valor.
- O Sollinha reconhece e consegue responder sobre o status (rótulo na leitura de lideranças; pendências declaram o critério sem o novo estado).
- Nenhuma leitura existente quebra: agregações, filtros e tools continuam cobrindo o novo valor sem comportamento acidental (ex.: vazar para pendências).

## Dados (intenção)

- **Vou apresentar dados?** Não — o item adiciona um valor de classificação que já flui pelas listas existentes (filtro/facets). Nenhuma superfície de dado nova neste item.
- **Decisões desbloqueadas:** assessor/coordenador decide, por liderança, que ela é "favorável sem compromisso" em vez de pendente ou negativa. Essa classificação alimenta leituras futuras (planejamento, pendências) — sem métrica nova aqui.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/Leadership.ts` (campo `supportStatus`, `type: 'select'`, enum no Postgres — precisa de migration); `src/lib/schemas/leadership.ts` (enum zod); `src/utilities/leadership/leadershipLabels.ts` (rótulos); `src/components/campaign/leadership/SupportStatusBadge.tsx` e `LeadershipListSupportStatusControl.tsx` (lista); formulários `LeadershipForm`/`LeadershipInternalForm`/`WizardLeadershipForm`; filtro de status em `src/utilities/people/peopleData.ts` (lista de pessoas); tools do Sollinha `src/utilities/ai/tools/getLeaderships.ts` (rótulos) e `getPendingLeaderships.ts` (critério de pendência — o novo valor não pode entrar no pré-filtro), além do texto do critério no `systemPrompt.ts`.
- **Precedente a olhar:** planos `simplificar-modelo-lideranca.md` e `autosave-status-lista-liderancas.md`; critério de pendência documentado em `sollinha-liderancas-pendentes-abordagem.md` (o critério "negativo nunca entra" é o guardrail a espelhar para "lembrança nunca entra").
- **Risco de acoplamento:** o status é um enum no banco (migration de `ALTER TYPE`), consumido por lista, formulários, pessoas, admin e tools do Sollinha — qualquer superfície que itere os valores por engano precisa ser encontrada. Liderança é campo staff-only; leader lockdown não é afetado.

## Dependências

- Nenhuma dura. Suave: concluir após o C116–C118 (pessoas) se a fila assim o der, para não disputar as mesmas superfícies de lista.

## Fora de escopo

- Mudança de semântica dos status existentes (ex.: renomear "A abordar", reordenar) — outro item.
- Fluxo ou mecanismo novo para votos de "Lembrança" — decidido: votos declarados vão no mesmo campo já existente, sem fluxo próprio.
- Mudanças na UI além do encaixe do novo valor (sem redesign do seletor/badge).

## Rabbit holes de produto

- **Segundo eixo de classificação.** Se alguém "só completar" e achar que "favorável sem compromisso" precisa de um campo extra (ex.: intensidade, motivo), explode para matriz de combinações. **Corte neste item:** um valor a mais no enum existente; motivo/nota já tem `notes`.
- **Lembrança nos pendentes.** Incluir o novo estado no critério de "precisa ser abordada" geraria fila de trabalho que não existe. **Corte:** espelhar a exclusão do "Negativo" (fail-closed na query, não só na UI).
- **Tratamento de votos especializado.** "Contar votos por admiração" pode puxar lógica de pledge nova. **Corte neste item:** decidido no gate — os votos de uma "Lembrança" usam o mesmo campo de votos declarados já existente, sem fluxo próprio; nada de mecanismo novo.

## Questões em aberto (produto)

- **"Lembrança" pode ter votos registrados (pledge) no planejamento?** **Decidido (gate 2026-08-11):** sim — os votos vão no **mesmo campo já existente para votos declarados**, sem fluxo próprio. A liderança "Lembrança" se comporta como qualquer outra quanto a votos; o status é só classificação.
- **Onde "Lembrança" entra na ordem do seletor?** **Decidido (gate 2026-08-11):** entre "Em disputa" e "Negativo" — estado resolvido, não estado de engajamento.
- **"Lembrança" deve aparecer como opção em filtros rápidos/contadores de status?** **Decidido (gate 2026-08-11):** sim — como qualquer outro valor; filtros derivam dos valores existentes.
- **"Lembrança" conta como pendente de abordagem?** **Decidido (gate 2026-08-11):** não — espelha a exclusão do "Negativo" (fail-closed na query, não só na UI).

## Referências

- GitHub Issue #661
- Canvas UI (gate): [plan-c119-ui-draft.canvas.tsx](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-plans-plan-issue-36/canvases/plan-c119-ui-draft.canvas.tsx)
- `src/collections/Leadership.ts` (campo `supportStatus`), `src/lib/schemas/leadership.ts`, `src/utilities/leadership/leadershipLabels.ts`
- `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (critério de pendência), `docs/plans/autosave-status-lista-liderancas.md`
- `src/utilities/ai/tools/getPendingLeaderships.ts` (pré-filtro de pendência)
