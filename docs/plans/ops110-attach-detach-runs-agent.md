# OPS110 — Acompanhar runs longos de agente por attach/detach, sem manter terminal aberto

Status: rascunho
Atualizado em: 2026-09-15
Issue: #1019
Priority: P2
Impeccable: A — N/A (ferramenta/ops; sem UI de produto)
Rascunho UI: N/A — sem UI
Appetite: ~1–2 dias eng
Responsável: —

## Intenção

Hoje cada run de agente exige presença: o opencode roda no terminal do workstation e, se o TUI fechar (ou a sessão SSH cair), o run para. O fsolla quer largar um `/work-issue` ou `/plan-issue` longo no workstation e ir embora — almoço, reunião, fim de expediente — acompanhando do laptop ou do celular, entrando e saindo da sessão quantas vezes quiser enquanto o agente trabalha.

Não é um pedido de "rodar agentes em background" solto: é o mesmo run de hoje, com o ciclo de vida desacoplado do terminal que o observa. O que os agentes fazem não muda; muda como o humano os acompanha. O painel de Issues (OPS109) também quer abrir a sessão do run daquela Issue — para isso este item precisa deixar a sessão **endereçável**, não só persistente.

## Persona e fluxo

- **Persona / contexto:** fsolla no workstation, com worktrees de agente ativos; longe dele, no laptop ou celular, por SSH ou rede confiável. Não quer vigiar em tempo real — quer poder espiar, sair e voltar.
- **Job principal:** iniciar um run longo, desconectar, e (re)entrar na sessão de outro dispositivo quando quiser, sem interromper o agente.
- **Fluxo desejado:**
  1. Dispara o run do jeito que já dispara hoje (worktree + skill, ex. `/work-issue`).
  2. Fecha o terminal do workstation ou perde o SSH; o agente continua trabalhando.
  3. Do laptop ou celular, entra na sessão existente e vê o histórico/estado do agente; acompanha ou digita se quiser.
  4. Sai de novo — quantas vezes quiser — sem matar o run.
  5. Quando decidir encerrar, encerra de forma explícita, nunca por acidente ao fechar o cliente.
- **Anti-goals de produto:**
  - Não vira pool/supervisor de agentes (o pool morreu na OPS65; não ressuscitar).
  - Não automatiza produção nem cria caminho que burle gates humanos (PR/CI/approval).
  - Não cria um segundo jeito de iniciar sessão que ignore o worktree/claim vigente.
  - Não exige terminal aberto no workstation nem processo pendurado em SSH.
  - Não abre porta pública na internet.

## Objetivo e aceite

- O run continua trabalhando quando nenhum cliente está olhando (nenhum terminal/SSH aberto no workstation).
- (Re)entrar na sessão de outro dispositivo retoma exatamente onde estava — mesma sessão, mesmo worktree, mesmo histórico.
- Sair do cliente nunca é o mesmo que encerrar o run; encerrar é ato explícito.
- Nada novo escutando além do loopback sem credencial: se alguma superfície passar de `127.0.0.1`, exige autenticação e só em rede confiável (SSH/tailnet) — fail-closed sem credencial.
- O worktree/branch em que o agente roda continua sendo o contrato de ambiente; não há nova forma de claim nem de sessão órfã.
- A sessão de um run é endereçável a partir da Issue/worktree (dá para saber como chegar nela sem adivinhar) — pré-requisito do "abrir a sessão do agente" do painel OPS109.

## Dados (intenção)

- **Vou apresentar dados?** Não.
- **Decisões desbloqueadas:** N/A.
- **Forma:** N/A — `Dados: N/A` — ferramenta/ops de operação de agentes; sem métrica, gráfico ou dado eleitoral/de contato envolvido.

## Dados da decisão (literais)

