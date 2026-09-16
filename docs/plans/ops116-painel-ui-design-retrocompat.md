# OPS116 — Painel/TUI: aceitar `-ui-design.html` com retrocompat `-ui-draft.html`

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1059
Priority: P2
Impeccable: A — N/A (tooling de terminal; não toca UI de produto)
Rascunho UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável
Responsável: —

## Intenção

O OPS114 renomeou o artefato de validação visual do planejamento de "rascunho UI" para "design UI", com arquivo `docs/plans/<slug>-ui-design.html`. O painel de issues (`pnpm issues:tui`, OPS109) ficou para trás: continua procurando só `-ui-draft.html` e chamando a ação de "rascunho UI". Depois do OPS114, uma Issue nova com design no gate aparece no painel como se não tivesse o arquivo — a tecla `w` diz "não tem" mesmo tendo — e o operador perde o atalho de abrir o design no browser antes de decidir sobre a Issue. Quero que o painel reconheça os dois nomes — preferindo o novo — e fale "design UI", sem tocar nos planos antigos.

## Persona e fluxo

- **Persona / contexto:** o mantenedor (fsolla) operando issues pelo terminal, na mesa ou via SSH, olhando uma Issue antes de aprovar o plano ou entrar no run.
- **Job principal:** ver que a Issue tem design UI e abri-lo no browser com uma tecla, sem caçar o caminho no GitHub ou no disco.
- **Fluxo desejado:** lista → seleciona a Issue → no detalhe vê `w design UI · <caminho>` (ou "não tem (classe A)") → aperta `w` e o `.html` abre no browser padrão (ou imprime o caminho, quando não há display).
- **Anti-goals de produto:** não vira renderizador de imagem nem preview embutido; não migra o acervo legado de planos; não muda a UI de produto do `/campanha` nem o site; não adiciona ações novas ao painel.

## Objetivo e aceite (outcome)

- Issue cujo plano tem só `<base>-ui-design.html` aparece com o design disponível no detalhe e a tecla `w` abre/entrega o caminho certo.
- Issue legada, com só `<base>-ui-draft.html`, continua funcionando igual a hoje (retrocompat; planos antigos são imutáveis).
- Quando os dois arquivos existem, o painel usa o `-ui-design.html`.
- O painel (detalhe, ajuda e mensagens) fala "design UI"; "rascunho UI" some das superfícies do painel.
- O contrato `--json` segue legível pelo consumidor atual sem quebra silenciosa: a linha da Issue carrega o **caminho real** do arquivo encontrado e a informação de existência.
- Nada de PNG: só HTML (a decisão "HTML-only, no PNG rendering" continua).

## Dados (intenção)

- **Vou apresentar dados?** Não — é ferramenta de operação; a "superfície" é a própria TUI, sem métrica de produto.
- **Decisões desbloqueadas:** N/A — não há decisão de negócio; é continuidade de leitura do acervo de planos.
- **Forma:** N/A.

## Dados da decisão (literais)

- **Decisão de dados de produto:** N/A — nada de eleitoral/contato/consentimento neste item.
- Nomes literais: preferir `docs/plans/<base>-ui-design.html`; cair para `docs/plans/<base>-ui-draft.html` quando o primeiro não existir, na mesma base do plano de intenção já usada para `-impl.md`.
- Nomenclatura recomendada (menor churn): manter a chave `uiDraft` no view model e no `toJsonPayload` (`version: 1`), porém com `path` = arquivo **realmente encontrado**; quem quiser saber o nome concreto lê o sufixo do caminho. Campo novo (`variant`) ou rename fica fora.
- Strings exatas (substituindo as atuais em `scripts/issues-tui.mjs:19,339,340,359,637`): `w design UI` · `w abrir design UI no browser` · `w design UI: não tem (classe A)`.
- Sem mudança de schema → sem migration (`pnpm migrate:create` não é usado neste item).

## Escopo

