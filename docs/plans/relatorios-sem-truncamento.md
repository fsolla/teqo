# Relatórios e dossiês sem truncamento mecânico — reformular para caber ou ampliar o campo

Status: rascunho
Atualizado em: 2026-09-17
Issue: #1136
Priority: P2
Impeccable: B — encaixe nas superfícies já desenhadas (relatório C163, dossiê/boletim C186); sem redesenho
Design UI: N/A — superfície inalterada; alvo é o hi-fi já aprovado do C186 (e o do C163)
Appetite: ~1–2 dias eng; um outcome verificável — gerar relatório/dossiê com texto longo e não ver nenhum "…", nenhum item sumido sem aviso, com o integral preservado no aprofundamento e a guarda de fit verde
Responsável: —

## Intenção

Ao gerar um relatório de cidade (C163) ou um dossiê/boletim (C186), informação se perde na última milha: ou o texto é **cortado mecanicamente no meio da frase com "…"** (C163, via `excerpt()`), ou **itens inteiros somem em silêncio** (C186, listas com `slice` e sem contador). Não é falta de espaço editorial — é o orçamento da superfície aplicado como corte cego. Regra do produto: **se uma informação não cabe, o texto deve ser reformulado para caber perdendo o mínimo de informação, ou o campo/orçamento deve ser ampliado** — nunca corte mecânico no meio, nunca item sumindo sem aviso. O pesquisador levanta o dado; o artefato não pode descartá-lo.

## Persona e fluxo

- **Persona / contexto:** o gabinete/assessoria prepara material pré-viagem; o researcher (humano ou skill) entrega respostas longas e ricas; o builder compõe a página 1/resumo (C163), o dossiê e o boletim (C186).
- **Job principal:** ao abrir o PDF, ler a informação completa e confiável — e, se algo não coube no resumo, **saber que existe e onde achá-lo**, nunca descobrir depois que um trecho foi cortado no meio.
- **Fluxo desejado:** researcher entrega o integral (`answer`/`details`) + um `summary` curto, completo e auto-contido quando a superfície de resumo exigir → o builder usa `summary`; sem ele, prefere `answer` e **amplia o campo/orçamento enquanto a guarda de fit permitir** → se ainda não couber, a linha aponta o aprofundamento **sem reticências** → toda lista truncada exibe contador ("e mais N"/"Mostrando X de Y") → o integral segue no aprofundamento → a guarda de fit mede `scrollHeight` e **aborta** se estourar.
- **Anti-goals de produto:** corte mecânico com "…" em superfície de resumo; item sumindo em silêncio; espremer o layout para caber (a guarda continua fail-closed); redesenhar as superfícies; o builder reescrever conteúdo editorial (quem redige o `summary` é o researcher); varrer todo `slice` do repo além da família C163/C186.

### Esboço de fluxo (B)

```text
pesquisa (answer/details integral)
        ├── summary? ──sim──> superfície de resumo (pg1/cartões)
        └── não ─> prefere answer ─┤
                                   ▼
                    cabe no orçamento? ──sim──> renderiza
                                   └── não ─> amplia orçamento (guarda permite?) ──> renderiza
                                                                     └── não ─> linha aponta o aprofundamento SEM "…"

integral sempre preservado no aprofundamento (seção Fontes / páginas extras)
listas: slice → SEMPRE com contador "e mais N" / "Mostrando X de Y"
guarda de fit: scrollHeight > orçamento (+tolerância) → ABORTA (fail-closed)
```

### Design UI (B)

- Design UI: **N/A** — as superfícies têm design aprovado (relatório C163; dossiê e boletim C186). Este item não redesenha: ajusta **conteúdo/orçamento** dentro do hi-fi existente, sem componente/estado/layout novo. Se a execução exigir mudança material de layout, o `designer` entra e a mudança volta ao humano no PR.

## Objetivo e aceite

- Gerar relatório/dossiê/boletim com textos longos e **não ver nenhum "…"** em superfície de resumo.
- **Nenhuma lista truncada sem contador** de itens restantes.
- Texto **integral sempre disponível** no aprofundamento.
- **Guarda de fit verde** (fail-closed preservado; nunca espremer).
- Contrato `summary` documentado nos dois arquivos de pesquisa e instruído nas skills `relatorio-cidade` e `dossie-solla-cidade`.
- Guardrails de produto: sem fonte não publica; empenho ≠ pagamento; esfera/abrangência nunca somadas; PII mínima; artefato gitignored; defeso.

