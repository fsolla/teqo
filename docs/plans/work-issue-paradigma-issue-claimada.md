# Work-issue no paradigma de Issue já claimada (+ model-selection volta ao cardápio Cursor)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #594
Priority: P2
Model: composer-2.5
Impeccable: A — N/A (skills de agente, sem superfície de produto)
Canvas UI: N/A — sem UI
Appetite: ~1–1,5 dia; um outcome verificável (sessão /work-issue sem nenhum passo de verificação)
Responsável: —

## Intenção

Todo `/work-issue` hoje re-executa passos que o contexto já garante: **claim** (é um script determinístico — o próprio fluxo vai rodá-lo antes, no `worktree next`), **verificação de worktree/branch** (a sessão nasce no worktree certo) e **verificação de modelo** (a sessão é sempre DeepSeek V4 Flash na máquina do humano). Isso gasta requests/tokens toda sessão e ainda permitiu o agente-miss #582 (branch criada no main em vez da worktree). No novo paradigma, a skill assume o contrato: Issue já claimada, worktree correto, branch correta, modelo fixo — e vai direto ao trabalho. Desacopla de `agent-work-issue` (que segue sendo a skill dos workers do Cursor Cloud/pool, com suas próprias regras) e simplifica `model-selection`: sem alternativas locais (`model-local`), só o cardápio Cursor como era antes.

## Persona e fluxo

- **Persona / contexto:** o humano na sua máquina, sessão opencode no worktree da Issue (aberta pelo `worktree next` — OPS33). Sessão sempre DeepSeek V4 Flash.
- **Job principal:** sair do plano de intenção ao PR com gate humano no impl plan — sem overhead de verificação.
- **Fluxo desejado:**
  1. `worktree next` claima e abre o opencode com `/work-issue` já informando a Issue;
  2. a skill identifica a Issue pelo contexto da sessão (prompt/marcador do ambiente) e abre o plano de intenção — **sem** rodar `agent:claim`;
  3. Plan mode → `*-impl.md` → **pausa** → confirmação humana → execução → `/simplify` → `capture-review-debts` com gate → PR.
- **Anti-goals:** não virar um guarda-costas que re-verifica o que o ambiente garante; não duplicar a lógica de claim do pool; não inventar um terceiro fluxo de execução (continua havendo: humano = work-issue, pool = agent-work-issue).

## Objetivo e aceite

- `/work-issue` **não** roda `pnpm agent:claim`, não verifica worktree/branch e não checa modelo — assume os três do contexto (se a sessão estiver em outro modelo, segue; o fluxo é da máquina do humano, sempre Flash).
- A skill recupera o contexto da Issue **deterministicamente**: número/ID vindo do prompt da sessão (OPS33) — se ausente, **uma** pergunta ao humano com validação, nunca um claim por conta própria.
- O path do plano de intenção é recuperado do **body da Issue** (`Plano: [\`docs/plans/…\`]`— o`agent:register --plan`já grava; sem plano linkado, o body é a spec — mesmo contrato do prompt do pool). Nenhuma mudança no`plan-issue` é necessária para registrar o path: ele já registra.
- Work-issue deixa de ser "a versão humana de agent-work-issue": fluxo próprio (impl plan → pausa → execução → simplify → débitos → PR), reutilizando só os materiais de engenharia (engineering-brief, implementation-template, decision-quality) como referência.
- `model-selection` perde a tabela Local/Zed, o frontmatter `model-local:` e o mapeamento canônico `model:` → DeepSeek: volta ao cardápio só-Cursor (Composer 2.5 default; Grok com effort; Kimi K3 Low só exec bipartida). Issues declaram `model:` único.
- Textos correlatos ajustados (passo de modelo em `agent-work-issue` e no claim brief ficam compatíveis com o cardápio novo; `plan-issue` segue sugerindo um slug único).
- Resolve o agente-miss #582: o paradigma novo elimina a situação (a skill não cria branch nem claima — a entrega fecha #582).

## Dados (intenção)

- **Vou apresentar dados?** Não — sem superfície de dados.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/work-issue/SKILL.md` (reescrever: remove claim/modelo/verificações, contexto por parâmetro), `.agents/skills/agent-work-issue/SKILL.md` (referência a "base de work-issue" e passo de modelo), `.agents/skills/model-selection/SKILL.md` (remover ambiente local/`model-local`), `.agents/skills/plan-issue/SKILL.md` (Passo 4 — slug único, sem alternativa local), `scripts/agent-claim.mjs` (brief: texto de modelo sem `model-local`), `AGENTS.md` / `docs/CHANGELOG-AGENTS.md`.
- **Precedente a olhar:** `scripts/lib/agent-pool-prompt.mjs` — o pool já resolveu "como avisar o agente da Issue claimada" (`buildPoolWorkerPrompt` + `extractPlanPath`): é o molde do contexto que a skill vai consumir.
- **Risco de acoplamento:** o pool e o `plan-issue` dependem de `model-selection` — remover `model-local` não pode quebrar o spawn do pool (ele usa só `model:`). Work-issue parado (sem OPS33) fica com o claim fora da skill: chamada manual pede o número, não claima.

## Dependências

- Nenhuma (é a fundação do paradigma; OPS33 depende dela).
- OPS32 é pré-requisito para o ponta a ponta do OPS33 (work-issue aceitar Issue já claimada).

## Fora de escopo

- O claim no `worktree next` (OPS33 — fluxo separado).
- Mudar o comportamento do pool (claim coordenado, prompt de worker, spawn) — continua intacto.
- Mecânica fina de como o prompt do launch entrega o número da Issue (OPS33 define; aqui é só consumir o que vier).

## Rabbit holes de produto

- **"Já que é tudo novo, reescrever a skill inteira com novo paradigma de gates"** (ex.: pausas extras, revisão de cada passo). A única mudança pedida é remover verificação/claim/modelo e ajustar a recuperação de contexto — o restante do fluxo (impl plan → pausa → execução → simplify → débitos → PR) já é o que o humano aprova.
- **"Aproveitar para resolver a fila de agent-miss"** (#582 entra porque é o mesmo defeito; os demais agent-miss da fila são independentes). **Corte:** só o #582, por causalidade direta.

## Questões em aberto (produto)

- **Como o agente descobre a Issue quando o prompt não trouxe o número?** **Decisão (gate 2026-08-10):** pergunta ao humano e valida — chamada manual é exceção e 1 round resolve; claim fora da skill preserva o contrato "quem claima é o script".
- **`model:` deve sumir do claim brief/work-issue?** **Decisão (gate 2026-08-10):** fica como metadata consultiva — o pool ainda spawna por `model:` e a linha do claim é consulta barata; só a exigência de `model-local` sai.

## Referências

- GitHub Issue #594
- Canvas UI (gate): N/A
- `scripts/lib/agent-pool-prompt.mjs` (precedente do contexto claimado + `extractPlanPath`)
- `docs/plans/opencode-comandos-work-issue-e-plan-issue.md` (OPS25 — origem dos comandos)
- Issue #582 (agente-miss absorvido)
