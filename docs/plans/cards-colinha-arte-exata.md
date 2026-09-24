# S34 — Minha colinha: a arte exata entregue pelo humano + a linha do estadual preenchida

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1298
Priority: P1
Impeccable: C — ajuste visual num modelo existente do funil público (sem superfície nova)
Design UI: docs/plans/cards-colinha-arte-exata-ui-design.html
Appetite: ~0,5–1 dia eng; a arte aprovada vira a base e só a linha do estadual é preenchida
Responsável: —

## Intenção

O humano aprovou uma arte exata para a colinha (o arquivo dele, `modelo-colinha.jpeg`) e o que chegou ao ar foi uma recriação do zero — parecida, mas lida como outro card. O verbatim: «E na criação da colinha parece que você gerou uma nova colinha do zero em vez de usar a imagem de colinha que eu te forneci. Era pra usar exatamente a imagem que eu forneci, apenas adicionando o preenchimento da linha de deputado estadual.»

A correção é de premissa, não de polimento: a arte aprovada passa a ser a base da prévia e do download, e o único desenho novo é o preenchimento da linha `DEPUTADO ESTADUAL` (2ª linha) com o nome de urna e os cinco dígitos. Nada mais é redesenhado — topo, cinco linhas fixas, linha legal e selos vêm da imagem, intocados.

## Persona e fluxo

- **Persona / contexto:** militante/eleitor no celular, prestes a pedir voto na rua ou no grupo; quer a colinha exata que a coordenação aprovou, com o estadual dele preenchido.
- **Job principal:** baixar a colinha oficial com a linha do estadual preenchida, sem que a arte mude em nada.
- **Fluxo desejado:** home (`#cards`) ou `/cards` → escolhe `Minha colinha` → escolhe o estadual na lista da dobradinha (S30) → vê a prévia 9:16 igual à arte aprovada, com a linha preenchida → baixa o PNG 1080×1920.
- **Anti-goals de produto:** segundo editor/estúdio; redesenhar ou re-digitar o conteúdo fixo da arte; editar o arquivo de imagem; CMS/migration; PDF/A4; nome/foto do visitante; analytics novo.

### Design UI (C)

- Design UI (gate): `docs/plans/cards-colinha-arte-exata-ui-design.html`
- Cenas: prévia vazia (a arte como está), prévia com a linha do estadual preenchida e o detalhe da linha lado a lado com uma linha fixa da própria arte (tipografia, peso e tamanho).

## Objetivo e aceite

- A prévia e o PNG baixado (1080×1920) são a imagem fornecida — o asset aprovado, sem recriação, ampliado exatamente 1,2× (900×1600 → 1080×1920) — com SÓ a linha `DEPUTADO ESTADUAL` preenchida: nome de urna em caixa alta + os cinco dígitos, um por caixa existente.
- O topo, as cinco linhas fixas, a linha legal e os selos `CONFIRMA` vêm da arte, intocados; nenhum outro pixel é redesenhado.
- Sem estadual escolhido, a prévia mostra a linha em branco como está na arte e o download fica desabilitado.
- A linha preenchida lê como parte da arte: mesma tipografia/peso/cor/tamanho das linhas fixas, mesma linha de base, dígitos centrados nas caixas e nome cabendo sem colidir com o rótulo nem com a borda do desenho.
- O asset continua sendo o tile da galeria; um só editor/fluxo, 100% no aparelho, sem superfície nova de seleção; o analytics de S32 fica intocado.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A — nenhuma métrica; o catálogo de estaduais é conteúdo (arte + número), não análise.
- **Forma:** _adiada ao plano de implementação_ — a escolha do estadual segue insumo local da imagem; medir uso é S32.

## Dados da decisão (literais)