## Dados (intenção)

- **Vou apresentar dados?** Sim, superfície neste item — o item decide como o dado já pesquisado é **renderizado** (orçamento de texto e contadores), nas superfícies impressas C163/C186.
- **Decisões desbloqueadas:** o leitor decide **com base no texto completo** (não num fragmento cortado); o gabinete sabe **o que ficou de fora** do resumo (contador) e **onde** está o integral; o researcher sabe **para qual orçamento** redigir o `summary`.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: proibido "…" na superfície de resumo; contador em toda lista truncada; integral no aprofundamento; guarda de fit fail-closed; sem redesenho.

## Dados da decisão (literais)

**Corte mecânico com "…" — dono único no C163.** `excerpt()` em `scripts/lib/cityReportBlocks.mjs:91-94` (`slice(0,max).trimEnd()+'…'`). Caps: `PAGE_ONE_ANSWER_MAX=90`, `PAGE_ONE_WHO_MAX=26`, `PAGE_ONE_RISK_MAX=70`, `PAGE_ONE_NAMES_MAX=20`, `PAGE_ONE_INDICATOR_DETAIL_MAX=70` (`:64-79`); `SIGNAL_EXCERPT_MAX=180`, `SPEECH_SUMMARY_MAX=220`, `SPEECH_MENTION_MAX=220` (`:53-55`). Call-sites impressos na página 1: `:154-161`→`:232,236,255,288,292,310,350,382`; `joinLimited` `:100-105`→`:198,248,322`; `excerpt(indicator.purpose, 70)` `:368`. Integral preservado em `buildResearchAnswersTable` `:1362-1383`.

**Descarte silencioso no C186.** `limit = list.slice(0,max)` `scripts/lib/dossieBlocks.mjs:96` (sem flag de resto) em `:181-186` (`MAX_ERA_NUMBERS=12`), `:190` (`MAX_ERA_ACTIONS=4`), `:202-224` (`MAX_DELIVERIES_PAGE_ONE=3`), `:226-233` (`MAX_HOOKS_PAGE_ONE=2`), `:241-244` (`MAX_PENDING_PAGE_ONE=4`), `:247-255` (`MAX_REGION_ITEMS=4`); único com contador: `:333/:338` (`MAX_SCOPE_LIST=5`, guarda `.total`). Boletim: `scripts/lib/dossieBulletin.mjs:44` (6) + `:51` (14) = teto 20, sem contador (`dossieBulletinRender.mjs:171-175`).

**Corte silencioso de caractere sem "…":** `scripts/lib/dossieCamara.mjs:46` `(sumario ?? transcricao).slice(0,280)`, `ITEMS_PER_LIST=20` `:16,128`; `cityReportBlocks.mjs:870` `row.body.slice(0,180)`; `:1113` `row.summary.slice(0,220)`; `:1097` `mentionExcerpt.slice(0,220)`.

**Guarda de fit (não corta — aborta):** C163 `build-city-report.mjs:155-165` (`PAGE_ONE_BUDGET_PX`, −8px; aprofundamento não é medido); C186 dossiê `build-dossie-solla-cidade.mjs:196-227` e boletim `:241-249` (+10px). `.sheet { height:297mm; overflow:hidden }` (`dossieRender.mjs:477-488`, `dossieBulletinRender.mjs:31-43`).

**Contrato do resumo (nova regra, literal):** cada item de pesquisa passa a aceitar **`summary`** — curto, **completo e auto-contido**, redigido para caber no orçamento da superfície de resumo. Superfícies de resumo usam `summary`; aprofundamento continua com o integral (`answer`/`details`). Sem `summary`, prefere `answer` e **amplia o orçamento** enquanto a guarda permitir — **"…" proibido**; no limite, a linha aponta o aprofundamento sem reticências. **Nenhum item some em silêncio** (contador sempre). Guarda de fit **fail-closed**.

**Contratos hoje:** `cityReportResearch.mjs:129-138,186` e `dossieResearch.mjs:211-224,263` aceitam `answer`/`details`; `news[].summary` é validado e **nunca renderizado**; não há `summary` em `items[]`.

**Testes a atualizar:** `tests/unit/cityReportBlocks.unit.spec.ts:702,752,780`; `tests/unit/cityReportRender.unit.spec.ts:127,166`; `tests/unit/dossieBlocks.unit.spec.ts:155`; `tests/unit/dossieBulletin.unit.spec.ts:27,60`.

## Direção no codebase (hipótese)

