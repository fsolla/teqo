# OPS86 — Blast radius dos testes: PRs quebram testes que não rodaram no CI do PR

Status: rascunho
Atualizado em: 2026-08-24
Issue: #832
Priority: P1
Impeccable: A — N/A sem UI
Rascunho UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

Os PRs estão quebrando testes que o CI do PR não executou — e os PRs que mais quebram são exatamente os que hoje rodam menos. Um diff que mexe em coleção, global, migração ou regra de acesso muda o RBAC e a superfície inteira do produto, mas a política atual (OPS72) manda esse tipo de diff para o modo "verificação máxima" — que, por custo, significa **zero e2e no PR**. O teste de verdade só acontece depois do merge, no deploy. Além disso, o CI tem um mapa de qual código cobre qual teste e2e, mas pedaços críticos (regras de acesso, schemas de formulário, push, transcrição de áudio) estão fora desse mapa — o CI nem sabe que o diff tocou área sensível e não roda nada. E no nível unit/int, o modo "rodar só o que mudou" pode selecionar zero testes e mesmo assim ficar verde. O outcome desejado: **nenhum PR de código passa no CI sem executar exatamente os testes que o diff pode quebrar** — e2e e unit/int —, com falha visível (e lista de specs) quando a cobertura não existe.

## Persona e fluxo

- **Persona / contexto:** quem abre PR no repositório (humano ou agente) e usa o CI como resposta à pergunta "esse diff está seguro para mergear?"; e o verify do deploy, que hoje é a única rede de segurança para os PRs de maior risco.
- **Job principal:** saber, antes do merge, se o diff quebrou algo — sem rodar a suíte inteira a cada PR.
- **Fluxo desejado:** abre-se um PR com diff de alto risco (coleções, migrações, RBAC, schemas) → o CI roda um conjunto **curado e representativo** de testes e2e (acesso/RBAC + smoke da superfície afetada) mais os unit/int que o diff pode tocar → verde ou vermelho com a lista exata de specs. Se o diff tocar código sem mapeamento declarado, o CI não fica verde em silêncio: cai num fallback explícito (roda a superfície, sinaliza a lacuna) ou falha pedindo mapeamento. Se a seleção de unit/int por dependência vier vazia, o CI roda o conjunto de fallback — nunca "0 testes, tudo verde".
- **Anti-goals de produto:** não voltar a rodar e2e full por PR (o custo volta a travar o fluxo); não piorar o custo médio do job; não quebrar o invólucro "dono do PR, dono do CI" — a rede de segurança do verify no deploy permanece como está; não transformar o mapeamento em um catálogo de tudo (manutenção infinita sem ganho).

## Objetivo e aceite

- PR com diff de alto risco (coleções/globals/migrações/acesso) executa no CI um conjunto curado de e2e representativo — nunca zero — e o resultado aparece no check do PR.
- Nenhum módulo de risco (regras de acesso, schemas, autenticação/push, IA) fica fora do mapa: diff nesses arquivos nunca cai em "nenhum e2e" sem explicação.
- O modo "só o que mudou" dos testes unit/int nunca roda 0 testes em silêncio: seleção vazia dispara fallback explícito, e CI não fica verde com zero execuções.
- Código tocado sem cobertura declarada não passa com aviso de log: ou roda o fallback, ou falha apontando a lacuna (fail-closed para área de risco).
- Guardrails: PR nunca roda e2e full (a suíte completa segue só no verify do deploy); custo médio do job não sobe em relação ao hoje; classificador e mapa só mudam com o teste de invariante existente verde.

## Dados (intenção)

- **Vou apresentar dados?** Não — este item é sobre verificação, não sobre métricas; o sucesso é observável no comportamento do CI, não num painel.
- **Decisões desbloqueadas:** nenhuma de negócio. (Se a Direção quiser acompanhar lacunas de cobertura ao longo do tempo, isso é outro item — com decisão de consumo nomeada.)

## Direção no codebase (hipótese)