- Model id `minha-colinha`; rótulo `Minha colinha`.
- Base aprovada: `public/cards/modelo-colinha.jpeg` — cópia byte a byte do arquivo entregue (`docs/plans/cards-colinha-ui-design-assets/modelo-colinha.jpeg`), 900×1600, sha256 `76505492fb243c67313d237e58926afbd4d0847c00ab3bb43c090859cbdf18c8`; segue o tile da galeria.
- Saída PNG 1080×1920: a arte ampliada exatamente 1,2×, sem recorte e sem reescala parcial.
- Linha preenchida: `DEPUTADO ESTADUAL` (2ª linha do card) — nome de urna em caixa alta + os 5 dígitos do catálogo compartilhado com S30 (`stateDeputyCatalog`), um dígito por caixa existente.
- Estado vazio: a arte como está (caixas vazias e selo `CONFIRMA` pleno, como na arte) e download desabilitado.
- Sem nome/foto do visitante; topo e linhas fixas vêm da arte.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/lib/cardRender.ts` (`renderColinhaCard` → base + preenchimento da linha), `src/lib/cardColinha.ts` (geometria/linhas — a maior parte do layout do zero morre; fica só o que o preenchimento precisa), `src/lib/cardModels.ts` (`assetSrc`/`lockupSrc` do modelo), `src/components/cards/CardComposer.tsx` (o branch da colinha carrega a base), testes.
- **Precedente a olhar:** S31 (#1272) e S30 (#1271) — modelo, catálogo e seletor já existem.
- **Risco de acoplamento:** a composição do zero deve ser REMOVIDA, não duplicada (sem segunda via morta); os pins de unit/e2e da composição antiga precisam ser reescritos; `#1277` (fatiar o `CardComposer`) mexe no mesmo arquivo — coordenar/rebasear.

## Dependências

- Nenhuma dura (S30/S31 entregues). Soft: `#1277` (mesmo arquivo — fatiar o `CardComposer`).

## Fora de escopo

- Redesenhar/editar a arte; mexer no topo, nas linhas fixas, na linha legal ou nos selos.
- PDF/A4 ou impressão; nome/foto do visitante; analytics novo (S32 intocado); segundo editor/rota.

## Rabbit holes de produto

- **Reconstruir a arte em vetor por cima do raster.** Se alguém "só completar": vira redesenho tipográfico infinito e o resultado deixa de ser a arte aprovada. **Corte neste item:** a arte exata é a base.
- **Melhorar a arte do humano.** Se alguém "só completar": reposiciona elementos, "corrige" cores e o humano deixa de reconhecer o próprio arquivo. **Corte neste item:** só a linha do estadual é tocada.
- **A4 no mesmo item.** Se alguém "só completar": entra diagramação de impressão e margem de impressora. **Corte neste item:** só PNG 9:16.

## Questões em aberto (produto)

- **Onde entra o nome, já que a arte em branco tem o rótulo `DEPUTADO ESTADUAL` no fim da linha (alinhado à direita) e o espaço vago à esquerda dele?** **Opções:** A) redesenhar a linha no padrão das linhas fixas — rótulo à esquerda + nome à direita, alinhados à direita (edição invisível sobre o fundo branco) | B) preencher só o vão à esquerda do rótulo, base intocada (leitura "NOME DEPUTADO ESTADUAL") | C) só os dígitos, sem nome. **Recomendação:** A — casa com as outras cinco linhas e é o que faz a linha ler como preenchida. _(assumido — validar com produto)_
- **Fonte da linha preenchida?** **Opções:** A) aceitar a face mais próxima e provar lado a lado no PR | B) carregar uma face Black só para o preenchimento. **Recomendação:** A — menor custo; a conferência lado a lado é o aceite. _(assumido — validar com produto)_
- **O rótulo pode ser reescrito por cima do fundo?** **Opções:** A) sim, é o que faz a linha ler como as outras | B) não tocar no que já está na arte. **Recomendação:** A. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1272 (S31 — modelo `Minha colinha` entregue)
- `docs/plans/cards-colinha.md` e `docs/plans/cards-colinha-impl.md` — S31 e a Decisão 2 (recusou usar a arte como base)
- `docs/plans/cards-estadual-dobradinha.md` — S30 (catálogo `stateDeputyCatalog`)
- `docs/plans/cards-analytics.md` — S32 (intocado)
- Arte aprovada: `docs/plans/cards-colinha-ui-design-assets/modelo-colinha.jpeg` (= `public/cards/modelo-colinha.jpeg`)
- Design UI (gate): `docs/plans/cards-colinha-arte-exata-ui-design.html`
- Arquivos úteis: `src/lib/cardColinha.ts`, `src/lib/cardRender.ts`, `src/components/cards/CardComposer.tsx`, `tests/unit/cardColinha.unit.spec.ts`, `tests/e2e/frontend.e2e.spec.ts`

## Self-score (shaping)

**5/5.**

- Fatia = um outcome verificável (colinha baixada = arte aprovada com a linha do estadual preenchida) e nada além.
- Appetite (~0,5–1 dia) declarado e a intenção cabe: a arte já existe; só a linha do estadual é preenchida.
- Persona, job e aceite em linguagem de produto; anti-goals e rabbit holes nomeados.
- Direção no codebase é hipótese revisável; nenhuma signature, schema ou migration prescrita.
- As três questões abertas têm opções e recomendação; a fidelidade da fonte é provada lado a lado no PR, não presumida.