- `scripts/lib/issues-panel.mjs`: derivar os **dois** nomes irmãos (`<base>-ui-design.html` preferido, `<base>-ui-draft.html` fallback) e devolver no view model/JSON o caminho real do que existe — mantendo a chave atual `uiDraft`.
- `scripts/issues-tui.mjs`: sondar existência na ordem design → draft; strings "rascunho UI" → "design UI" (ajuda `:19`, linha de ação `:339-340`, rodapé `:359` e mensagem do handler `w` `:637`).
- Testes unit dos dois specs do painel: atualizar expectativas de nome e cobrir design-only, draft-only, ambos (design vence) e nenhum.
- Entrada de changelog da entrega (`docs/changelog/2026-09-15-ops116.md`), conforme convenção do repo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/issues-panel.mjs` (derivação pura: `siblingPlanPaths`, `buildIssueRow`, `buildPanelViewModel`, `toJsonPayload`) e `scripts/issues-tui.mjs` (I/O: `readPlans`, render do detalhe, handler `w`).
- **Precedente a olhar:** OPS109 (`docs/plans/ops109-painel-issues-no-terminal.md` + impl), que estabeleceu o painel, a chave `uiDraft` e os 28 `-ui-draft.html` legados; OPS114 para o contrato do nome novo.
- **Risco de acoplamento:** a existência do arquivo é checada no CLI (o lib é puro e não toca disco) — manter essa divisão. `--json` é consumido por teste/script: tratar a chave como superfície pública (mudança silenciosa é regressão).

## Dependências

- **OPS114 (dura, declarada no registro)** — dono do rename `-ui-design.html`/"design UI" nos planos e na skill. No código, este item é seguro mesmo antes: sem arquivo novo, o fallback legado mantém tudo como está.

## Fora de escopo

- Migrar/renomear os `*-ui-draft.html` e PNGs existentes em `docs/plans/` (~28 HTMLs e ~45 PNGs) — acervo legado é imutável.
- Recriar renderizador de PNG/`scripts/render-ui-draft.mjs` (removido em 2026-08-21; HTML-only segue).
- Renomear a chave `uiDraft` do view model/JSON ou subir a versão do payload (churn sem consumidor novo).
- Tocar na skill `plan-issue`/template (dono do rename é o OPS114) ou em UI de produto.
- Qualquer mudança em claim/registro/sessões, guards de CI, ou no fluxo `--json` além do necessário.

## Rabbit holes de produto

- **"Já que achou o caminho, deixar o painel renderizar o HTML/imagem."** Vira viewer embutido, segundo dono de preview. **Corte:** só abrir no browser/imprimir caminho, como hoje.
- **"Aproveitar e renomear tudo para `-ui-design`."** Puxa migração de acervo imutável e PR de planos antigos. **Corte:** retrocompat de leitura.
- **"Limpar o vocabulário no repo inteiro."** Renomeia docs/changelog/skill (dono é OPS114) e explode o diff. **Corte:** só as superfícies do painel.

## Questões em aberto (produto)

- **A mensagem de ausência mantém "(classe A)"?** **Opções:** A) uniforme (`design UI: não tem (classe A)`) | B) sem "design UI". **Recomendação:** A — uma palavra por superfície; o "(classe A)" já explica. _(assumido — validar no gate)_
- **Caminho exibido quando nenhum arquivo existe:** **Opções:** A) candidato novo (`-ui-design.html`) com `exists: false` | B) manter o antigo. **Recomendação:** A — ensina o nome novo; o fallback real continua valendo quando o legado existir. _(assumido)_
- **Dependência do OPS114 é dura?** **Opções:** A) dura (bloqueia claim até o rename estar em main) | B) suave (o item só lê nomes). **Recomendação:** A no registro, como pedido pelo gate; a entrega é segura de qualquer forma. _(assumido)_

## Fases (ordem sugerida)

1. **Camada pura** — dois candidatos de design no `siblingPlanPaths` + caminho real no view model; escrever primeiro os unit tests (design-only, draft-only, ambos, nenhum) e fazer passar.
2. **CLI** — `readPlans` sonda design → draft; render/ajuda/mensagens para "design UI"; smoke manual `pnpm issues:tui --json` (com token) conferindo o caminho real numa issue com draft legado.
3. **Fechamento** — specs existentes atualizados, changelog da entrega e verificação abaixo.

## Verificação

- Unit focado nos dois specs do painel (rápido, sem DB):
  `pnpm test:unit -- tests/unit/issuesPanel.unit.spec.ts tests/unit/issuesPanelRegression.unit.spec.ts`
- Gate local (lint + typecheck + unit completo): `pnpm gate:fast`
- Guarda de localização de testes (nenhum spec novo fora de `tests/unit`): `node scripts/check-test-locations.mjs`
- Smoke manual (não-gate, exige `GITHUB_TOKEN`): `pnpm issues:tui --json` e conferir que uma Issue com `-ui-draft.html` traz o caminho real e `exists: true`; abrir `pnpm issues:tui` e conferir "design UI" no detalhe.

## Riscos

- **Regressão silenciosa do `--json`:** manter `version: 1` e o shape `{ path, exists }`; campo a mais seria contrato novo sem pedido.
- **Confusão de nomes no código:** a chave `uiDraft` passa a significar "design UI (novo ou legado)" — comentar no owner em vez de duplicar campos.
- **Teste que fixa o nome antigo:** os dois specs citados têm expectativas literais de `-ui-draft.html`; atualizar junto (senão o gate fica vermelho).
- **Acervo legado:** não tocar nos arquivos existentes; a retrocompat é de leitura, não de migração.

## Referências

- GitHub Issue #OPS116 (a registrar; placeholder)
- Design UI (gate): N/A — classe A (sem UI de produto)
- Plano pai (imutável): `docs/plans/ops109-painel-issues-no-terminal.md` e `docs/plans/ops109-painel-issues-no-terminal-impl.md`
- Arquivos owner: `scripts/lib/issues-panel.mjs:5,89-101,180-254,359-391`; `scripts/issues-tui.mjs:19,104-120,335-341,354-363,633-639`
- Testes: `tests/unit/issuesPanel.unit.spec.ts:91-105,153-156,265,290`; `tests/unit/issuesPanelRegression.unit.spec.ts:152`
- Guards/CI citados: `scripts/check-test-locations.mjs`, `scripts/check-plans-only-pr-closes.mjs`; gate local `pnpm gate:fast` (`lint && typecheck && test:unit`)
