# B172 — Lista de municípios: ao colapsar, coluna de Tendência desaparece e o ícone vai para Ações

Status: rascunho
Atualizado em: 2026-08-08
Issue: #446
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: B — encaixe em tela existente (`/campanha/municipios`, tabela staff)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b172-ui-draft.canvas.tsx`
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

Na lista de Municípios (modo staff), quando o painel de conteúdo fica estreito a coluna **Tendência** não realmente sai de cena: o badge de texto encolhe para um **ícone compacto dentro da própria coluna** (hoje abaixo de ~60rem do named container). A equipa de campo lê duas colunas quase vazias — `Tendência` e `Atualização` só com ícones — em vez de espaço de tabela útil.

O desejado: **nos tamanhos em que a Tendência colapsaria para ícone, esconder a coluna inteira** e mostrar o mesmo editor de tendência como **ícone compacto na última coluna (`Ações`)**, ao lado do ícone de atualização — que já mora lá por default (a coluna `Atualização` nasce oculta e o ícone fica em `Ações`). O status continua lendo-se de uma olhada e o clique abre o mesmo editor de hoje; só muda onde o trigger senta quando o espaço é curto.

## Persona e fluxo

- **Persona / contexto:** coordenador, candidato ou assessor em tablet/laptop de campo, com painel de conteúdo estreito (sidebar/chat abertos). Já decidiu o que fazer; quer escanear e agir sem perder largura para colunas de uma linha.
- **Job principal:** saber a tendência de cada município de uma olhada e conseguir editá-la em um toque, sem deixar colunas quase-vazias ocupando o painel.
- **Fluxo desejado:** com o painel estreito, a tabela mostra as colunas essenciais + no extremo direito uma coluna `Ações` com dois ícones: **[tendência] [atualização]** — o primeiro abre o editor de tendência (mesmo popover/autosave), o segundo registra atualização. Ao alargar o painel, a coluna `Tendência` reaparece com o badge completo e o ícone de tendência sai de `Ações` (nunca há o controle duas vezes na mesma linha).
- **Anti-goals de produto:** não duplicar o editor de tendência por linha (dois autosaves, dois popovers); não criar coluna nova no seletor B17; não mexer nos cards mobile (<48rem); não usar scroll horizontal como rede.

## Objetivo e aceite

- Abaixo da largura em que a Tendência colapsaria: a **coluna `Tendência` não é renderizada** e o **ícone compacto de tendência aparece em `Ações`**, ao lado do ícone de atualização.
- Acima dessa largura, com `Tendência` visível no picker: a coluna mostra o **badge completo** como hoje, e `Ações` não ganha cópia do ícone de tendência.
- Clicar no ícone abre o **mesmo editor** (status + justificativa, autosave, feedback de erro/salvando) — sem regressão.
- No máximo **uma instância** do editor de tendência por linha em qualquer faixa de largura.
- Preferência manual do picker continua valendo quando há espaço: ocultar `Tendência` no B17 segue deixando o ícone só em `Ações`; não ocultar segue mostrando a coluna nas faixas largas.
- Sem migration, collection, Consent, mudança de URL/filtro/sort de tendência. Sem JS de resize/media query: a troca é via container queries, como B158.
- **Dados: N/A** — sem números/KPIs; rearranjo puro de affordance da lista.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/components/campaign/municipality/MunicipalityList.tsx` (definição das colunas `trend` — ~linha 452 — e `actions` — ~linha 551, que já monta `renderTrendControl(municipality, 'compact')` quando `trendIsHidden`); `src/components/campaign/municipality/MunicipalityListTrendControl.tsx` (o seam `triggerPresentation: 'full' | 'compact' | 'adaptive'` já existe — hoje usado com `'adaptive'` na coluna). `src/lib/campaignColumnVisibility.ts` e o cookie B17 só como referência (regra de ocultação manual permanece).
- **Precedente a olhar:** `docs/plans/colunas-responsivas-municipios.md` (B158, entregue — decisão #9 hoje diz "container query nunca duplica: coluna adaptativa compacta no próprio lugar"; este item inverte essa regra **para Tendência**: estreito → coluna some e o ícone migra para `Ações`), `docs/plans/motivo-opcional-tendencia-e-nivel.md` (B134).
- **Risco de acoplamento:** respeitar a invariante B158 de **um editor por linha** (double autosave) e não regredir a regra do picker B17; a coluna `Atualização` só entra no escopo se o humano confirmar (ver questão 1).

## Dependências

- Nenhuma dura. B158 (entregue) é o precedente que define a matriz de larguras e a mecânica de `Ações`.

## Fora de escopo

- Aplicar a mesma regra à coluna `Atualização` quando manualmente visível (sucessor, se o humano quiser — ver questão 1).
- Cards mobile (<48rem) — mantêm `Tendência` e `Última atualização` como linhas próprias, intactos.
- Redesenhar o editor/popover de tendência ou a coluna `Ações` além deste movimento.
- Outras listas `/campanha` (não têm coluna de tendência).

## Rabbit holes de produto

- **"Já que movo o ícone, reorganizo Ações / junto outros controles / removo o seletor B17".** Explosão de escopo. **Corte neste item:** só a Tendência entra e sai de `Ações` por capacidade; demais controles e o picker inalterados.
- **"Duplico o editor para ter ícone em Ações e badge na coluna".** Double autosave/popover. **Corte neste item:** uma única instância por linha; a faixa de largura decide onde o trigger aparece (via CSS).

## Questões em aberto (produto)

- **Alcance: só `Tendência`, ou também `Atualização` quando o ator a mostrar?** O pedido reporta só a Tendência; `Atualização` já nasce oculta e seu ícone já vive em `Ações`. **Opções:** A) **só `Tendência`** — a coluna `Atualização`, se mostrada manualmente, continua colapsando no próprio lugar (comportamento B158 atual); B) aplicar a mesma regra às duas colunas quando manualmente visíveis. **Recomendação: A** — resolve o que foi reportado sem ampliar superfície; se a equipe quiser simetria depois, vira item sucessor pequeno. _(assumido — validar no gate)_
- **O corte de largura é o mesmo de hoje (~60rem, C2)?** **Opções:** A) manter o corte onde o badge deixa de caber (recomendado — é o ponto em que "colapsaria", descrito pelo usuário); B) recalibrar junto no craft. **Recomendação: A** — o contrato é comportamental (onde colapsa, vira ícone em `Ações`); a pinagem exata pode ser calibrada uma vez no craft com evidência.

## Referências

- GitHub Issue #446
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b172-ui-draft.canvas.tsx`
- `src/components/campaign/municipality/MunicipalityList.tsx`
- `src/components/campaign/municipality/MunicipalityListTrendControl.tsx`
- `src/utilities/municipality/municipalityListUrl.ts` (`municipalityColumnLabels`), `src/utilities/municipality/municipalityLabels.ts`
- `docs/plans/colunas-responsivas-municipios.md` (B158) — matriz de larguras e mecânica de `Ações`
