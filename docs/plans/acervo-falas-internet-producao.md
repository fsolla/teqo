# Falas na internet no acervo de produção (operação de ingestão)

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1339
Priority: P1
Impeccable: A — N/A (operação de dados, sem UI)
Design UI: N/A — sem UI
Appetite: ~1 dia de operação + providências de ambiente no homeserver; um outcome verificável — a fonte "Falas na internet" abre com as falas da rodada em produção e a segunda rodada não duplica
Responsável: —

## Intenção

A fonte "Falas na internet" está no ar em `/campanha/comunicacao/acervo`, mas abre vazia em produção: todas as rodadas da esteira (C215) e da skill (C218) rodaram contra bancos locais de worktree, descartáveis — não há registro de nenhuma rodada de ingestão web contra o `teqo_1313` (a C215 documenta que o run real em produção é operação do C218, e a skill C218 é fail-closed: nunca exporta `FALAS_WEB_IMPORT_CONFIRM`), enquanto o acervo da Câmara tem dados reais desde o C155. Na prática, quem pesquisa falas não encontra nada do que o deputado disse fora do Plenário.

Esta entrega define e executa a operação que leva as falas da web para o acervo de produção — **repetível** (a cada necessidade, sem recomeçar do zero), **deliberada** (nada automático escrevendo no acervo real) e **honesta** (relatório do que entrou e do que falhou) — e registra o runbook para outra pessoa repetir. É operação, não feature: a esteira já existe.

## Persona e fluxo

- **Persona / contexto:** comunicação/coordenação pedindo a atualização (na mesa), com execução assistida por operação técnica; a consumidora final é a assessoria, pesquisando na tela do acervo.
- **Job principal:** ter as falas da internet disponíveis no acervo de produção como as da Câmara — e repetir a rodada depois sem estragar o que já entrou.
- **Fluxo desejado:** decide atualizar → rodada com um lote de achados (baixa, transcreve, classifica, espelha, grava) → lê o relatório (novos, ignorados, falhas) → abre "Falas na internet" e usa; a rodada seguinte entra por cima sem duplicar.
- **Anti-goals de produto:** não é agendador nem monitoramento; não é tela nova; não escreve em produção sem ato explícito; não depende de artefato gitignored da workstation; não deixa mídia em disco local; não toca nos dados da Câmara.

## Objetivo e aceite

- Em produção, `/campanha/comunicacao/acervo` → "Falas na internet" mostra as falas da rodada com player, transcrição, data e origem; as falas da Câmara permanecem intactas.
- Segunda rodada incremental não duplica o que já entrou nem reprocessa o que está completo (skip idempotente do C215); falhas parciais ficam no relatório e são retentáveis.
- A mídia espelhada da rodada está no bucket de produção (Garage) e é servida só ao acervo interno — sem disco local, sem URL pública.
- Runbook no `docs/ops/teqo-1313-deploy.md` (onde roda, pré-requisitos, guardas, como provar idempotência, como reverter) o suficiente para repetir sem memória de sessão.
- **Guardrails:** escrita em produção é ato explícito, com a flag de intenção preservada e jamais exportada por automação; o acervo de produção não depende de estado na workstation; falha não é maquiada; identidade e idempotência do C215 mandam.

## Dados (intenção)

- **Vou apresentar dados?** Não — a superfície é a do C216 e não muda; esta entrega faz os dados chegarem nela.
- **Decisões desbloqueadas:** a comunicação decide usar/cortar/publicar falas da web por tema, data, plataforma e alcance (as mesmas decisões que toma com a Câmara); a coordenação decide quando rodar a atualização.
- **Forma:** N/A — nenhum agregado novo; busca, filtros e cortes continuam donos do C216/C217.

## Dados da decisão (literais)

