# S34 — Central de Conteúdos — lideranças que aparecem nas peças (propriedade e filtro)

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1303
Priority: P2
Impeccable: C — propriedade nova na ficha interna (C211) + faceta nova no catálogo público (S27)
Design UI: docs/plans/central-conteudos-liderancas-ui-design.html
Appetite: ~2 dias eng; um outcome verificável (a peça registra quem aparece e o catálogo público filtra por isso)
Responsável: —

## Intenção

A campanha já tem a Central de Conteúdos interna (C211), onde a assessoria cataloga as peças, e a Central pública (S27), onde o eleitor filtra por Tipo, Cidade, Região, Tema e Instituição — mas "quem aparece na peça" não existe em lugar nenhum. Numa campanha de dobradinhas, é exatamente esse o recorte que o eleitor procura: o material em que a liderança dele ou o estadual dele aparece, para repassar no grupo. A comunicação quer registrar isso na peça; o eleitor quer filtrar por isso. A decisão do humano no planejamento foi "Os dois": a peça registra as lideranças da campanha que aparecem E as figuras públicas (dobradinhas/estaduais e outras personalidades), e o catálogo público tem os dois recortes na mesma faceta `Lideranças`. O cuidado que define o item: o que é interno (liderança é PII, escopada por perfil) não pode vazar no que é público — a faceta mostra só nomes de quem aparece em peça publicada.

## Persona e fluxo

- **Persona / contexto:** dois atores. A assessoria de comunicação, na mesa, editando a ficha da peça (o mesmo gate que já edita a ficha hoje); o eleitor/liderança, no celular, na Central, procurando o material em que a referência dele aparece.
- **Job principal:** (comunicação) registrar quem aparece na peça; (eleitor) achar a peça em que uma pessoa aparece e repassá-la.
- **Fluxo desejado:** comunicação abre a ficha da peça → marca as lideranças da campanha que aparecem e as figuras públicas (dobradinhas/personalidades) → publica; eleitor abre `/conteudos` → filtra pela faceta `Lideranças` → vê só nomes de quem aparece em peça publicada → abre a peça e compartilha.
- **Anti-goals de produto:** segundo cadastro de pessoa; expor qualquer dado interno de liderança; virar diretório de lideranças ou placar de aparições; página pública por pessoa; mudar o que a liderança vê hoje (leader lockdown intocado).

### Esboço de fluxo (C)

```text
[assessoria] ficha da peça (C211)
→ marca quem aparece: lideranças da campanha (registros de Liderança) + figuras públicas (dobradinhas/personalidades)
→ publica a peça
[eleitor] /conteudos → faceta `Lideranças` (os dois recortes no mesmo filtro)
→ só nomes de quem aparece em pelo menos uma peça publicada (fail-closed)
→ abre a peça → baixa/compartilha
[peça despublicada] → o nome some da faceta se não houver outra peça publicada com ele
```

### Design UI (C)

- Design UI (gate): `docs/plans/central-conteudos-liderancas-ui-design.html` (+ assets em `central-conteudos-liderancas-ui-design-assets/`) — cenas: ficha interna com os dois recortes (lideranças + figuras públicas), faceta `Lideranças` no catálogo público (mobile/desktop) e o estado de peça sem ninguém marcado.

## Objetivo e aceite

- A ficha da peça registra dois recortes de "quem aparece": (1) as lideranças da campanha — os registros de Liderança existentes, sem cadastro novo — e (2) figuras públicas (dobradinhas/estaduais e outras personalidades), em texto curado com catálogo, no molde de Instituição.
- O catálogo público ganha a faceta `Lideranças`, unindo os dois recortes no mesmo filtro (decisão do humano: "Os dois"); os filtros continuam combinando entre si como hoje.
- **Fail-closed de exposição:** a faceta mostra só NOMES de pessoas referenciadas por pelo menos uma peça publicada; nunca expõe liderança ou figura que não aparece em peça publicada.
- **Nada de dado interno:** sem contato, telefone, e-mail, municípios, organizações, status ou votos (declarados/estimados) de liderança; o leader lockdown segue intocado.
- Quem edita é quem já edita a ficha hoje (gate da assessoria de comunicação); a catalogação pode sugerir, mas nunca sobrescreve curadoria humana.
- Os nomes marcados entram na busca por termo da Central como qualquer outro conteúdo — buscar o nome de quem aparece acha a peça.
- Publicar/despublicar atualiza a faceta na hora: sem peça publicada com o nome, ele não aparece.
- Guardrails: sem cadastro paralelo de pessoa (relaciona ao dono existente ou usa o molde texto+catálogo); nada novo de PII é capturado e Consent/LGPD ficam intocados — a metade "lideranças da campanha" só mostra dados quando existirem lideranças (o dado de liderança segue atrás do bloqueio LGPD de produção).

