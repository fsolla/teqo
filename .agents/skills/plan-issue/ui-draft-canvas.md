# Canvas de rascunho UI/UX (plan-issue)

Quando o item **muda UI** (classe Impeccable **B / C / D**, ou qualquer superfície que o usuário vê/toca), o gate **obrigatoriamente** apresenta um **Cursor canvas** com rascunho visual da intenção — não ASCII sozinho, não wireframe de implementação.

Leia e siga a skill `canvas` (`~/.cursor/skills-cursor/canvas/SKILL.md`) ao criar/editar o arquivo.

## Quando criar

| Situação | Canvas? |
| -------- | ------- |
| `Impeccable: A` / N/A sem UI / chore sem superfície | Não |
| Encaixe em tela existente (B) | Sim — estado atual → estado desejado da área tocada |
| Fluxo novo ou redesign local (C/D) | Sim — jornada + telas/estados chave |
| Só copy/label sem rearranjo | Não (a menos que o humano peça ver o contexto) |

Um canvas por item com UI (ou um canvas do lote com secções por ID, se o lote for pequeno e as superfícies forem do mesmo fluxo). Preferir **um arquivo por item** (`plan-<id>-ui-draft.canvas.tsx`).

## Onde gravar

Path canônico do IDE (não no repo Teqo):

`/Users/<user>/.cursor/projects/<workspace>/canvases/plan-<id>-ui-draft.canvas.tsx`

Ex.: `plan-c42-ui-draft.canvas.tsx`. Escreva o arquivo com a tool de write; não peça `mkdir`. No chat do gate, linke o path absoluto em markdown.

## O que mostrar (produto)

Rascunho de **intenção de uso**, legível sozinho:

1. **Persona + job** (uma linha).
2. **Jornada** (passos / estados) — o que a pessoa vê e decide.
3. **Layout esquemático** das superfícies tocadas: zonas (lista, detalhe, formulário, mapa, empty, erro), hierarquia de atenção, CTAs primários/secundários.
4. **Estados críticos** se mudarem o aceite (vazio, loading, sem permissão, fail-closed) — só os que importam ao produto.
5. **Fora de escopo visual** em callout curto (o que este item *não* redesenha).

Use `Stack` / `Grid` / `Row` / `Card` / `Pill` / `Callout` / `Text` / `H1`–`H3` de `cursor/canvas`. Cores só via `useHostTheme()`. Pode usar caixas/`div` com bordas de token para simular regiões de tela — isso é rascunho de UX, não componente do app.

## O que é proibido no canvas

- Assinaturas, nomes de arquivos/componentes obrigatórios, schema, migrations
- Brief Impeccable completo, craft/critique/polish, paleta/brand do produto Teqo
- Mock com dados inventados como se fossem métricas reais (“No data”, KPIs zerados) — omita secções sem conteúdo
- Gradientes, emojis, box-shadow, arco-íris (regras da skill canvas)
- Travar o executor numa única forma técnica

## Relação com o plano em `docs/plans/`

- No plano: campo **Canvas UI:** link/path do `.canvas.tsx` (ou `N/A — sem UI`).
- Esboço ASCII no markdown vira **opcional** (backup textual); o **canvas é o artefato do gate** para UI.
- O canvas **não** é commitado no repo Teqo por default — é artefato de sessão do gate. Se o humano pedir arquivar no repo, só com pedido explícito (fora do fluxo padrão).

## Gate

Antes de `pnpm agent:register`, mostre o overview do lote **e** o(s) canvas de UI. Itere no canvas até o humano confirmar a intenção visual. Só então registre a Issue.
