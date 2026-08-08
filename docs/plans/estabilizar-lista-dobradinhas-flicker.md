# Estabilizar a lista de Dobradinhas (parar o flicker de linhas/colunas)

Status: rascunho
Atualizado em: 2026-08-08
Issue: #425
Priority: P1
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — estabilidade de lista existente (sem mudança de layout/copy; estado visual preservado)
Canvas UI: N/A — bug de estabilidade; superfície inalterada, sem estado novo a validar
Appetite: ~0,5–1 dia eng; um outcome verificável (lista sem onda de re-dimensionamento)
Responsável: —

## Intenção

A lista de Dobradinhas (`/campanha/dobradinhas`) "pisca" muito: linhas (e a sensação de colunas) mudam de tamanho em onda a cada carga ou navegação da lista. Nas células que mostram fichas (Municípios, Lideranças, Assessores), quando há mais de ~3 itens, cada célula passa por um ciclo de "medir → recolher para 'Ver mais…'" que acontece **depois** da primeira pintura: a linha nasce com uma altura e, um instante depois, cresce/encaixa para a altura final. Com várias células de chips por linha e várias linhas, o efeito parece constante — e se repete a cada paginação, ordenação ou filtro. A tabela deveria aparecer já no tamanho final, sem onda.

## Persona e fluxo

- **Persona / contexto:** coordenação/assessoria usando `/campanha/dobradinhas` no dia a dia (mesa, várias vezes por hora).
- **Job principal:** conferir e editar o colchão de dobradinhas/municípios sem a tabela "dançando" enquanto carrega ou filtra.
- **Fluxo desejado:** abre a lista → a tabela já vem no tamanho final → navega páginas / ordena / filtra por municípios e a lista troca de conteúdo **sem** re-dimensionar linhas → "Ver mais…" continua recolhendo/expandindo sob demanda.
- **Anti-goals de produto:** esta entrega **não** redesenha as células de chips, **não** muda a regra de recolher em 3 linhas, **não** vira um "deal com todo CLS do shell" (sidebar/omnibox/Sollinha são outras fontes).

## Objetivo e aceite

- Abrir `/campanha/dobradinhas`: a primeira pintura já mostra a altura final das linhas — nenhuma linha cresce/encolhe depois.
- Paginação, ordenação e filtros trocam o conteúdo sem onda de re-dimensionamento (a lista é que muda, não o tamanho das linhas).
- "Ver mais…" mantém o comportamento atual (recolher/expandir é o único ponto **intencional** de mudança de altura).
- A correção vale para as outras listas que usam as mesmas células de chips (Municípios, Lideranças, Assessores) sem regressão.
- Sem mudança de dados, permissões, URLs públicas ou schema.

## Dados (intenção)

- **Vou apresentar dados?** Não — N/A (não há métricas novas; estabilidade de leiaute é o aceite).
- **Decisões desbloqueadas:** nenhuma decisão de dado; aceite mensurável por observação (CLS da carga ≈ 0 atribuível às células).

## Direção no codebase (hipótese)

- **Áreas prováveis:** as três colunas de chips da lista de dobradinhas são especializações de uma mesma célula compartilhada de relações (`RelationChipCell`), montadas via wrappers de Municípios/Lideranças/Assessores; o ciclo medir→recolher vive aí (e é re-usado em outras listas `/campanha`).
- **Precedente a olhar:** o mecanismo de recolher por overflow ("Ver mais…") foi introduzido junto das células de chips; há testes unitários/integração dessas células.
- **Risco de acoplamento:** mudar o dono compartilhado afeta todas as listas de chips de uma vez — o executor deve validar as demais listas além de dobradinhas. Sem risco de schema/permissões.

## Dependências

- Nenhuma.

## Fora de escopo

- Redesign das células de chips ou da tabela.
- Alterar a regra de recolher em 3 linhas / o comportamento de "Ver mais…".
- Outras fontes de movimento de leiaute na shell (sidebar, omnibox, Sollinha, agenda) — podem virar item separado se aparecerem no mesmo trecho de UX.
- Migrations, dados, acesso.

## Rabbit holes de produto

- **"Eliminar todo CLS da página".** Se alguém "só completar", abraça o shell inteiro. **Corte neste item:** só o ciclo das células de chips na lista; outras fontes vão como item à parte.
- **"Simplificar o colapso para sempre mostrar tudo".** Mudaria o produto (linhas gigantes). **Corte:** manter recolher em 3 linhas + "Ver mais…"; estabilizar é diferente de remover o colapso.

## Questões em aberto (produto)

- **Onde aplicar a correção?** **Opções:** (A) só na lista de dobradinhas | (B) no dono compartilhado das células de chips, cobrindo todas as listas que usam "Ver mais…". **Recomendação:** B — mesmo mecanismo, mesmo bug, evita consertar por-lista. _(assumido — validar)_
- **Meta de aceite mensurável?** **Opções:** (A) só inspeção visual | (B) aceite visual + CLS da carga ≈ 0 atribuível às células. **Recomendação:** B — barato, objetivo, e desbloqueia regressão. _(assumido — validar)_
- **Precisa de canvas UI no gate?** **Opções:** (A) não — superfície preservada, sem estado novo | (B) sim, mostrar tabela atual→desejada. **Recomendação:** A — o resultado desejado é a tabela que já existe, sem oscilar; canvas não agrega ao aceite. _(assumido — validar)_

## Referências

- GitHub Issue #425
- Canvas UI (gate): N/A
- Arquivos úteis (pista, não contrato): a página `/campanha/dobradinhas` (`src/app/(campaign)/campanha/(app)/dobradinhas/page.tsx`), as células de chips de Municípios/Lideranças/Assessores e o mecanismo compartilhado de "medir → recolher" usado por elas; testes existentes dessas células.
