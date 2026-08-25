---
name: testing-audit
description: Auditoria autônoma noturna da suíte de testes do Teqo — retrato honesto (contagens, tempos, duplicatas por camada), melhorias seguras aplicadas com prova verde antes/depois e revert fail-closed, entregues num único PR ready SEM auto-merge armado cuja descrição é o relatório final.
---

# Skill: testing-audit

Auditoria autônoma da suíte de testes com implementação das melhorias seguras. Disparo humano à noite (`/testing-audit`); pela manhã existe UM relatório que explica toda a noite e um PR ready revisável em pedaços lógicos.

## Contrato de entrega (inviolável)

- **Um único PR ready** (não draft) contra `main`, **CI green**, **mergeable** (sem conflitos; se houver conflito com `main`, NÃO rebasar depois do desarme — registrar no topo do relatório que rebasar é passo humano).
- **SEM auto-merge armado.** Esta skill NÃO herda o contrato auto-merge de `engineering-audit`. O safety-net do repo (`agent-pr-ready-automerge.yml`) arma automerge em TODO PR ready contra main e REARMA a cada push — o desarme é sempre o ÚLTIMO passo da noite (ver Fase 5).
- A **descrição do PR é o relatório final**; o mesmo relatório vive como artefato commitado em `docs/testing-audits/<YYYY-MM-DD>.md` (ou condensado com ponteiro para o artefato).
- Fixes em commits separados quando possível (preferência, não requisito duro).

## Intocáveis absolutos

Nunca remover nem enfraquecer autonomamente:
1. Testes de consentimento/LGPD fail-closed (`Consent`, chave estável, falha fechada).
2. Access control/RBAC (`src/utilities/access/*`).
3. Lockdown de liderança (`leader`; `estimatedVotes` nunca visível à liderança).

Duplicata aparente envolvendo intocável vira proposta no relatório, sempre.

Intocáveis estruturais (nenhum diff toca): `scripts/ci-scope.mjs`, `scripts/lib/e2e-affected-manifest.mjs`, `.github/workflows/`, `.husky/`, gates e a política de seleção e2e (OPS72/OPS86). Zero edições em arquivos `tests/e2e/`.

## Fases (teto total da noite ~6h)

0. **Baseline** — validar DB do worktree (`teqo_wt<slot>_test`) e registrar contagens/durações verdes de `pnpm test:unit` + `pnpm test:int`.
1. **Inventário paralelo** — 3 leitores Task read-only por camada (unit/int/e2e estático), ≤45min.
2. **Rubrica** — disposições por candidato (mover/reforçar/remover/manter/proposta) ≤30min; auditoria TERMINA aqui antes de implementar.
3. **Loop de melhorias** — ≤6 passos, ≤30min cada, prova verde antes/depois por passo, 1 commit por passo.
4. **Fecho** — relatório + changelog + push único + PR ready + CI green.
5. **Desarme do auto-merge** — SEMPRE o último passo da noite.

*(As fases 0–5 são detalhadas nas seções abaixo; este arquivo é autossuficiente para executar a noite inteira sem contexto externo.)*

<!-- FASES-DETALHE: placeholder do tracer — protocolo completo entra na fase 3 do impl plan OPS96 -->
