# OPS113 — Agentes `designer` e `designer-degraded`: design hi-fi como fonte de verdade

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1056
Priority: P2
Impeccable: A — N/A sem UI de produto
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; um outcome verificável
Responsável: —

## Intenção

O gate do plan-issue produz hoje um _rascunho_ visual que, por doutrina, é proibido de ter brand, tokens e polish — e é descartável. A decisão visual em alta fidelidade não existe em lugar nenhum: ela é reinventada na implementação, sem referência para o humano aprovar antes e sem alvo estável para portar e criticar depois. O fim é previsível: a tela construída diverge do que foi aprovado e a crítica vira opinião.

Este item cria o papel de **designer** — especialista de julgamento visual que **cria** o design hi-fi de referência e **critica** a implementação contra o design aprovado — e eleva o artefato `docs/plans/<slug>-ui-design.html` a **fonte de verdade do port**: o implementador porta classe-a-classe para React/Next. Em paralelo, um **designer degradado** cobre quota/indisponibilidade do modelo frontier sem pular design em silêncio — mas **nunca certifica**.

Não é o retorno do `design-vision` (removido na OPS105): não é um describer de imagem, é design de criação/crítica com visão nativa. E não é entrega de UI de produto: nenhuma tela muda aqui.

## Persona e fluxo

- **Persona / contexto:** fsolla no gate, abrindo o `.html` no browser para aprovar o design antes de qualquer código; agente implementador (`work-issue`/`agent-work-issue`) portando para React/Next.
- **Job principal:** ver e aprovar o design final hi-fi antes da implementação e, depois, portar e verificar paridade sem perder fidelidade.
- **Fluxo desejado:**
  1. Item com UI entra no plan-issue; o designer cria o artefato hi-fi (tokens reais, brand, copy pt-BR real).
  2. Humano abre o `.html`, itera com o designer e aprova; o artefato entra no PR do plano.
  3. Na implementação, o executor porta classe-a-classe do artefato.
  4. O designer critica a implementação contra o design aprovado; mudança material volta ao humano no PR.
  5. Se o frontier falhar, o ladder desce explicitamente e registra o tier; tier degradado marca `DEGRADED` e não certifica.
- **Anti-goals de produto:** não muda UI de produto; não é implementação disfarçada; não é um segundo Figma/Penpot nem substitui o MCP `penpot`; não ressuscita o describer de imagem da OPS105; o designer nunca escreve em `src/`; tier degradado nunca certifica; sem OpenRouter/Grok/Qwen no caminho de design.

## Objetivo e aceite

- `designer` existe e é invocável (`mode: all`, `temperature: 0.7`, `model: openai/gpt-5.6-sol`) com os dois modos de tarefa — **Criar** hi-fi e **Criticar** implementação — e sem permissão de escrita em `src/`.
- `designer-degraded` existe e é invocável (`mode: subagent`, `model: opencode-go/deepseek-v4.1-flash`): cria/estende/critica, marca todo output `DEGRADED` e exige sign-off humano.
- A doutrina viva é `ui-design-html.md` (renomeada de `ui-draft-html.md`) e trata o artefato como fonte de verdade do port; tokens/brand/shadcn passam a ser esperados; o teto protetivo permanece.
- O ladder `gpt-5.6-sol → gpt-6-astra → deepseek-v4.1-flash (DEGRADED) → deepseek-flash (DEGRADED, inline)` está documentado e auditável: quota/indisponível desce explicitamente e registra o tier no PR — nunca pula design em silêncio.
- Pré-requisito operacional verificado **antes** de pinar: provider `openai` religado, auth feito, ids confirmados em `opencode models | grep '^openai/'` e visão funcionando no caminho OAuth.
- Artefato imutável como registro histórico no git; mutável durante o work-issue pelo designer, com mudança material voltando ao humano no PR.

## Dados (intenção)

- **Vou apresentar dados?** Não — autoria de agente e doutrina de design; sem métrica ou superfície de dados.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A.

## Dados da decisão (literais)

- **N/A — sem dados de produto.** Os literais fixados nesta entrega são de configuração de agente/doutrina e estão verbatim em "Escopo e entregáveis" (modelos, modos, temperatura, caminhos e nomes) — não são decisão de dados.

## Escopo e entregáveis (literais)

