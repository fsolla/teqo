# C218 — Skill catalogo-falas-web: atualização incremental do catálogo

Status: rascunho
Atualizado em: 2026-09-23
Issue: #1294
Priority: P2
Impeccable: A — N/A (skill/docs, sem UI)
Design UI: N/A — sem UI
Appetite: ~1–2 dias eng; um outcome verificável — rodar a skill atualiza o catálogo desde a última execução bem-sucedida e devolve o recibo, sem duplicar
Responsável: —

## Intenção

O catálogo de falas já tem como ingerir mídia (C215), mas alguém precisa descobrir o que apareceu novo na internet desde a última rodada — e hoje isso é trabalho manual, sem registro de onde parou. Esta skill transforma a atualização numa operação repetível: lê a data da última execução, faz a descoberta web do que surgiu desde então, monta o lote de achados e chama a esteira de ingestão do C215, devolvendo um recibo curto. É a resposta à ideia do dono (2026-09-23): "atualizar essa sessão fazendo um novo scraping a partir da data que foi feito o último".

Sem isso, cada atualização recomeça do zero (ou do que a memória de quem opera lembrar) e o catálogo envelhece entre entregas da comunicação.

## Persona e fluxo

- **Persona / contexto:** agente/coordenação técnica (não a assessoria); roda na workstation/worktree, como as skills de conteúdo dos dossiês.
- **Job principal:** dar um comando e ter o catálogo atualizado desde a última execução, sabendo o que entrou, o que foi ignorado e o que falhou.
- **Fluxo desejado:** `/catalogo-falas-web` → a skill lê a data da última execução (primeira rodada: varredura inicial completa) → descobre o que apareceu desde então → cura falsos positivos → entrega o lote à ingestão (C215) → imprime o recibo (período, achados, novos, ignorados, falhas, custo/tempo).
- **Anti-goals de produto:** não é serviço de monitoramento; não é tela (sem UI); não decide faceta manualmente (transcrição/classificação é do C215); não promete cobertura exaustiva da web.

## Objetivo e aceite

- Rodar a skill atualiza o catálogo desde a última execução bem-sucedida e devolve o recibo curto — sem duplicar e sem reprocessar o que já está no catálogo.
- Primeira execução (sem data anterior) faz a varredura inicial completa do que for encontrado; as seguintes são incrementais.
- Achado duvidoso (ex.: falso positivo de "fala do Solla") fica marcado como "revisar" e não é ingerido até confirmação.
- A skill reporta o que encontrou **e o que ficou de fora**; falha de um achado não derruba o lote (sucesso parcial com motivo no recibo).
- **Guardrails:** a decisão sobre descoberta/download é a do C215 (instrução do dono sobre direitos, confirmada no gate) — a skill segue o mecanismo que o C215 definir, sem inventar um caminho paralelo; nenhuma segunda esteira de transcrição/classificação; estado da última execução é o único estado novo que este item cria.

## Dados (intenção)

- **Vou apresentar dados?** Não — o recibo (período, contagens, falhas, custo/tempo) é insumo operacional de quem roda a skill, não superfície de usuário.
- **Decisões desbloqueadas:** N/A — a decisão é operacional: quando a comunicação precisa do acervo atualizado, quem opera roda a skill.
- **Forma:** N/A.

## Dados da decisão (literais)

- **Ideia do dono (verbatim, 2026-09-23):** "Crie uma skill que permita atualizar essa sessão fazendo um novo scraping a partir da data que foi feito o último [scraping]."
- Nome da skill: `catalogo-falas-web`; wrapper de comando: `/catalogo-falas-web`.
- Recorte temporal: **desde a data da última execução bem-sucedida**; sem data anterior, varredura inicial completa.
- Recibo (campos literais): período coberto, achados, novos, ignorados, falhas (com motivo) e custo/tempo.
- A análise automática (transcrição/classificação) é da ingestão (C215); a skill **pode** corrigir/curar o que a descoberta achou errado (ex.: falso positivo) antes de ingerir — nunca classifica faceta manualmente.
- Operação por agente/coordenação técnica; **sem UI**.
- Reexecutar não duplica nem reprocessa o que já está no catálogo.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `.agents/skills/catalogo-falas-web/SKILL.md` + wrapper fino `.opencode/commands/catalogo-falas-web.md`, no padrão das skills de conteúdo (`dossie-solla-{cidade,tema,instituicao}`, `briefing-capacitacao-solla`, `relatorio-cidade`, `reels-tutoriais`, `graficos-dados`); descoberta web por subagente com JSON datado, como o `research.json` dos dossiês.
- **Precedente a olhar:** `dossie-solla-cidade` (research por subagente + pastas `data/` gitignored + recibo curto datado), `reels-tutoriais` (`sourceHash` em `reelPackageIngest.ts`), import da Câmara com janela explícita (`pnpm camara:import --date`, `scripts/import-camara-speeches.mjs`, `scripts/lib/camaraSpeeches.mjs`, skip por estado em `speechImport.ts`).
- **Fatos verificados (a revalidar):** não há watermark de última execução no repo — o estado hoje é JSON por execução com `researchedAt`/`consultedAt`, recibos datados, saídas `<slug>-<YYYY-MM-DD>…` e changelog; a pesquisa web é feita por subagentes de skill (nunca por serviço do app — não há SERP no app nem yt-dlp no repo).
- **Risco de acoplamento:** não criar segunda esteira de ASR/classificação nem segundo estado de catálogo; a ingestão é a do C215 e a descoberta não compete com a varredura oficial do Instagram/YouTube (C211/C212) — a decisão de mecanismo é a do C215.

