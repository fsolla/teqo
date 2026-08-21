---
name: plan-issue
description: 'Turn human ideas into tracked GitHub Issues with intention plans and UI drafts.'
disable-model-invocation: true
---

# Planejar Issues (intenção, não engenharia)

Transforma ideias soltas em: (1) um **plano de intenção** em `docs/plans/<slug>.md` por item, e (2) uma **Issue rastreável no GitHub** (`pnpm agent:register`, frontmatter `id/depends/serializes/priority/model`).

## Ciclo de vida

```text
parse (main agent)
  → exploration sub-agent (findings per idea)
  → plan-writing sub-agents (parallel, 1 per idea)
  → GATE (main agent) + confirmação explícita
  → register sub-agent → PR → merge → promote
```

**Regras duras:**

1. **Nada no Forgejo antes do gate.** Antes da confirmação: proibido `pnpm agent:register`, criar Issue/PR.
2. **Register com `--plan` nasce `blocked`.** Promote só depois do plano em `main`.
3. **Planos de Issues `in-progress`/`done`/`in-prod` são imutáveis.**
4. **Rascunho UI (obrigatório se muda UI):** HTML+Tailwind commitado no repo. Classe A/sem UI → sem rascunho.

## Decomposição em sub-agentes

Cada fase pesada é delegada a um sub-agente com contexto mínimo. O agente principal orquestra.

### Sub-agente: Explorador

**Quando:** Passo 3, para cada batch de ideias.
**Input:** lista de ideias parseadas + `AGENTS.md` (core) + `codebase-map.mdc`
**Task:** Para cada ideia, encontrar: arquivos relevantes existentes, sobreposição com trabalho entregue, área provável no codebase. **Não escrever planos nem tomar decisões.**
**Output:** ≤15 linhas por ideia (achados concisos).

### Sub-agente: Escritor de plano

**Quando:** Passo 3, paralelo (1 sub-agente por ideia).
**Input:** UMA ideia + achados do explorador + `intention-template.md` + `shaping.md` (+ `ui-draft-html.md` se UI)
**Task:** Escrever `docs/plans/<slug>.md` conforme o template. **Não registrar Issues nem criar arquivos — só produzir o conteúdo do plano.**
**Output:** conteúdo markdown do plano.

### Sub-agente: Registrador

**Quando:** Passo 5, após confirmação do gate.
**Input:** planos aprovados + IDs reservados
**Task:** Rodar `pnpm agent:register` para cada plano. Atualizar headers `Issue: #N`. Criar PR `Related #N`.
**Output:** Issues registradas + links de PR.

## Checklist

```
- [ ] 1. Parse do lote + dedup + carregar camada AGENTS
- [ ] 2. Reserva de IDs
- [ ] 3. Dispatch sub-agente explorador → receber findings
- [ ] 4. Dispatch sub-agentes escritores (paralelo) → receber planos
- [ ] 5. GATE: overview + rascunho UI (se muda UI) → confirmar
- [ ] 6. Dispatch sub-agente registrador → PR → merge → promote
```

## Passo 1 — Parse e dedup

1. **Separe os itens.** Entrada pode ser 1 ideia ou N. Se ambíguo, assuma a leitura mais provável.
2. **Carregar camada AGENTS relevante:** se qualquer item toca `/campanha`, leia `AGENTS-campaign.md`. Se toca site público, leia `AGENTS-public.md`. Se toca deploy/CI, leia `AGENTS-infra.md`.
3. **Fatia mínima útil.** Prefira várias Issues pequenas a um epic.
4. **Dedup intra-lote:** mesclar | absorver | manter separados com `depends`.
5. **Dedup contra o existente:** `pnpm issue all` + `issuesById()` + grep em `docs/plans/*.md`.
   - Já coberto / entregue → apontar e não criar.
   - Issue `in-progress`/`done`/`in-prod`: não editar — item sucessor se mudou.
   - Issue `blocked`/`ready` (não claimada): pode editar o plano existente.

## Passo 2 — Reserva de IDs

Último ID por trilha (A/B/C/D/E) via roadmap legacy + `issuesById()`. Distribua antes de escrever planos.

## Passo 3 — Explorar + escrever planos (sub-agentes)

### 3a. Dispatch sub-agente explorador

Monte o task prompt do explorador com:
- Lista das ideias parseadas (título + 1-linha de intenção)
- Referência: `AGENTS.md` (core) + `codebase-map.mdc`
- Instrução: "Para cada ideia, encontre arquivos relevantes, sobreposição com trabalho entregue, área provável. ≤15 linhas por ideia. Não escreva planos."

Aguarde o output. Valide que é conciso e factual.

### 3b. Classificar e reservar IDs

Para cada ideia, classifique (feature/chore/bloqueio/não-fazer) e atribua ID.

### 3c. Dispatch sub-agentes escritores (paralelo)

Para cada ideia, monte o task prompt do escritor com:
- **Uma** ideia (título + intenção completa + tipo + ID)
- Achados do explorador para essa ideia
- Templates: `intention-template.md`, `shaping.md`
- Se UI: `ui-draft-html.md`
- Se dados: `data-presentation.md`
- Instrução: "Escreva `docs/plans/<slug>.md` conforme o template. Output: conteúdo markdown."

Dispatche todos os escritores em paralelo (Task tool). Cada um retorna o conteúdo do plano.

### 3d. Self-score e revisão

O agente principal:
1. Valida cada plano contra `shaping.md` (self-score ≥4)
2. Aplica melhorias se necessário
3. Cria os arquivos `docs/plans/<slug>.md` no disco
4. Se UI: cria `docs/plans/<slug>-ui-draft.html` (sub-agente ou inline)

## Passo 4 — GATE

Antes de criar Issues:

- Overview: ID, título, prio, depends, appetite, link do plano
- Para cada item UI: aponte o link do `.html` fonte
- Perguntas acumuladas, recomendação de produto primeiro

**Pare e espere.** Itere até confirmação explícita do lote.

## Passo 5 — Registro (sub-agente registrador)

Após confirmação, dispatche o sub-agente registrador com:
- Lista de planos aprovados + IDs
- Instrução: rodar `pnpm agent:register` para cada um, criar PR `Related #N`, aguardar merge, rodar `pnpm agent:ready`

O agente principal validação o resultado e reporta o resumo.

## Resumo final

Tabela do lote + mesclados/absorvidos/descartados + Issues `#N` + PRs de plano.
