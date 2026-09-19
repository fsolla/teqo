# Post-mortem: `AUTOMERGE_PAT` fine-grained expirado derruba o auto-merge de todos os PRs — rotação concluída com o token do keyring do `gh`

> Template do `/bug-fix`. Preencha com fatos apurados; o que não for apurado fica "não apurado" — nunca invente.

## Registro

| Campo               | Valor                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Data do post-mortem | 2026-09-19                                                                                                                             |
| Severidade          | alta (safety net de auto-merge vermelho em todos os PRs, merges manuais; o `auto-unblock` recebia o mesmo secret e também estava cego) |
| Ambiente            | CI (GitHub Actions)                                                                                                                    |
| Issue(s)            | #1176, #1177, #1184 (duplicatas deste defeito, fechadas por este PR)                                                                   |
| PR do fix           | (este PR)                                                                                                                              |
| Detectado por       | humano (report "o ready-automerge está falhando direto em todo PR") + log (runs do safety net)                                         |

## Timeline

| Momento            | Data/hora            | Evento                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------ | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Início provável    | 2026-08-20T01:31:17Z | Secret `AUTOMERGE_PAT` criado no lote do OPS71 (PAT fine-grained, validade default de ~30d) e nunca rotacionado. O post-mortem irmão (`docs/postmortems/2026-09-18-github-token-401.md`, item 4 da Correção) registrou a rotação como **pendência humana, sem dono, lembrete ou detector**. Expira ~2026-09-18T20:57Z — a mesma janela de invalidação do `GITHUB_TOKEN` local do mesmo lote |
| Último sucesso     | 2026-09-18T20:43:58Z | Run 35393045267 — último arm bem-sucedido do safety net                                                                                                                                                                                                                                                                                                                                     |
| Detecção           | 2026-09-18T21:39:59Z | Primeira falha: run 35397905870 (branch `fix/c193-missed-rename`) → `GitHub GraphQL → 401 … {"message":"Bad credentials"}` no `enablePullRequestAutoMerge`. Daí em diante ~30 falhas consecutivas; **nenhum PR conseguia armar auto-merge** e os merges passaram a ser armados/mesclados à mão com o token do keyring do `gh`                                                               |
| Fix anterior       | 2026-09-19T02:40:26Z | Merge do PR #1175: corrige a ferramentaria local (`~/.bashrc` deriva `GITHUB_TOKEN` de `gh auth token`) e adiciona a dica acionável de 401; a rotação do secret segue pendente e ainda sem tracker                                                                                                                                                                                          |
| Correção           | 2026-09-19T05:55:11Z | Com autorização humana explícita (secrets de repo são "só humano", `docs/AGENT-OPS.md:27`), o agente roda `gh secret set AUTOMERGE_PAT --body "$(env -u GITHUB_TOKEN gh auth token)"`; `gh secret list` confirma `updatedAt 2026-09-19T05:55:11Z`                                                                                                                                           |
| Verificação e2e    | 2026-09-19T05:57:33Z | PR smoke #1201 (branch temporária `smoke/automerge-pat-check`, commit vazio `69b5dc0b`, explicitamente "não mergear"): run 35425307291 loga `PR #1201: armando auto-merge (rebase)` + `auto-merge armado`; `gh pr view 1201 --json autoMergeRequest` → `enabledBy: fsolla`, `mergeMethod: REBASE`; desarmado (`--disable-auto`) e fechado em seguida, branch remota apagada                 |
| Correção mergeada  | (este PR)            | Docs-only (`Closes` para #1176, #1177, #1184)                                                                                                                                                                                                                                                                                                                                               |
| Deploy             | não se aplica        | Sem mudança de aplicação — docs + secret de repositório; nenhum deploy disparado                                                                                                                                                                                                                                                                                                            |
| Verificado em prod | não se aplica        | —                                                                                                                                                                                                                                                                                                                                                                                           |

## O bug

Toda execução de `.github/workflows/agent-pr-ready-automerge.yml` ficava vermelha: ao armar o auto-merge nativo, o `enablePullRequestAutoMerge` voltava `GitHub GraphQL → 401 ... {"message":"Bad credentials"}`. O sintoma era de CI e de frota: ~30 falhas consecutivas desde 2026-09-18T21:39:59Z, nenhum PR conseguia armar auto-merge (o trabalho passou a ser mesclado à mão com o token do keyring do `gh`), e o `auto-unblock.yml` — que entrega o mesmo secret ao agente de desbloqueio destacado — estava quebrado pela mesma causa. O fail-closed não deixou passar merge errado: o dano foi de **automação parada** (arm de todo PR + desbloqueio pós-`verify` vermelho), não de corrupção de dados. Produção não foi tocada.

## Causa-raiz

5-whys:

1. O GitHub GraphQL rejeitava o token com `Bad credentials`.
2. O secret de repositório `AUTOMERGE_PAT` — um PAT fine-grained criado no lote do OPS71 em 2026-08-20T01:31:17Z — **expirou** (~30d default) na janela de ~2026-09-18T20:57Z (entre o último sucesso, 20:43:58Z, e a primeira falha, 21:39:59Z), a mesma janela do `GITHUB_TOKEN` local do mesmo lote.
3. O PAT nunca foi rotacionado; a pendência foi registrada apenas no post-mortem do dia anterior, **sem dono, lembrete ou detector** — documentação não é tracker.
4. A expiração foi silenciosa: nenhuma API expõe o valor nem a data de validade de um secret; o primeiro sinal foi o job vermelho.
5. Nada no repo pode consertar uma credencial morta: o CLI é fail-closed **por desenho** — `automergeArmingToken` em `scripts/lib/github-pr-flow.mjs`, `scripts/github-pr-automerge.mjs:60-65,81` e `.github/workflows/agent-pr-ready-automerge.yml:58-65` proíbem cair para o `GITHUB_TOKEN` nativo, porque um merge como `github-actions[bot]` **não cria workflow runs** para `closed`/`push` (anti-recursão do GitHub — OPS71-FLIP, achado ao vivo no PR #746), matando em silêncio os flips pós-merge e o auto-deploy.

**Evidência:** `gh secret list` (created/updated), runs 35393045267 (último verde) e 35397905870 (primeiro 401), e a cadeia fail-closed citada acima. O bug **não é reproduzível localmente** — um secret de CI só se exerce em CI; a reprodução/verificação foi via smoke PR.

## Correção

(1) **Rotação (ação humana autorizada):** `gh secret set AUTOMERGE_PAT --body "$(env -u GITHUB_TOKEN gh auth token)"` às 2026-09-19T05:55:11Z. O valor agora é o token OAuth **longevo** do keyring do `gh` da conta fsolla (`gho_`): sem os ~30d do fine-grained, revogação manual, escopos mais amplos (`gist`/`read:org`/`repo`/`workflow`). Como o **mesmo** token alimenta o `GITHUB_TOKEN` local, `gh auth status` vermelho passa a ser o indicador antecedente dos dois.

(2) **Contrato documentado:** `docs/AGENT-OPS.md` (tabela de secrets + nota de `GITHUB_TOKEN` local) agora prescreve a derivação `gh secret set AUTOMERGE_PAT --body "$(gh auth token)"`, aponta o indicador antecedente e traz a receita de verificação pós-rotação (PR smoke com commit vazio deve armar com `enabledBy: fsolla`; depois desarme com `gh pr merge <n> --disable-auto` e feche). É doc de classe 6, **declarado como doc — não guard**.

(3) **Duplicatas:** #1176, #1177 e #1184 foram abertas pelo `pnpm agent:file-miss`, que não tem dedup; este PR as fecha. A falta de dedup é defeito separado, fora do escopo, candidato a Issue futura.

A correção resolve a causa (credencial morta) e não o sintoma: nenhuma mudança de código poderia restaurar um secret expirado, e o fail-closed existente impediu o fallback perigoso.

## Verificação

- Teste de regressão: o fail-closed de `automergeArmingToken` já está pinado em `tests/unit/githubPrFlow.unit.spec.ts:106-121` — **nenhum pin novo cobriria uma credencial externa**; a prova deste fix é o e2e em CI (smoke PR)
- E2E (prova): smoke PR #1201 — na primeira tentativa o PR foi fechado ~4s após abrir e o run 35425279111 logou `skip (pr-nao-aberta)`; reaberto, o run 35425307291 logou `PR #1201: armando auto-merge (rebase)` + `auto-merge armado`, com `autoMergeRequest.enabledBy: fsolla`, `mergeMethod: REBASE`, `enabledAt 2026-09-19T05:57:33Z`; desarmado e fechado (estado final `autoMergeRequest: null`, `CLOSED`) e branch remota deletada. **Não conta como prova** o rerun do run antigo 35420433819 no PR #1199: aquele PR já havia sido armado/mesclado à mão e o rerun logou `skip (ja-mergeada)`
- Suíte: docs-only — `a confirmar` (o orquestrador roda format/gates)
- CI: a confirmar no PR (este PR)
- Prod: não se aplica (docs + secret de repo; sem deploy de aplicação)

## Prevenção

| Estratégia                                                                                                                                                                                                                                                           | Custo  | Estado                                                                                                                    |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------- |
| Contrato de secrets em `docs/AGENT-OPS.md`: derivar `AUTOMERGE_PAT` do token OAuth do keyring (`gh secret set … "$(gh auth token)"`), indicador antecedente (`gh auth status`) e receita de verificação pós-rotação (smoke PR → `enabledBy: fsolla` → desarme/close) | barata | implementada agora (este PR) — doc (classe 6), declarada como doc, não guard                                              |
| GitHub App installation token lifecycle no caminho de arm (tira o PAT de usuário) + alerta de expiração de credenciais                                                                                                                                               | cara   | documentada — não implementada neste fluxo (candidata a Issue futura; só volta a valer se credenciais voltarem a expirar) |

**Estratégia implementada:** o contrato de derivação/verificação do secret em `AGENT-OPS.md`; a falha do próprio job em todo PR **é o canário** (fail-closed já pinado por unit test), então **nenhum guard novo se justifica** — um canário agendado perdeu valor com o token longevo. Documentado como candidato apenas se as credenciais voltarem a expirar.

**Estratégia documentada (cara):** GitHub App installation token com alerta de expiração — remove o PAT de usuário do caminho de arm; não implementada neste fluxo.

**Fora de escopo (defeito separado):** `pnpm agent:file-miss` sem dedup criou 3 Issues duplicadas (#1176/#1177/#1184) — candidata a Issue futura.

## Lições

Registrar uma pendência num post-mortem **não é rastreá-la**: a rotação do `AUTOMERGE_PAT` ficou documentada e mesmo assim morreu sem dono, lembrete ou detector — o lembrete precisa virar trabalho rastreado (Issue/calendário), não prosa. O fail-closed fez o certo (nunca caiu para o `GITHUB_TOKEN` nativo, que mataria os flips e o auto-deploy em silêncio — OPS71-FLIP), mas converteu uma credencial morta em ~30 runs vermelhos antes de alguém notar que era _sempre o mesmo_ 401. Trocar fine-grained por um token OAuth do keyring elimina a classe de expiração desse secret, porém **concentra o risco**: o mesmo `gho_` alimenta o `GITHUB_TOKEN` local, então `gh logout`/revogação derruba os dois, e os escopos amplos (`gist`/`read:org`/`repo`/`workflow`) agora residem num secret de CI. E ferramenta sem dedup (`agent:file-miss`) fabrica Issues duplicadas exatamente quando o fluxo está degradado — o oposto do que o tracker precisa. Trilha de evidências: post-mortem irmão `docs/postmortems/2026-09-18-github-token-401.md` (item 4), runs 35393045267/35397905870/35425279111/35425307291, PR smoke #1201, diff de `docs/AGENT-OPS.md` neste PR.