- **Doutrina — rename + reescrita:** `.agents/skills/plan-issue/ui-draft-html.md` → `.agents/skills/plan-issue/ui-design-html.md`. Eleva: tokens reais/brand/shadcn OK e esperados; o HTML é fonte de verdade do port (não mais descartável). Mantém: zero JS de comportamento; estados como cenas estáticas; 390/1280; copy pt-BR real; sem imports de `src/`; sem decisão de engenharia; claims só os aprovados no plano; `NEEDS ASSET`; LGPD/TSE; um CTA primário.
- **Artefato:** `docs/plans/<slug>-ui-design.html` (autossuficiente, Tailwind v4 browser CDN) + `docs/plans/<slug>-ui-design-assets/*.svg` quando ícones/ilustrações próprios forem necessários.
- **SVG:** lucide/shadcn primeiro; custom só quando não houver equivalente; grid 24px, `currentColor`, stroke no padrão lucide; salvar em `-ui-design-assets/`.
- **`designer`:** `.opencode/agent/designer.md` — `mode: all`, `temperature: 0.7`, `model: openai/gpt-5.6-sol`; visão nativa, com parada fail-closed se o modelo não enxergar (nunca descrever o que não viu).
- **`designer-degraded`:** `.opencode/agent/designer-degraded.md` — `mode: subagent`, `model: opencode-go/deepseek-v4.1-flash`; nunca certifica.
- **Ladder:** `openai/gpt-5.6-sol` → `openai/gpt-6-astra` (mesmo pool Plus; crítica contestada/pixel-critical) → `opencode-go/deepseek-v4.1-flash` (flat; `DEGRADED`) → `deepseek/deepseek-flash` (direto; `DEGRADED`; o orquestrador faz inline).
- **Pré-requisito operacional (fora do repo):** remover `openai` de `disabled_providers` no config global, `opencode auth login openai`, confirmar os ids expostos **antes** de pinar e confirmar imagem/visão no caminho OAuth. **Verificado em 2026-09-15:** provider religado + OAuth conectado; `openai/gpt-5.6-sol` e `openai/gpt-6-astra` expostos (15 ids no total); smoke de visão OK (PNG sólido lido corretamente pelo Sol).
- **Doc operacional (opcional, 1 parágrafo):** `docs/AGENT-OPS.md` — autoria/pin/fallback de agente, apontando para a doutrina.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/plan-issue/` (doutrina), `.opencode/agent/` (novos agentes), `docs/plans/` (artefatos), `docs/AGENT-OPS.md` (opcional).
- **Precedente a olhar:** `.opencode/agent/designer-campanha-solla.md` (frontmatter `mode`/`temperature` e bloco de visão nativa/fail-closed, L63–65); OPS105 (o que não ressuscitar); OPS101 (proibição de `model:` vale para `.opencode/commands/`, não para agentes).
- **Risco de acoplamento:** OPS114 consome o nome novo da doutrina e OPS115 os triggers no work-issue; nenhum teste/guard lê `.opencode/agent/*.md` hoje — o pin é contrato de prompt, não de teste.

## Dependências

- Nenhuma dura. **OPS114** (atualiza consumidores do nome antigo) vem depois deste rename; **OPS115** (triggers no work-issue) consome o contrato daqui — ambos fora de escopo.

## Fora de escopo

- Atualizar consumidores de `ui-draft-html.md` (template, `SKILL.md`, outras skills) → OPS114.
- Triggers/não-triggers de quando o designer entra no work-issue → OPS115.
- Arquivo de escalada `designer-astra` → pergunta aberta.
- Qualquer mudança em UI de produto ou `src/`, mudança no MCP `penpot`, e guard/teste novo lendo `.opencode/agent/*.md`.

## Rabbit holes de produto

- **"Já que existe designer, redesenha o produto inteiro."** Se alguém "só completar": novo shell, paleta global, telas fora do item. **Corte neste item:** um artefato por item de UI, do escopo do item.
- **"Deixa o designer editar `src/` e já entregar a tela."** Se alguém "só completar": o artefato vira implementação e o gate perde a função. **Corte neste item:** output só em `docs/plans/<slug>-ui-design.*`.
- **"Cria `designer-astra.md` por simetria."** Se alguém "só completar": prompt gêmeo, drift garantido. **Corte neste item:** pergunta aberta abaixo, com recomendação de não criar arquivo extra.

## Questões em aberto (produto)

- **`designer-astra` (`openai/gpt-6-astra`): arquivo extra ou só troca via `/models`?** **Opções:** A) arquivo `.opencode/agent/designer-astra.md` gêmeo | B) um só `designer.md`, com troca de modelo via `/models` quando a crítica for contestada/pixel-critical | C) partial compartilhado + dois arquivos. **Recomendação:** B — evita twin/drift (`AGENTS.md`: "Edit the owner, don't twin") e o tier fica registrado no PR; reavaliar com evidência só se precisar de frontmatter distinto. _(assumido — validar no gate)_
- **Documentar autoria/pin/fallback de agente em `docs/AGENT-OPS.md`?** **Opções:** A) sim, 1 parágrafo curto linkando a doutrina | B) deixar só na doutrina | C) item futuro. **Recomendação:** A — o doc é o ponto de entrada da operação de agentes; sem isso o ladder fica enterrado na skill. _(assumido)_

## Fases (ordem de entrega)

1. **F1 — Doutrina:** rename + reescrita de `ui-design-html.md` (contrato elevado, teto mantido, regras de SVG e o ladder). Consumidores do nome antigo ficam para OPS114.
2. **F2 — Agentes:** criar `designer` e `designer-degraded` com frontmatter pinado, modos Criar/Criticar, proibição de escrita em `src/`, rótulo `DEGRADED` e sign-off humano.
3. **F3 — Operacional e verificação:** pré-requisito (provider/auth/ids/visão), smoke dos dois agentes, formatação e o parágrafo opcional em `docs/AGENT-OPS.md`.

## Verificação

- `opencode models | grep '^openai/'` lista `openai/gpt-5.6-sol` (e o id de escalada, se exposto) antes do pin; `opencode-go/deepseek-v4.1-flash` já é o modelo em uso. Se o id fixado não existir: **parar e escalar o humano** — não pinar adivinhação nem trocar de modelo em silêncio.
- Os dois agentes carregam na sessão; o `designer` cria um artefato de exemplo e o diff só toca `docs/plans/` (nada em `src/`).
- O `designer-degraded` rotula `DEGRADED` no output e recusa certificar sem sign-off.
- Busca pelo nome antigo (`ui-draft-html`) não encontra referências nos arquivos desta entrega; consumidores restantes são dívida declarada do OPS114.
- `pnpm exec prettier --check` nos arquivos tocados (`.opencode/` não está no `.prettierignore`); o artefato de exemplo abre no browser via Tailwind CDN.

## Riscos

- **Pinar id não exposto pelo OAuth.** O `openai` está hoje em `disabled_providers`; pinar antes da verificação quebra o agente em silêncio. **Mitigação:** pré-requisito primeiro; fail-closed e escalada se o id não existir.
- **Certificação degradada por atalho.** PR que trata `DEGRADED` como design aprovado. **Mitigação:** rótulo obrigatório + sign-off humano + tier registrado no PR.
- **Teto protetivo relaxado demais.** Com brand/tokens permitidos, o artefato tenta virar implementação (JS, estado, decisões). **Mitigação:** a doutrina mantém o teto explícito e a proibição de `src/`.
- **Drift entre os dois prompts.** `designer` e `designer-degraded` duplicam regras e divergem. **Mitigação:** doutrina como fonte única; prompts apontam para ela, não a copiam.
- **Referências quebradas ao nome antigo entre F1 e OPS114.** Dívida declarada; este item não edita consumidores (template, `SKILL.md`, etc.).

## Referências

- GitHub Issue #OPS113 (a registrar; placeholder)
- `.agents/skills/plan-issue/ui-draft-html.md` — doutrina atual, a renomear; `intention-template.md`/`SKILL.md` — consumidores (OPS114)
- `.opencode/agent/designer-campanha-solla.md` — precedente de frontmatter e visão nativa/fail-closed (L63–65)
- `docs/changelog/2026-09-14-ops105.md` — `design-vision` removido; não ressuscitar
- `tests/unit/opencodeCommands.unit.spec.ts` (41–44) — proibição de `model:` em comandos não cobre agentes
- `~/.config/opencode/opencode.jsonc` — config global (fora do repo); hoje `openai` em `disabled_providers`
- `docs/AGENT-OPS.md`; `AGENTS.md` ("Edit the owner, don't twin")
