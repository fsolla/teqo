# Post-mortem: escopo do espelho Google Calendar por título deixa linha alheia vazar e bloqueia o verify do deploy

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-13                                                                               |
| Severidade          | alta (bloqueou o deploy de produção; sem outage — produção permaneceu no build anterior) |
| Ambiente            | CI (verify do deploy manual)                                                             |
| Issue(s)            | sem Issue (fluxo `/bug-fix`; precedente: post-mortem B196 de 2026-09-12)                 |
| PR do fix           | a preencher no merge                                                                     |
| Detectado por       | teste (job `verify` do `deploy.yml`, passo "Integration tests (full suite)")             |

## Timeline

| Momento            | Data/hora               | Evento                                                                                                                                                                                                                                                                                                                                                                |
| ------------------ | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-08-11              | commit `c69990a3` ("fix(C126): isola o escopo do espelho Google nos int specs (fim do flake paralelo)") introduz o escopo/limpeza por título `{ title: { like: 'C114%' } }` em `tests/int/googleCalendarSync.int.spec.ts`; a colisão com UUID alheio é rara, então o defeito fica latente                                                                             |
| Detecção           | 2026-09-13 14:46:31 UTC | run de deploy 34763253924 (main `7ca708a3`), job `verify`, passo "Integration tests (full suite)": 1 failed \| 82 passed — `tests/int/googleCalendarSync.int.spec.ts` > "a cancelled event in Google cancels the confirmado activity, then the trash is cleaned" falha nas DUAS tentativas (`retry: 1`); os jobs `deploy-staging` e `deploy-production` ficam skipped |
| Correção mergeada  | pendente                | PR do fix a preencher no merge                                                                                                                                                                                                                                                                                                                                        |
| Deploy             | pendente                | dispatch manual do `deploy.yml` pelo humano após o merge (nenhum merge publica sozinho)                                                                                                                                                                                                                                                                               |
| Verificado em prod | pendente                | confirmação do humano após o deploy                                                                                                                                                                                                                                                                                                                                   |

## O bug

O deploy manual de 2026-09-13 não chegou a produção: o job `verify` falhou na suíte int e os jobs de deploy (`deploy-staging`/`deploy-production`) foram skipped — o código de main (`7ca708a3`) não foi publicado nesse dispatch, e produção permaneceu no build anterior (sem outage; nenhum usuário afetado). A falha foi o teste `tests/int/googleCalendarSync.int.spec.ts` > "a cancelled event in Google cancels the confirmado activity, then the trash is cleaned", reprovado nas duas tentativas do `retry: 1` do vitest: na 1ª, `AssertionError: expected 2 to be 1` na asserção de `cleanup.deleted` (o passe de limpeza apagou 2 eventos em vez de 1); na 2ª, o `store` ainda continha 1 evento (`{ id: 'teqo11' }`). No mesmo arquivo, os testes "creates the full mirror…" e "failures land in paused…" passaram com `(retry x1)` — a contaminação era intermitente e o retry a mascarava. **Sintoma — não a causa.**

## Causa-raiz

O escopo e a limpeza do spec usavam marcador de título (`{ title: { like: 'C114%' } }`, commit `c69990a3`, 2026-08-11), tratando o texto como ownership. No Payload 3.82 + `@payloadcms/drizzle`, porém, `like` compila para `ILIKE '%<word>%'` por palavra (split por espaço) e `contains` para `ILIKE '%<value>%'` — ambos CONTAINS, nunca prefixo (origem: `node_modules/@payloadcms/drizzle/dist/queries/parseParams.js:183-184` e `sanitizeQueryValue.js:202-212`). Um UUID de fixture de outro spec embutindo o hex `c114` (case-insensitive) entrou no espelho e podia ser DELETADO pela limpeza `afterEach` do próprio spec. A suíte int roda arquivos em paralelo contra um banco compartilhado e se isola por texto compartilhado.

5-whys:

1. **Por que o teste falhou?** As contagens exatas do espelho incluíram uma linha alheia.
2. **Por que a linha alheia entrou no escopo?** O escopo/limpeza usava marcador de título e `like`/`contains` do Payload são CONTAINS match (`ILIKE '%…%'`, sem ancoragem) — um UUID de fixture de outro spec que embutia o hex `c114` casou com o marcador e entrou no espelho (e na mira da limpeza).
3. **Por que o escopo era textual?** O spec tratou marcador de título como ownership em vez de rastrear os ids que criou; nada pinava essa suposição.
4. **Por que o defeito ficou latente desde 2026-08-11?** A colisão é rara (~29 posições hex por UUID; ~4% por arquivo/run) e o `retry: 1` (`vitest.config.mts`) redesenhava os UUIDs no retry, mascarando a contaminação intermitente.
5. **Por que virou bloqueio de release agora?** A classe é sistêmica: arquivos int paralelos compartilham um banco e se isolam por texto compartilhado; a C153 adicionou 2 arquivos int (speechCatalog/speechImport) com novos runIDs, cruzando a probabilidade, e o verify do deploy roda a suíte int completa a cada commit — qualquer colisão vira bloqueio de publicação.