- Guard de intenção **preservado**: `FALAS_WEB_IMPORT_CONFIRM=1`; a skill C218 nunca exporta a flag e nenhuma automação a define — a rodada é ato de quem opera.
- Alvo de produção: banco `teqo_1313` no homeserver; na workstation um alvo não-local ainda exige `ALLOW_REMOTE_DB=true` na guarda de host — nenhum agente recebe `DATABASE_URL` de produção.
- Comando da operação: `pnpm falas-web:import --findings <lote.json>`; planejamento com `--dry-run`, corte com `--limit n`, relatório JSON em `data/falas-web/reports/falas-web-<stamp>.json` (ajustável por `--out`).
- Destino da mídia: collection privada `internetSpeechMedia` no bucket de produção `teqo-media` (Garage) — nunca disco local, nunca URL pública.
- Estado incremental (contrato do C218): `data/falas-web/last-run.json` com watermark `lastRunAt`, `pending` (retry) e `review` (curadoria) — deve viver de forma durável junto da operação, não no diretório gitignored da workstation.
- Envs fora do repo: `~/stack/teqo-1313.env` (produção) e `~/stack/.env` (`DEEPINFRA_API_KEY`); `NODE_ENV=production` é o sinal honesto do guard.
- Estado atual (evidência de 2026-09-25): a fonte abre vazia em produção e não há registro de rodada web contra o `teqo_1313` (C215/C218 rodaram só em banco local de worktree); o acervo da Câmara tem **997 discursos** (C155) intocados (`origin = camara`, default).
- Rodada inicial: lote curado do C218 primeiro (smoke com `--limit`), depois o volume — varredura completa é decisão de quem opera, não requisito do aceite.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/import-web-speeches.mjs` (CLI/guardas), `scripts/lib/cli.mjs` (`assertWriteConfirm`/`assertLocalDatabase`), `src/utilities/media/ytdlp.ts` + `downloadToFile.ts` (aquisição), `src/utilities/speech/webSpeechIngest.ts` e `src/lib/webSpeech.ts` (esteira/contrato), `.agents/skills/catalogo-falas-web/SKILL.md` e `data/falas-web/*` (fronteira e estado), `docs/ops/teqo-1313-deploy.md`, `~/stack/teqo-1313.env`.
- **Precedente a olhar:** §"C155 — backfill do acervo de falas em produção" do runbook (ssh homeserver, env files, proxy socat do Postgres em `127.0.0.1:5433`, flag de confirmação, tmux + log, smoke de idempotência) e o próprio C215.
- **Risco de acoplamento:** não criar segunda esteira/segundo import; preservar o `sourceKey` da Câmara e a identidade namespaced `web:<platform>:<externalId|url canônica>`; o plugin S3 já registra `internetSpeechMedia`; não alterar a fronteira fail-closed da skill C218 sem decisão de produto (ver questões).

## Dependências

- **C223 e C224 (duras):** a rodada de produção depende da ingestão funcionando com falas longas e via `pnpm`.
- Ambiente: homeserver operacional (Postgres `teqo_1313`, Garage `teqo-media`, runner/workspace) e a sessão de cookies do operador (YouTube/Instagram), hoje na workstation.

## Fora de escopo

- Reimplementar a esteira ou a skill: C215 ingere, C218 descobre — aqui se opera.
- UI/tela nova (C216 já entrega a aba) e cortes (C217); paridade das gravações (C219).
- Agendador, fila, monitoramento contínuo e rodadas automáticas.
- Schema/migration/collection nova (o estado operacional não vai para o banco).
- Dedupe semântico cross-URL, diarização, edição de transcrição e publicação externa.
- Fazer a skill C218 conduzir produção por conta própria — mudança de fronteira só em item próprio, se necessário.

## Rabbit holes de produto

- **"Automatizar a rodada."** Se alguém "só completar": cron/fila e escrita não supervisionada no acervo real. **Corte neste item:** rodada manual e deliberada; a flag de intenção continua humana.
- **"Levar o perfil do navegador para o homeserver".** Se alguém "só completar": replicar a sessão inteira (credenciais vivas) numa máquina a mais. **Corte:** no máximo um arquivo de cookies revogável, com refresh documentado; o arranjo é da implementação.
- **"Espelhar em disco local e subir depois".** Se alguém "só completar": dois destinos, temporários órfãos e limpeza manual. **Corte:** mídia direto no bucket de produção.
- **"Criar collection de estado para o watermark".** Se alguém "só completar": schema, migration e superfície admin para um dado operacional. **Corte:** estado durável fora do banco, contrato do C218 preservado.
- **"Rodar tudo de uma vez no primeiro run".** Se alguém "só completar": horas de máquina, lote enorme e falhas em cascata sem ninguém olhando. **Corte:** lote curado primeiro, `--limit`, relatório antes de ampliar.
- **"Esconder falhas parciais no recibo".** Se alguém "só completar": relatório verde com buracos. **Corte:** relatório honesto com falhas e retentativa (`pending`).

## Questões em aberto (produto)

- **Onde a rodada roda?** **Opções:** A) no homeserver, junto do banco e do Garage, provisionando `yt-dlp` e um arquivo de cookies do operador | B) na workstation, com alvo de produção explícito (`FALAS_WEB_IMPORT_CONFIRM=1` + `ALLOW_REMOTE_DB=true`) e a sessão do navegador | C) duas fases (aquisição onde há sessão; persistência onde há banco). **Recomendação:** A — o dado de produção não sai de onde vive e o único material sensível transportado é um arquivo de cookies revogável (não o perfil); o runbook C155 já tem o precedente exato (homeserver + proxy socat + flag); B exigiria expor o banco de produção; C é engenharia acima do appetite. _(assumido — validar com produto)_
- **Onde vive o estado incremental?** **Opções:** A) diretório durável no homeserver, dono único da rodada | B) derivar do próprio catálogo | C) versionar no repo. **Recomendação:** A — B não recupera `pending`/`review` (o que não entrou não está no banco) e C expõe URLs em repo público e conflita entre worktrees. _(assumido — validar com produto)_
- **Quem conduz a rodada de produção?** **Opções:** A) procedimento manual documentado no runbook, com a skill C218 mantida fail-closed como está | B) a skill ganha um modo de produção explícito. **Recomendação:** A nesta entrega — provar a operação manual primeiro; promover a skill é item próprio, com a flag ainda sob ato humano. _(assumido — validar com produto)_
- **O que entra na primeira rodada?** **Opções:** A) lote curado pequeno (`--limit`) para provar ponta a ponta e idempotência | B) varredura inicial completa de uma vez. **Recomendação:** A — reduz o blast radius e produz o smoke que o runbook documenta; o volume completo roda em seguida, com o caminho já provado. _(assumido — validar com produto)_

## Referências

- GitHub Issue #1339 (C225)
- Design UI (gate): N/A — sem UI
- `docs/plans/acervo-falas-web-ingestao.md` (C215 — esteira) · `.agents/skills/catalogo-falas-web/SKILL.md` (C218 — descoberta/estado) · `docs/plans/acervo-fonte-falas-web.md` e `docs/plans/acervo-cortes-fonte-web.md` (C216/C217 — tela/cortes)
- `docs/changelog/2026-09-24-c215.md` · `docs/changelog/2026-09-24-c216.md` · `docs/changelog/2026-09-24-c218.md` — o que já está em produção
- `docs/ops/teqo-1313-deploy.md` §"C155 — backfill do acervo de falas em produção" e §"Onde roda cada coisa"
- Arquivos-pista: `scripts/import-web-speeches.mjs` · `scripts/lib/cli.mjs` · `src/utilities/speech/webSpeechIngest.ts` · `src/utilities/media/ytdlp.ts` · `src/lib/webSpeech.ts`
- `AGENTS.md` (política de banco local/produção) · `docs/AGENT-OPS.md` §"Ambientes de dados"