- Se algo escutar além do loopback, a credencial é a do próprio opencode por ambiente: `OPENCODE_SERVER_PASSWORD` (e `OPENCODE_SERVER_USERNAME`); valores reais vivem fora do repo (workstation), nunca commitados — sem credencial, a superfície responde 401.
- "Loopback" aqui é `127.0.0.1`, o default atual do modo servidor do opencode 1.18.31.
- Os nomes acima são o contrato disponível hoje; porta, host de bind, paths de log/socket e nome de serviço são hipóteses do plano de implementação, não de contrato de produto.
- O painel OPS109 consome este endereçamento (abrir a sessão da Issue); o artefato/mecanismo concreto de descoberta é decisão do plano de implementação — sem mapa paralelo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/lib/worktree.mjs` (diretiva `launch`, ~207–233) e `.agents/shell/worktree.sh` (~104–112, executa o launch); documentação em `docs/AGENT-OPS.md` e `AGENTS.md`.
- **Duas direções citáveis, sem escolha aqui:** (a) servidor nativo persistente do opencode (`opencode serve`, dono da sessão) com cliente `opencode attach <url>` de qualquer dispositivo (replay/`--continue`); ou (b) multiplexador de terminal mantendo o TUI vivo entre anexações. A forma é decisão do plano de implementação; o aceite de produto é o mesmo.
- **Precedente a olhar:** OPS106 `scripts/auto-unblock.mjs` (spawn destacado + log + flock) mostra o padrão local de processo que sobrevive ao invocador, embora não seja sessão interativa; OPS40 `scripts/dev.mjs` mostra wrapper de CLI passando flags.
- **Risco de acoplamento:** o launch atual nasce da shell function e depende do `cd`/worktree — qualquer modo destacado precisa preservar worktree/branch e não duplicar a porta de entrada; o painel OPS109 consome o mesmo endereçamento (sem mapa paralelo). Expor bind além do loopback é o risco nº 1: a workstation não tem IP tailnet documentado (só o homeserver) e o repo não tem precedente de acesso remoto a ela.

## Dependências

- Nenhuma dura. Depende de capacidades já presentes no opencode instalado (servidor + attach). O OPS109 (painel) depende deste item para abrir a sessão da Issue — o endereçamento da sessão é aceite daqui.

## Fora de escopo

- Multi-usuário ou servir agentes para terceiros.
- Web UI como produto — se útil na implementação, é meio, não aceite.
- Notificações/push de progresso, painel de frota de runs, métricas de agentes.
- Mudanças no fluxo de claim/worktree ou nos gates de PR/deploy.

## Rabbit holes de produto

- **"Já que tem servidor, vira painel de frota".** Se alguém "só completar": status de todos os runs, iniciar/parar agentes, retomar por lista. **Corte neste item:** uma sessão, um worktree, attach/detach — nada de orquestração.
- **"Expõe na tailnet e pronto".** Se alguém "só completar": bind aberto sem auth "porque a rede é confiável". **Corte neste item:** qualquer superfície além do loopback exige credencial, fail-closed.
- **"Persistência própria de sessão".** Se alguém "só completar": banco/daemon próprio guardando estado do run. **Corte neste item:** usar o que o opencode já persiste; nada de um segundo dono da sessão.

## Questões em aberto (produto)

- **Servidor nativo vs multiplexador?** **Opções:** A servidor persistente + `attach` | B multiplexador de terminal mantendo o TUI | C os dois. **Recomendação:** deixa ao impl plan decidir; produto só exige o mesmo aceite (run sobrevive sem cliente, reattach exato, encerramento explícito, auth fora do loopback). _(assumido — validar com produto)_
- **De onde se acompanha no celular?** **Opções:** A SSH/TUI no terminal do celular | B navegador (web UI) | C só laptop por enquanto. **Recomendação:** A — reaproveita a superfície TUI já validada; B adiciona escopo de UI que o aceite não exige.

## Referências

- GitHub Issue #1019
- `scripts/lib/worktree.mjs` (diretiva `launch`) e `.agents/shell/worktree.sh` (execução do launch) — de onde o run nasce hoje
- `scripts/auto-unblock.mjs` — precedente OPS106 de processo local destacado
- `docs/AGENT-OPS.md` — operação de agentes paralelos; `AGENTS.md` — convenções do repo
- `docs/ops/teqo-1313-deploy.md` — topologia de rede (homeserver × workstation)
- opencode 1.18.31 instalado: `opencode serve`, `opencode attach`, `opencode run --attach` e `opencode web` (help local)
