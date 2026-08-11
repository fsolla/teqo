# Pessoas: criação rápida de pessoa na lista (linha nova no topo com botão Salvar)

Status: rascunho
Atualizado em: 2026-08-11
Issue: #699
Priority: P1
Model: composer-2.5
Impeccable: B — encaixe na tabela/omnibox de `/campanha/pessoas` (botão ao lado do seletor de colunas + linha-draft)
Canvas UI: /home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-pessoas-ajustes-ui-draft.canvas.tsx (seção "Criação rápida de pessoa")
Appetite: ~0,5–1 dia eng; uma linha-draft + ação de criação
Responsável: —

## Intenção

Cadastrar uma pessoa nova exige hoje sair da lista (fluxo de criação das listas especializadas). A mesa quer criar direto em `/campanha/pessoas`: um botão "Nova pessoa" ao lado do seletor de colunas abre uma **linha em branco no topo da lista**, onde nome/telefone/capacidades são preenchidos inline e um botão de **Salvar** (na coluna de ações) confirma a criação.

## Persona e fluxo

- **Persona / contexto:** coordenador/candidato (e assessor na carteira dele) cadastrando contato novo durante atendimento.
- **Job principal:** criar a ficha da pessoa e já amarrar a primeira capacidade (cidade assessorada/liderada/onde dobra) sem trocar de tela.
- **Fluxo desejado:** clico em "Nova pessoa" → uma linha vazia aparece no topo da lista (nome e telefone em branco, capacidades vazias) → digito nome e telefone → adiciono a primeira cidade de uma capacidade (com C128, a pessoa nasce naquela tabela) → clico em "Salvar" → a linha vira uma pessoa de verdade na lista. "Descartar" (X) remove a linha sem salvar.
- **Anti-goals de produto:** não é modal/formulário novo (a linha é a superfície); não é segundo cadastro paralelo de pessoa (ficha continua `Contact`); não substitui os fluxos ricos das listas especializadas.

## Objetivo e aceite

- Botão **"Nova pessoa"** visível ao lado do seletor de colunas (barra de filtros) para quem pode criar (staff; escopo de carteira preservado para assessor).
- Clicar abre **uma linha-draft no topo da lista**, destacada, com: Nome e Contato (telefone) editáveis inline, as três colunas de capacidade vazias, e na coluna de ações um botão **Salvar** (+ descartar).
- **Salvar** cria a ficha (e, com C128, os vínculos de capacidade já adicionados na linha) e a pessoa aparece na lista; **Descartar** fecha a linha sem escrever nada.
- Salvar sem nome (ou só com nome, sem capacidade) não quebra a lista: pessoa sem capacidade continua fora da lista (regra C100) — a linha avisa quando isso acontecer em vez de "sumir" com a pessoa.
- A linha-draft respeita os mesmos limites das células normais (escopo de acesso, chips de território, "Salvador" agregado de C131).
- Sem regressão nas linhas normais: a linha-draft nunca conta como linha real (ordenação, filtros, paginação, facetas não a incluem).

## Dados (intenção)

- **Vou apresentar dados?** Não — cadastro, sem métrica.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/pessoas/page.tsx` (botão na barra de filtros, linha-draft no topo da tabela), células de capacidade em modo `draft` (as células de município já têm contrato de draft local), ação de criação de pessoa no estilo das ações de domínio existentes (`src/app/(campaign)/campanha/actions/…`), escrita transacional Contact + capacidades.
- **Precedente a olhar:** C128 (criação de entidade pela primeira cidade), criação de liderança/dobradinha/contato nas listas especializadas (findOrCreate de Contact + entidade, transação), células `draft` (`MunicipalityPortfolioCell.draft`), C116 (células sempre-input).
- **Risco de acoplamento:** a linha-draft lida com "pessoa que ainda não existe" — toda célula que hoje parte de `ownerId` existente precisa do caminho de criação; a regra C100 (sem capacidade não há linha) determina o que acontece ao salvar.

## Dependências

- **C128** (ordem/forte) — sem o ciclo de vida "primeira cidade cria a entidade", a linha-draft não consegue amarrar capacidades no momento da criação.
- Suave com C130 (a linha-draft usa as mesmas colunas/larguras da tabela ajustada).

## Fora de escopo

- Wizard rico de criação (telefones múltiplos, partido, organizações, convite) — a linha é o cadastro mínimo; o resto segue nas fichas.
- Edição de dados da linha-draft além de nome/telefone/capacidades (e-mail fica para depois da criação).
- Criação a partir do mobile (cards) no v1 — a pedido é o botão ao lado de Colunas (desktop).

## Rabbit holes de produto

- **Linha-draft vira mini-wizard**: se cada capacidade pedir seu próprio fluxo de criação na linha, a superfície explode. **Corte:** a linha só repete o comportamento das células normais (com C128 criando as entidades); sem campos extras além de nome/telefone.
- **"Salvar sem capacidade some a pessoa"**: a regra C100 confunde se a linha apenas "desaparece". **Corte:** aviso claro na linha ao salvar sem capacidade ("a pessoa não aparece na lista enquanto não tiver uma capacidade") + manter o cadastro feito (a ficha existe para o admin).
- **Duas linhas-draft simultâneas**: só uma linha de criação por vez (abrir outra descarta/fecha a atual sem salvar).

## Questões em aberto (produto)

- **Salvar pessoa sem nenhuma capacidade?** **Opções:** (a) salva a ficha e avisa que ela não aparece na lista (regra C100 mantida); (b) bloqueia o Salvar até ter uma capacidade. **Recomendação:** (a) — cadastro não deve ser impedido, mas o destino fica explícito no aviso. _(assumido — validar no gate)_
- **Quem pode usar "Nova pessoa"?** **Opções:** (a) todo staff da página (assessor cria na carteira dele); (b) só coordenação/candidato. **Recomendação:** (a) — com escopo de carteira igual às células; coordenação continua vendo tudo. _(assumido — validar no gate)_

## Referências

- Canvas UI (gate): plan-pessoas-ajustes-ui-draft.canvas.tsx (seção C132)
- Planos: [pessoas-qualquer-capacidade-para-toda-pessoa.md](pessoas-qualquer-capacidade-para-toda-pessoa.md) (C128 — criação pela primeira cidade), [pessoas-lista-unificada.md](pessoas-lista-unificada.md) (C100 — regra de visibilidade por capacidade), [pessoas-edicao-inplace-lista.md](pessoas-edicao-inplace-lista.md) (C116)
- `AGENTS.md` — transações multi-coleção, escopo de acesso por capacidade