## Dados (intenção)

- **Vou apresentar dados?** Não — a faceta é uma lista de nomes; sem contagem, sem ranking, sem placar de aparições.
- **Decisões desbloqueadas:** a comunicação decide quem aparece em cada peça; o eleitor decide qual peça procurar pelo nome de quem aparece nela.
- **Forma:** *adiada ao plano de implementação* — restrição de produto: só nomes de exibição (sem número, sem contagem por pessoa, sem métrica de aparições).

## Dados da decisão (literais)

- ID `S34`; slug `central-conteudos-liderancas` (arquivo `docs/plans/central-conteudos-liderancas.md`); tipo `feature`; Priority `P2`.
- Faceta pública: rótulo `Lideranças` (uma só), unindo os dois recortes no mesmo filtro.
- Recorte 1 — lideranças da campanha: os registros de `Liderança` existentes (dono atual; não criar cadastro de pessoa).
- Recorte 2 — figuras públicas: dobradinhas/estaduais do roster público e outras personalidades, em texto curado com catálogo (molde de `Instituição`), semeado com os nomes das dobradinhas.
- Regra de exposição (fail-closed): só NOMES de pessoas que aparecem em pelo menos uma peça publicada; sem peça publicada, o nome não aparece.
- Resposta do humano no planejamento (verbatim): **"Os dois"** — a peça registra lideranças da campanha E figuras públicas, e o filtro público tem os dois recortes na mesma faceta.
- Guardrail literal: **sem cadastro paralelo de pessoa**; sem exposição de contato/território/votos da liderança.

## Direção no codebase (hipótese)

- **Áreas prováveis:** ficha interna da peça (`src/components/campaign/content/ContentPieceForm.tsx`, `src/utilities/content/…`); contrato/filtro público (`src/lib/contentPieceCatalog.ts`, `src/components/conteudos/ContentPieceFilters.tsx`); catalogação (`src/utilities/content/contentPieceCataloging.ts`).
- **Precedente a olhar:** `institution` — campo texto na peça (`src/collections/ContentPiece.ts:303-307`) + catálogo (`src/lib/institutionCatalog.ts`) + aliases (`src/lib/institutionNameAliases.ts`) + match na catalogação (`contentPieceCataloging.ts:181-193`); a faceta pública deriva rótulos das peças publicadas por `slugify` (`contentPieceCatalog.ts:155-184,252-269`), parâmetro `instituicao` (`:39-55,96-107`). `Speech.mentionedPeople` (`src/collections/Speech.ts:306-312`) é precedente de "pessoas citadas" por texto, mas sem filtro público — não copiar o par acervo/C200.
- **Roster público de pessoas:** `src/lib/stateDeputyCatalog.ts` (53 dobradinhas, nome+número, público via S30).
- **Risco de acoplamento:** `leadership` é interno e PII-bound (leitura escopada por perfil — `src/utilities/access/leaderships.ts:31-32`); a superfície pública não pode ler `leadership`, `Contact`, `campaignUser` ou `electionCandidate` nem expor campo interno — os nomes públicos derivam só das peças publicadas. A busca pública casa o texto normalizado da peça (`src/lib/contentPiece.ts:323`), então o nome precisa ser encontrável por lá. Leader lockdown intocado.

## Dependências

- C211 (peças catalogadas/publicadas) e S27 (catálogo público com facetas) entregues — dura: sem peça publicada não há nome na faceta.
- Roster das dobradinhas (S30) como semente do recorte de figuras públicas — soft.
- Design hi-fi aprovado no gate.

## Fora de escopo