- **Dono único** de orçamento/composição de texto substitui o `excerpt()` do C163, reusado por C163 + C186 (não gemar caminho paralelo).
- Contrato `summary` nos dois arquivos de pesquisa (`cityReportResearch.mjs`, `dossieResearch.mjs`).
- Renderers C163/C186 preferem `summary`; integral permanece no aprofundamento.
- Contadores "e mais N"/"Mostrando X de Y" em todas as listas hoje silenciosas (dossiê/boletim; `dossieCamara.mjs`).
- Testes unit dos caps revisados e do novo contrato; skills `relatorio-cidade` e `dossie-solla-cidade` instruem o researcher a redigir `summary`.

## Dependências

- **Soft com C187** (dossiê por instituição) — o novo item deve nascer sem truncamento; este item conserta o dono que o C187 reusa. Sem bloqueio.
- **Nenhuma dura.**

## Fora de escopo

- Redesenhar as superfícies (o design aprovado do C186/C163 permanece).
- Persistir dado novo, schema ou migration; alterar contratos públicos/URL.
- Mudar o conteúdo editorial além do que cabe — o `summary` é redigido pelo researcher.
- `build-solla-ceuci-salvador-report.mjs` (C157): só se for trivial e no mesmo dono; senão, item sucessor.

## Rabbit holes de produto

- **"Fazer caber" reescrevendo no builder.** Se alguém "só completar": o builder vira redator. **Corte neste item:** o builder não redige; sem `summary`, aponta o aprofundamento.
- **Um `summary` global em vez de por item.** **Corte neste item:** `summary` por item, auto-contido por superfície.
- **Ampliação de orçamento vira licença para a página crescer.** **Corte neste item:** a guarda de fit fail-closed é o teto.
- **Varrer todo `slice` silencioso do repo.** **Corte neste item:** só a família C163/C186 (C157 como sucessor, se não for trivial).
- **Confundir "e mais N" (lista) com "…" (frase).** **Corte neste item:** são dois defeitos distintos, com remediações distintas — tratar ambos, sem trocar um pelo outro.

## Questões em aberto (produto)

- **Campo `summary` vs só ampliar orçamento?** **Opções:** A) `summary` por item + ampliação como fallback | B) só ampliar orçamento. **Recomendação:** A — resolve na origem e dá ao researcher controle editorial. _(assumido — validar)_
- **"…" sempre proibido ou só no aprofundamento?** **Opções:** A) proibir nas superfícies de resumo, manter no aprofundamento | B) proibir em tudo. **Recomendação:** A — o aprofundamento já carrega o integral. _(assumido)_
- **Cobrir C157 agora ou sucessor?** **Opções:** A) incluir | B) sucessor. **Recomendação:** B — C157 não compartilha o dono reusado por C163/C186. _(assumido)_
- **Prioridade P1 vs P2?** **Opções:** A) P1 (perda de informação visível) | B) P2. **Recomendação:** B — reavaliar para P1 se o C187 entrar em produção imediatamente. _(assumido)_

## Referências

- GitHub Issue #<N> (após `pnpm agent:register`)
- `scripts/lib/cityReportBlocks.mjs:53-55,64-79,91-94,100-105,154-161,163-177,359-378,870,1097,1113,1362-1383`
- `scripts/lib/cityReportRender.mjs:243-244,470,531,631,872,901,1185`; `scripts/lib/cityReportResearch.mjs:129-138,186`
- `scripts/lib/dossieBlocks.mjs:96,181-186,190,202-233,241-255,333,338`; `scripts/lib/dossieBulletin.mjs:44,47-48,51`; `scripts/lib/dossieBulletinRender.mjs:171-175`
- `scripts/lib/dossieCamara.mjs:16,46,128`; `scripts/lib/dossieRender.mjs:477-488`; `scripts/lib/dossieResearch.mjs:211-224,263`
- `scripts/build-city-report.mjs:155-165`; `scripts/build-dossie-solla-cidade.mjs:196-227,241-249`
- Testes: `tests/unit/cityReportBlocks.unit.spec.ts:702,752,780`; `tests/unit/cityReportRender.unit.spec.ts:127,166`; `tests/unit/dossieBlocks.unit.spec.ts:155`; `tests/unit/dossieBulletin.unit.spec.ts:27,60`
- Skills: `.agents/skills/relatorio-cidade/SKILL.md`, `.agents/skills/dossie-solla-cidade/SKILL.md`; `AGENTS.md` (edite o dono, não gema um irmão)
