# Impl: OPS62-followup — flake do municipalitiesWithoutUpdateTool: fixture com relógio ancorado

Status: aprovado
Atualizado em: 2026-08-19
Issue: #81
Intenção: body da Issue é a spec (sem plano de intenção linkado)
Appetite restante: P3 — correção de teste, 1 linha de produção de fixture + verificação

## Leitura da intenção

- **Outcome:** eliminar o flake do teste `orders never-updated first (by name), then oldest
to newest (by name as tie-break)` (`municipalitiesWithoutUpdateTool.unit.spec.ts`), que
  recebeu `[Beta, Alpha]` no lugar de `[Alpha, Beta]` em 2026-08-18 (gate local 19:22 e CI
  run 779 23:53), tornando o spec deterministicamente estável sob carga.
- **O que NÃO negociar:** nenhum — o corpo da Issue não impõe lockdowns de produto; a
  semântica de ordenação B189 (nunca atualizados por nome no topo, depois do mais velho ao
  mais novo com tie-break por nome) é contrato do teste e do tool e **não muda**.
- **O que reavaliar:** a hipótese da Issue ("ordem recebida é a do fixture — sort não atuou;
  suspeita de locale/ICU do ambiente"). **Refutada por reprodução mecânica** — a causa raiz
  é do próprio fixture.

## Causa raiz (reproduzida)

`tests/unit/municipalitiesWithoutUpdateTool.unit.spec.ts:44`:

```ts
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()
```

O teste de ordenação constrói `Beta` e `Alpha` com **duas chamadas separadas** `daysAgo(40)`
(linhas 142 e 144). Se ≥1 ms decorrer entre as duas chamadas (GC pause, preempção do fork do
vitest sob suíte full em máquina compartilhada), o timestamp ISO de `Alpha` fica
**estritamente mais novo** que o de `Beta` → em `sortStale`
(`getMunicipalitiesWithoutUpdate.ts:198-205`), `leftAt !== rightAt` vence e o tie-break por
nome nunca dispara → `['Mike','Zulu','Beta','Alpha','Gama']` em vez de
`['Mike','Zulu','Alpha','Beta','Gama']`. É exatamente o diff reportado (só o par trocado,
resto correto).

Medições (`node /tmp/opencode/ops62-followup-repro.mjs`, sort de produção copiado verbatim):

- Fixture atual, sem pausa, 200 000 runs: **0.082% de falhas** (fronteira de ms cruzada).
- Fixture atual com pausa de 1 ms injetada entre as duas chamadas, 2000 runs: **100% de
  falhas**, amostra `["Mike","Zulu","Beta","Alpha","Gama"]`.
- Fixture ancorado com a mesma pausa, 2000 runs: **0 falhas**.

20 runs isolados passarem é consistente: em máquina ociosa a dupla chamada quase sempre
cai no mesmo milissegundo; sob carga, preempções ≥1 ms são rotina. Locale/ICU não é o
fator decisivo — `localeCompare('pt-BR')` é determinístico; quem decide o par errado são
timestamps acidentalmente desiguais.

## Abordagem recomendada

**Opções consideradas:** A | B | C

- **A — Ancorar o relógio do fixture uma vez no load do módulo:** `const fixtureNowMs =
Date.now()` no topo do spec e `daysAgo = (days) => new Date(fixtureNowMs - days *
DAY_MS).toISOString()`. As duas `daysAgo(40)` produzem timestamps **exatamente iguais** →
  o tie-break por nome é o que o teste realmente exercita, deterministicamente, qualquer
  que seja a carga.
- **B — Data literal fixa** (padrão `suggestionCatalog.unit.spec.ts:364`, ex.
  `new Date('2026-08-18T12:00:00.000Z')`).
- **C — Reescrever o teste para não depender de timestamps iguais** (ex.: assert por ids,
  ou remover o par empatado).

**Recomendação: A** — porque é a mudança mínima (1 linha + âncora), elimina **toda**
dependência de relógio do spec, e segue o precedente local exato
(`tests/unit/prioritiesTool.unit.spec.ts:12` tem `const nowMs = Date.now()` no escopo do
módulo). A âncora no load garante que os timestamps empatados sejam **exatamente** iguais
(ms a ms), o que nenhuma outra opção faz com tanta simplicidade.

**Rejeitadas:**

- **B** porque introduz uma data mágica no fixture sem necessidade; o âncora de load faz o
  mesmo com menos atrito e alinha com o precedente do `prioritiesTool`. (O `suggestionCatalog`
  precisa da data fixa porque injeta `now` na função sob teste — aqui a função sob teste usa
  `new Date()` interno, então a âncora de load é suficiente.)
- **C** porque o teste existe para cobrir o tie-break por nome do contrato B189; reescrevê-lo
  sem o par empatado **remove cobertura** em vez de estabilizá-la.
- **Mexer no código de produção** (`getMunicipalitiesWithoutUpdate.ts`) porque não há bug de
  produção: os timestamps reais vêm do DB (valores fixos) e o sort é determinístico. O bug é
  exclusivamente do fixture do teste.

### Componentes / mudanças

- **`tests/unit/municipalitiesWithoutUpdateTool.unit.spec.ts`**: âncora `const fixtureNowMs =
Date.now()` no escopo do módulo + `daysAgo` derivando dela; comentário curto explicando o
  porquê (a classe de flake é sutil — sem o comentário, um editor pode re-inliner o
  `Date.now()` e reintroduzir o flake). No teste de ordenação, o timestamp empatado é
  **hoisted** (`const stale40 = daysAgo(40)` usado em `Beta` e `Alpha`): a igualdade vira
  estrutural, não probabilística — mesmo uma regressão da âncora não reativa o flake nesse
  par.
- **Migration:** sem migration.
- **Access / Consent:** não se aplica (arquivo de teste).
- **UI:** não se aplica.

### Scan da mesma classe (feito, não escopo)

- `prioritiesTool.unit.spec.ts:12` — já ancorado no load do módulo (seguro).
- `suggestionCatalog.unit.spec.ts:364` — `now` fixo (seguro).
- `campaignComponents.unit.spec.ts:545` — chamada única, sem assunção de igualdade (seguro).
- Nenhum outro spec combina `Date.now()` por chamada + assunção de igualdade entre duas
  chamadas.

## Fases verificáveis

1. **Fixture** — âncora de relógio no spec (1 linha + comentário). Quota: mínima.
2. **Reprodução & estabilidade** — rodar o spec 30×: `for i in $(seq 1 30); pnpm test:unit
-- --reporter=dot municipalitiesWithoutUpdateTool` (todas verdes). Rodar o script
   `/tmp/opencode/ops62-followup-repro.mjs` (não commita) para o registro do mecanismo.
3. **Gates** — `pnpm test:unit` full, `pnpm test:int` (int), `pnpm exec tsc --noEmit`,
   `pnpm lint`, `pnpm format:check`, `pnpm exec knip`, `pnpm check:cycles`.
4. **Changelog da entrega (OPS44)** — `docs/changelog/2026-08-19-ops62-followup.md` +
   `pnpm changelog:build` + `pnpm changelog:check` (guards do CI exigem).

## Rabbit holes / Não escopo (engenharia)

- Investigação de locale/ICU do container — refutada pela reprodução; não seguir.
- Mudança no sort de produção — não há bug lá.
- Instrumentar o CI para capturar a 3ª ocorrência — o mecanismo está provado; a correção
  remove a classe inteira, e a 3ª ocorrência deixa de ser possível por este caminho.
- Ancorar/limpar os outros specs da mesma classe — já verificados seguros.

## Riscos e mitigação

- **A âncora muda a semântica de idade relativa** (timestamps ficam relativos ao load do
  módulo, não à execução): os asserts de limiar usam dias distintos (40/31/30/5 e 20/16/15/14)
  e a execução ocorre sempre **depois** do load → idades só crescem; nenhum assert depende do
  valor exato de `diasSemAtualizacao` (o teste do limiar asserta ids, não idades). Mitigação:
  rodar a suíte full para confirmar.
- **Alguém reverter a âncora no futuro**: mitigado pelo comentário no spec.

## Aceite de engenharia

- [x] Aceite de produto da intenção ainda coberto (teste verde determinístico, contrato B189 intacto)
- [x] Invariantes AGENTS/engineering-standards (test-only; sem migration/access/URL)
- [x] Testes de domínio previstos (spec existente — a própria correção é dele)
- [x] Self-score decision-quality ≥4 (opções com rejeitadas; rabbit holes nomeados; depth
      check: zero código novo, reusa padrão local `prioritiesTool`; appetite P3 respeitado)