- Cards personalizados: a escolha do estadual no estúdio (S30/S31) é do visitante, não propriedade da peça.
- C200 (separação por pessoa no acervo / speakers em gravações, #1167) — superfície distinta; não acoplar.
- Expor qualquer dado interno de liderança (contato, telefone, e-mail, municípios, organizações, votos declarados/estimados).
- Mudanças de LGPD/Consent: nada novo de PII é capturado; o dado de liderança segue atrás do bloqueio LGPD de produção (a metade campanha só mostra quando houver lideranças).
- Filtro/coluna na lista interna de peças — só se o gate pedir (ver Q(a)).
- Página pública por pessoa, diretório/ranking de aparições, analytics de circulação (C213).

## Rabbit holes de produto

- **Cadastro paralelo de pessoa.** Se alguém "só completar": collection de "pessoas que aparecem" com nome/telefone/cidade. **Corte neste item:** liderança = registro existente; figura pública = texto curado + catálogo; nenhum cadastro novo.
- **A faceta virar diretório de lideranças.** Se alguém "só completar": listar todas as lideranças, com município e status. **Corte neste item:** só nomes de quem aparece em peça publicada; nada de dado interno.
- **Placar de aparições.** Se alguém "só completar": contador por pessoa, "quem aparece mais", ranking. **Corte neste item:** lista de nomes sem número.
- **Página por pessoa.** Se alguém "só completar": `/conteudos/pessoa/<nome>` ou um hub da liderança. **Corte neste item:** uma faceta no catálogo existente; a peça continua sendo a unidade.
- **A catalogação automática decidir por gente.** Se alguém "só completar": o pipeline preenche e sobrescreve os nomes. **Corte neste item:** sugestão só quando confiável; curadoria humana manda.

## Questões em aberto (produto)

- **Filtro só público ou também filtro/coluna na lista interna?** **Opções:** A) faceta pública (o pedido) + propriedade visível/editável na ficha interna | B) também filtro/coluna na lista interna. **Recomendação:** A — é o pedido; filtro/coluna interno só se o gate pedir. _(assumido — validar com produto)_
- **Uma faceta unindo os dois recortes ou duas facetas?** **Opções:** A) uma faceta `Lideranças` com os dois recortes | B) `Lideranças` + `Figuras públicas`. **Recomendação:** A — o humano escolheu "Os dois" no mesmo filtro; B fica registrada como alternativa se o volume de figuras públicas justificar separar. _(assumido — validar com produto)_
- **O recorte de figuras públicas reusa o roster das dobradinhas ou é texto com aliases?** **Opções:** A) texto curado + catálogo no molde de Instituição, semeado com os nomes das dobradinhas | B) só o roster fechado das 53 dobradinhas | C) texto livre sem catálogo. **Recomendação:** A — cobre dobradinhas e outras personalidades sem inventar cadastro; C perde o casamento de grafias. _(assumido — validar com produto)_
- **Que nome da liderança aparece?** **Opções:** A) o nome do contato (é o título da Liderança hoje) | B) algum rótulo composto. **Recomendação:** A — só o nome; nunca telefone, e-mail ou município. _(assumido — validar com produto)_

## Referências

- GitHub Issue — a registrar (`pnpm agent:register`).
- Design UI (gate): `docs/plans/central-conteudos-liderancas-ui-design.html` (+ assets em `central-conteudos-liderancas-ui-design-assets/`).
- Planos irmãos: `docs/plans/central-conteudos-ingestao.md` (C211), `docs/plans/central-conteudos-publica.md` (S27), `docs/plans/cards-estadual-dobradinha.md` (S30), `docs/plans/acervo-separacao-por-pessoa.md` (C200 — fora de escopo).
- Arquivos-pista: `src/collections/ContentPiece.ts`, `src/components/campaign/content/ContentPieceForm.tsx`, `src/lib/contentPieceCatalog.ts`, `src/components/conteudos/ContentPieceFilters.tsx`, `src/lib/institutionCatalog.ts`, `src/lib/institutionNameAliases.ts`, `src/utilities/content/contentPieceCataloging.ts`, `src/lib/stateDeputyCatalog.ts`, `src/collections/Leadership.ts`, `src/utilities/access/leaderships.ts`, `src/collections/Speech.ts`.
- `AGENTS.md` — convenções já travadas (Contact como dono da pessoa; sem cadastro paralelo; migrations para schema).

## Self-score (shaping)

5/5 — um outcome verificável, appetite declarado e nenhuma decisão dura de engenharia.

- Fatia = um outcome verificável: a peça registra quem aparece e o catálogo público filtra por isso.
- Appetite ~2 dias cabe: uma propriedade na ficha existente + uma faceta no catálogo existente, sem fluxo novo.
- Persona + job + aceite claros, em linguagem de produto, sem jargão de stack.
- Direção no codebase é hipótese: arquivos citados como pista, nenhum nome novo cravado.
- Zero schema/migration/signature no plano; literais são só de produto (rótulo, recortes, regra de exposição e a resposta do humano).