**Evidência:** o teste de regressão novo falha sem o fix (`expected 2 to be 1`) e passa com; o pin de convenção falha com o padrão antigo (`title: { like: 'C114%' }`); a falha de CI veio nas duas tentativas com manifestações distintas (contagem e `store` residual), e os testes irmãos só passaram no `(retry x1)`.

## Correção

Sem migration e sem mudança em código de produção — o defeito era do isolamento do spec, não do motor de sync:

- `tests/int/googleCalendarSync.int.spec.ts`: `ownedActivityIds: Set<number>` (`:103`) rastreia as linhas criadas; `createActivity(..., { track: false })` (`:128-148`) cria deliberadamente linhas alheias fora do escopo; o `afterEach` (`:105-120`) deleta por `id: { in: [...] }` em vez de título; `runSync` (`:168-178`) usa `activityWhere: { id: { in: [...ownedActivityIds] } }`; o comentário de convenção do header foi atualizado (marcador textual não é ownership) e um teste de regressão novo — "a foreign title CONTAINING c114 stays out of the scope (id-scoped mirror)" (`:250`) — pina o cenário exato do bug.
- `tests/unit/codebaseConventions.unit.spec.ts`: novo describe "int fixture scoping avoids hex title markers" (`:771`), que varre `tests/int` e bane `title: { like|contains: '<hex-only 3+>' }`.

Resolve a causa: o escopo e a limpeza passam a ser ownership por id (à prova de colisão de UUID), e a suposição antiga ("marcador de título isola") deixa de ser aceita sem falhar um teste.

## Verificação

- Teste de regressão: `tests/int/googleCalendarSync.int.spec.ts:250` "a foreign title CONTAINING c114 stays out of the scope (id-scoped mirror)" — falha sem o fix (`expected 2 to be 1`) e passa com
- Suíte: verificador independente rodou a suíte int completa `VITEST_MAX_WORKERS=4 pnpm test:int` = 83 files / 744 tests verdes (antes: 83 files / 743 tests, 1 failed no CI) e os 6 specs da família Google (47 tests) verdes; `pnpm gate:fast` verde; o pin de convenções falha com o padrão antigo
- CI: pendente — PR do fix a preencher no merge
- Prod: pendente — dispatch manual do `deploy.yml` pelo humano após o merge; confirmação do humano pendente

## Prevenção

| Estratégia                                                                                                      | Custo  | Estado                                                               |
| --------------------------------------------------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| Escopo e limpeza do spec Google por ids das linhas criadas (`ownedActivityIds`) + teste de regressão            | barata | implementada agora (PR do fix — a preencher no merge)                |
| Pin de convenção em `tests/unit/codebaseConventions.unit.spec.ts` banindo marcador de título hex em `tests/int` | barata | implementada agora (PR do fix — a preencher no merge)                |
| Convenção documentada no header do spec (marcador textual não é ownership)                                      | barata | implementada agora (PR do fix — a preencher no merge)                |
| Isolamento de banco/schema por arquivo ou suíte int serial (infra de teste nova)                                | cara   | documentada — não implementada neste fluxo; candidata a Issue futura |
| Operador de prefixo no Payload ou remoção do `retry: 1` (mudança de contrato/framework)                         | cara   | documentada — não implementada neste fluxo; candidata a Issue futura |

**Estratégia implementada:** ownership por id no spec (escopo do espelho e limpeza), teste de regressão do cenário "título alheio contendo o marcador", pin de convenção que bane marcador de título hex em `tests/int` e a convenção documentada no header — a suposição errada passa a falhar na autoria, não no verify do deploy.

**Estratégia documentada (cara):** isolamento de banco/schema por arquivo ou suíte int serial (infra de teste nova) e operador de prefixo no Payload ou remoção do `retry: 1` (mudança de contrato/framework). Candidatas a Issue futura — não implementadas neste fluxo.

## Lições

- **Marcador textual não é ownership:** casar por texto compartilhado num banco compartilhado é isolamento frágil; rastrear os ids que o próprio spec criou é à prova de colisão.
- **`like`/`contains` do Payload são contains-match:** o `%` no padrão não ancora nada — `like: 'C114%'` vira `ILIKE '%C114%'`. Quem lê `like` esperando prefixo se engana.
- **`retry: 1` mascara flakes de isolamento:** a segunda tentativa redesenhava os UUIDs e escondia a contaminação; o verde com `(retry x1)` era sinal precoce, não ruído.
- **Comentário de convenção que documenta o mecanismo errado reforça a falsa confiança:** o header do spec declarava o isolamento por título como garantia — o comentário precisou ser corrigido junto com o código.