- **Áreas prováveis:** o classificador de blast radius (`scripts/lib/test-affected-core.mjs` — high-risk→`full`), a porta de e2e no workflow do PR (`.github/workflows/ci-pr.yml`, gated em `selected`), o mapa de e2e (`scripts/e2e-affected.*` + manifest), a classificação de escopo (`scripts/ci-scope.mjs`, hoje só loga lacunas), e o gate de testes (`scripts/gate-ci.mjs`, `--changed` + `--passWithNoTests`).
- **Precedente a olhar:** OPS72 (política full→zero e2e no PR), OPS83 (o que já foi feito em seleção de testes), e o teste de invariante do classificador (`ciSkipInvariants.unit.spec.ts`) como o pin de que mudanças no próprio mecanismo são verificadas.
- **Risco de acoplamento:** o executor deve mexer no mecanismo **sem** mexer no contrato de deploy (verify full no homeserver) e sem relaxar os guards de banco local. Módulos fora do mapa hoje incluem, como hipótese: `src/utilities/campaignAccess.ts` + `src/utilities/access/*`, `src/lib/schemas/*`, `src/utilities/campaignPushClient.ts`, `src/utilities/ai/*`, `src/lib/formData.ts`, `src/components/ui/*`.

## Dependências

- Nenhuma dura. OPS72 e OPS83 já entregues (base onde o item se apoia, mas nada em voo).

## Fora de escopo

- Migração de testes unit para int/HTTP (OPS87 — separado).
- Setup compartilhado de banco no CI (OPS88 — separado).
- Reduzir tempo de build/e2e (apenas manter o custo médio atual).
- Qualquer mudança no verify do deploy ou no fluxo pós-merge.

## Rabbit holes de produto

- **"Mapear tudo".** Se alguém "só completar", o mapa vira um catálogo de 400 linhas com manutenção infinita. **Corte neste item:** mapear só o que o classificador já trata como risco e hoje cai em zero/não-mapeado; o resto usa o fallback explícito.
- **"Fallback = rodar tudo".** Vira e2e full de fato, matando o custo. **Corte neste item:** fallback é conjunto curado + unit/int full quando necessário — unit/int full é barato, e2e full nunca.
- **"Só melhorar o log".** Continua verde com 0 testes rodados. **Corte neste item:** toda lacuna de cobertura em área de risco termina em fallback executado ou falha; aviso solto não conta.

## Questões em aberto (produto)

- **Seleção vazia no modo "só o que mudou": o fallback deve rodar unit/int full ou apenas a superfície?** **Opções:** A) unit/int full sempre que a seleção vier vazia; B) conjunto da superfície do diff; C) falhar pedindo mapeamento. **Recomendação:** A — unit/int full é barato e cobre com honestidade máxima; o conjunto curado fica para o e2e. _(assumido — validar com produto)_
- **O conjunto curado de e2e para diff de alto risco: fixo e estável ou derivado por heurística de nomes?** **Opções:** A) curadoria explícita e estável (acesso/RBAC + smoke por superfície), revisável como o mapa atual; B) heurística automática por convenção de nomes. **Recomendação:** A — previsível e idempotente; heurística de nomes vira outro rabbit hole de manutenção.
- **Código de risco sem mapeamento: falhar o PR ou rodar fallback e sinalizar?** **Opções:** A) fail-closed (falha apontando a lacuna) para path de risco; B) fallback + sinalização, mapeamento vira dívida; C) manter só o log. **Recomendação:** A para paths que o classificador já trata como risco — o custo de um falso positivo é rastrear uma linha no mapa; o custo de falso negativo é o bug que este item existe para evitar. _(assumido — validar com produto)_

## Referências

- OPS72 — política atual: modo `full` → PR sem e2e (`.github/workflows/ci-pr.yml`, comentário no passo "E2E tests (blast radius…)").
- OPS83 — seleção de testes unit/int (precedente recente de `changed`).
- Arquivos para o executor abrir primeiro (pistas, não contrato): `scripts/lib/test-affected-core.mjs`, `scripts/ci-scope.mjs`, `scripts/gate-ci.mjs`, `scripts/e2e-affected.*`, `.github/workflows/ci-pr.yml`, `tests/unit/ciSkipInvariants.unit.spec.ts`.
- `AGENTS.md` — convenção "dono do PR, dono do CI" e guardrails de banco/testes (tocadas por este item).
