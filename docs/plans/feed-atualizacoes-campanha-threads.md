# C89 — Página Atualizações: feed de cards + filtro + criar (modal / bottom sheet)

Status: ready
Atualizado em: 2026-08-08
Issue: #401
Priority: P1
Model: cursor-grok-4.5-medium
Model-local: deepseek-v4-high
Impeccable: D — superfície nova: feed campanha-wide + criação in-place (modal ↔ bottom sheet)
Canvas UI: `/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-c89-ui-draft.canvas.tsx`
Appetite: ~1,5–2 dias eng; um outcome verificável — staff acompanha o que aconteceu na carteira num só lugar e registra novo fato sem sair da página
Responsável: —

## Intenção

A barra mobile (**B164**) já aponta **Atualizações** para `/campanha/atualizacoes` — hoje um placeholder honesto ("em breve"). Este item entrega a **página de verdade**: um **feed de cards de atualização**, mais recentes no topo, com um **filtro combinado** (mesmo padrão da lista de Municípios) e um **botão "+"** à direita do filtro que abre a criação de uma nova atualização — **modal em desktop, bottom sheet no mobile**. A discussão em fios por atualização é camada futura (**C88**), **não** bloqueia esta página.

## Persona e fluxo

- **Persona / contexto:** coordenador / assessor varrendo a carteira no celular ou na mesa; assessor vê só os municípios que administra.
- **Job principal:** ver o que aconteceu recentemente (e registrar um fato novo) sem entrar em cada município.
- **Fluxo desejado:**
  1. Abre **Atualizações** → feed cronológico da carteira do ator (mais recentes no topo).
  2. Usa o **combobox de filtro** acima do feed para estreitar por **município, polaridade, urgente, quem criou** ou **busca por texto** — um combobox só, no padrão omnibox das listas.
  3. Toca **"+"** ao lado do filtro → **modal** (desktop) / **bottom sheet** (mobile) → preenche texto + polaridade (+ urgente) → confirma → volta ao feed com o novo card no topo.
- **Anti-goals de produto:** tracker estilo Jira; thread/comentário/deliberação nesta fatia (→ **C88**); scroll infinito/KPI; feed público/liderança; misturar Demandas/Atividades; segundo modelo de atualização.

### Esboço de fluxo (D)

```text
[Atualizações]
  → feed (carteira, mais recentes no topo)
  → filtro combobox acima do feed
  → "+" → modal (desktop) / bottom sheet (mobile) → nova atualização
  → novo card no topo
```

## Objetivo e aceite

- **Atualizações** deixa de ser placeholder: rota de feed usável por staff no escopo da carteira, cards mais recentes primeiro.
- Card mostra o essencial do fato: **avatar de quem criou** (canto superior esquerdo), texto, polaridade, urgente, autor, identidade do município e data.
- **Filtro combobox** acima do feed, mesmo padrão do filtro da lista de Municípios (`/campanha/municipios`); cobre **município, polaridade, urgente, quem criou e busca por texto**.
- Botão **"+"** à direita do filtro abre a **criação de nova atualização**: modal em desktop e **bottom drawer/sheet no mobile**; confirmação insere no feed sem recarregar a página à toa.
- Criar segue as regras existentes de acesso (staff; assessor só nos municípios que administra) e o formulário/registro atual unificado.
- **Leader lockdown** intacto: liderança não vê o feed nem cria atualização.
- Thread/comentário/deliberação ficam para **C88** — esta página não inventa um segundo protocolo.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item (feed operacional, não KPI estadual).
- **Decisões desbloqueadas:**
  - Coordenação/assessor: "o que aconteceu na carteira desde ontem?"
  - Registrar: "anotei o fato do dia" (mesmo formulário unificado já vivo).
- **Forma:** adiada ao plano de implementação — restrição: leitura relativa à carteira do ator; sem % estadual absoluto.

## Direção no codebase (hipótese)

- **Áreas prováveis:** rota `/campanha/atualizacoes` (substitui o placeholder), componentes de feed e de criação de atualização no domínio do município, filtro/omnibox no padrão das listas, preview de bottom sheet já usado na área; loaders escopados ao papel do ator.
- **Precedente a olhar:** feed de atualizações do detalhe do município; formulário unificado de atualização já existente; filtro combobox/omnibox de Municípios (B127/B128/B120); avatar de usuário da campanha (foto ou iniciais); bottom sheet (B112/B109); dashboard "últimas atualizações de campo".
- **Risco de acoplamento:** access por município (assessor = carteira); não criar pessoa fora de `campaignUser`/`Contact`; não duplicar o registro de atualização — reusar o fluxo de criação existente; serialização com trabalho de C87/C88 se tocar schema.

## Dependências

- Soft: **C87** (modelo unificado já vivo no card/formulário — sem dura).
- Soft: **C88** (thread/discussão futura sobre os mesmos cards — não bloqueia esta página).
- Soft: **B164** (slot da barra já aponta para a rota — esta página substitui o placeholder).

## Fora de escopo

- Thread, comentário, responsável e "resolvido" por atualização → **C88** (depois; sobre os mesmos cards).
- Chrome da barra inferior / página Mais → **B164**.
- Redesign do formulário de registro (já unificado em **C87**).
- Analytics, scroll infinito, kanban, mentions/reações, feed público ou de liderança.

## Rabbit holes de produto

- **"Feed + thread no mesmo item."** Estoura appetite e acopla à deliberação (C88). **Corte:** só feed + filtro + criar; fio fica com C88.
- **"Filtrar por tudo."** Combobox vira BI. **Corte:** as dimensões pedidas (município, polaridade, urgente, quem criou, texto) são o teto — sem analytics, _saved filters_ nem cruzamento adicional.
- **"Botão + = formulário novo e diferente."** Segundo registro. **Corte:** reusar o fluxo/formulário unificado existente.
- **"Card clica e abre thread que não existe."** Expectativa furada. **Corte:** card lê o fato; interação de fio quando C88.

## Questões em aberto (produto)

- **Filtro do feed** — _resolvido (gate 2026-08-08):_ inclui **município, polaridade, urgente, quem criou e busca por texto** num único combobox (padrão omnibox, sugestões agrupadas).
- **Município ao criar:** obrigatório, com prefill do município do filtro ativo — _confirmado (gate 2026-08-08)._
- **Clique no card:** só leitura em v1 (sem thread, sem navegar) — _confirmado (gate 2026-08-08)._ Discussão vem com **C88**.
- **Avatar do autor:** no canto superior esquerdo do card (foto ou iniciais, como o restante da área) — _pedido no gate 2026-08-08._

## Referências

- GitHub Issue: [#401](https://github.com/fsolla/teqo/issues/401)
- Canvas UI (gate): [`plan-c89-ui-draft.canvas.tsx`](/home/fsolla/.cursor/projects/home-fsolla-cursor-worktrees-teqo-41rz/canvases/plan-c89-ui-draft.canvas.tsx)
- Irmão chrome: [barra-navegacao-inferior-mobile.md](barra-navegacao-inferior-mobile.md) (**B164**)
- Camadas futuras: [deliberacao-atualizacao-responsavel-thread.md](deliberacao-atualizacao-responsavel-thread.md) (**C88**), [atualizacao-unificada-polaridade-urgente.md](atualizacao-unificada-polaridade-urgente.md) (**C87**)
- Precedentes: filtro combobox de Municípios (B127/B128/B120), bottom sheet (B112/B109), `MunicipalityUpdateFeed`/form unificado