## Dependências

- **C215 (dura)** — sem a esteira de ingestão a skill não tem o que orquestrar. **C216/C217 não bloqueiam.**

## Fora de escopo

- A esteira de download/transcrição/classificação (C215), a tela (C216) e os cortes (C217).
- Paridade das gravações (C219); agendamento recorrente/infra de fila; monitoramento contínuo de redes.

## Rabbit holes de produto

- **"Virar serviço de monitoramento 24/7."** Se alguém "só completar": agendador, fila, alerta em tempo real. **Corte neste item:** rodada manual sob demanda; recorrência é conversa separada.
- **"Crawling irrestrito."** Se alguém "só completar": varrer a web inteira e perfis que não são do Solla. **Corte:** fontes/plataformas do escopo do C215, com queries pelo nome do deputado e variações.
- **"Segunda esteira de ASR/classificação."** Se alguém "só completar": transcrever e classificar dentro da descoberta. **Corte:** a skill entrega o lote; análise é do C215.
- **"Prometer cobertura exaustiva."** Se alguém "só completar": afirmar que nada escapou. **Corte:** o recibo declara período, achados e limites — o que ficou de fora é reportado, não escondido.

## Questões em aberto (produto)

- **Onde mora o estado da última execução?** **Opções:** A) arquivo gitignored em `data/` (padrão das famílias de skill) | B) registro em banco | C) derivar do próprio catálogo (última data importada). **Recomendação:** A — segue o precedente das skills de conteúdo e não cria schema; o formato exato é decidido na implementação. _(confirmado no gate, 2026-09-24)_
- **Recorte temporal do incremental?** **Opções:** A) desde a última execução bem-sucedida | B) janela fixa (ex.: últimos 30 dias) com dedupe. **Recomendação:** A — "a partir da data que foi feito o último", na voz do dono; janela fixa reintroduz reprocessamento. _(confirmado no gate, 2026-09-24)_
- **Quem aciona?** **Opções:** A) manual (humano/agente rodando a skill, como os dossiês) | B) agendado. **Recomendação:** A — agendamento recorrente está fora de escopo; quando atualizar é decisão de quem opera. _(confirmado no gate, 2026-09-24)_
- **O que fazer com achados duvidosos?** **Opções:** A) a skill marca "revisar" e não ingere até confirmação | B) ingere tudo e a curadoria corrige depois. **Recomendação:** A — evita lixo no catálogo e é barato neste volume; o duvidoso aparece no recibo. _(confirmado no gate, 2026-09-24)_
- **Fontes de descoberta v1?** **Opções:** A) mesmas plataformas do C215 (YouTube, Instagram, áudio/rádio), com queries por nome do deputado e variações | B) recorte menor, monitorando veículo a veículo. **Recomendação:** A — manter o escopo do C215; ampliar é item próprio. _(confirmado no gate, 2026-09-24)_

## Referências

- GitHub Issue: — (após `pnpm agent:register`)
- Design UI (gate): N/A — sem UI
- Abrir primeiro: `.agents/skills/dossie-solla-cidade/SKILL.md` (padrão de research por subagente + recibo) e `.agents/skills/reels-tutoriais/SKILL.md` (ingestão idempotente por hash)
- `docs/plans/acervo-falas-web-ingestao.md` (C215 — mecanismo de descoberta/download e decisão sobre direitos)
- `scripts/import-camara-speeches.mjs` / `scripts/lib/camaraSpeeches.mjs` / `src/utilities/speech/speechImport.ts` — janela explícita e skip por estado
- `AGENTS.md` — convenções de skills do repo
