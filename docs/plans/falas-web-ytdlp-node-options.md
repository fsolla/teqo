# Ingestão web de falas funciona no comando documentado, sem runtime local

Status: rascunho
Atualizado em: 2026-09-25
Issue: #1338
Priority: P1
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~0,5 dia eng; um outcome verificável (lote de 1 vídeo verde pelo comando documentado)
Responsável: —

## Intenção

Quem opera a esteira de falas usa o comando que está documentado: `pnpm falas-web:import --findings <lote>`. É ele que carrega o ambiente do repo e é ele que hoje quebra a ingestão do YouTube. O `NODE_OPTIONS` que o wrapper passa para os scripts Node vaza para o runtime JS que o yt-dlp invoca para resolver o desafio do YouTube; o processo filho herda `--import=tsx/esm --import=./scripts/seed-loader.mjs` e o desafio morre. O erro que aparece é `Requested format is not available` — enganoso, parece problema de formato/cookies/vídeo, mas é consequência da configuração de runtime do nosso próprio comando.

O custo não é só a falha: é a rodada queimada. O operador perde um lote inteiro, vai atrás de cookies e de flags de formato antes de descobrir que o mesmo comando, rodado fora do `pnpm`, funciona. Isso não é um defeito de produto do yt-dlp nem do vídeo; é nosso. O operador não deveria precisar saber disso — nem ter um wrapper de `node` em `~/.local/bin` para contornar.

## Persona e fluxo

- **Persona / contexto:** operador da comunicação que roda a atualização do catálogo de falas a partir da web, na mesa, confiando no comando documentado (skill `catalogo-falas-web` / README); sem tempo nem contexto para depurar runtime de terceiros.
- **Job principal:** rodar o lote pelo comando documentado e receber os itens do YouTube como `created`/`skipped`, sem configuração local extra.
- **Fluxo desejado:** monta o lote → roda `pnpm falas-web:import --findings <lote>` → acompanha o relatório item a item → vê o vídeo do YouTube ingressar ou ser pulado por regra de produto (já ingerido, etc.), nunca `failed` por causa do ambiente do repo.
- **Anti-goals de produto:** esta entrega NÃO deve virar um manual de instalação de runtime, um segundo caminho de ingestão, nem uma flag nova que o operador precise passar. O contrato do relatório e dos estágios fica como está.

## Objetivo e aceite

- Um lote com 1 vídeo do YouTube roda verde via `pnpm falas-web:import` num ambiente com o `NODE_OPTIONS` do wrapper do repo (`--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs`), sem wrapper de `node`, sem `~/.config/yt-dlp/config` especial e sem flag adicional.
- O relatório do lote mostra `created` (ou `skipped`, se for regra de produto) para o item — não `failed (acquisition)`.
- Teste automatizado cobre a sanitização no runner de yt-dlp; o runner é injetável nos specs, então o teste prova o comportamento sem baixar da internet.
- Sem regressão para o caminho Câmara, que não usa yt-dlp.
- O contrato do relatório (estágios, exit codes, formato) e o comportamento de `pnpm falas-web:import` permanecem iguais.
- Guardrail: o fix é no dono do spawn do yt-dlp, não em cada script chamador — nenhum script de ingestão deve ganhar tratamento próprio de ambiente.

## Dados (intenção)

- **Vou apresentar dados?** Não — o item não cria superfície de dados; o "dado" entregue é o próprio relatório de lote já existente.
- **Decisões desbloqueadas:** operador decide se confia no comando documentado como caminho único de ingestão web (hoje precisa escalar/contornar com wrapper local); mantenedor decide se pode rodar a esteira em máquina limpa/CI futura sem setup de runtime do yt-dlp.
- **Forma:** _adiada ao plano de implementação_ — aqui só restrições de produto: nenhuma mudança na leitura do relatório, nenhum campo novo, nenhuma métrica de vaidade.

## Dados da decisão (literais)

- `NODE_OPTIONS` que quebra, verbatim do `package.json`: `--no-deprecation --import=tsx/esm --import=./scripts/seed-loader.mjs`.
- Sintoma verbatim: `yt-dlp não leu os metadados: ERROR: [youtube] <id>: Requested format is not available` (estágio `acquisition`).
- Dono único do spawn: `src/utilities/media/ytdlp.ts` — `defaultRunner` (via `execFile`), consumido por `readYtDlpMetadata` e `downloadWithYtDlp`; o runner é injetável (`YtDlpRunner`) nos specs.
- Contrato intocado: pontos `created`/`skipped`/`failed` e estágios do relatório de `scripts/import-web-speeches.mjs` (incluindo `acquisition`).
- Workaround de host usado na sessão NÃO entra no repo: wrapper `~/.local/bin/node-clean` (`env -u NODE_OPTIONS node "$@"`) + `~/.config/yt-dlp/config` com `--js-runtimes`. É paliativo de máquina; a correção vive no repo.
- O mecanismo exato da sanitização (env limpo no `defaultRunner` vs. remoção pontual no spawn) NÃO é decidido aqui.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/utilities/media/ytdlp.ts` (dono do spawn); specs vizinhos do runner; possivelmente nada em `scripts/import-web-speeches.mjs` nem no wrapper de `package.json`.
- **Precedente a olhar:** testes que já injetam runner/`YTDLP_PATH` falso em `src/utilities/media/`; a própria doc de C215 no topo de `ytdlp.ts` ("single owner of yt-dlp execution").
- **Risco de acoplamento:** o runner é compartilhado por metadata e download; sanitizar no dono cobre os dois. O caminho Câmara não passa por aqui — não tocar. Não introduzir dependência nova nem download real nos testes.

## Dependências

- Nenhuma.

## Fora de escopo

- Configurar/instalar yt-dlp ou runtime JS na máquina do operador (documentação de setup local fica como está).
- Suporte a novas plataformas, mudança de formato de download ou de cookies.
- Qualquer alteração no caminho Câmara.
- Retomar/limpar itens que falharam em lotes anteriores (o operador reexecuta o lote; a esteira já é idempotente por item).

## Rabbit holes de produto

- **Transformar em "suporte a yt-dlp".** Se alguém "só completar": passar a validar versão, runtime JS, cookies e config do usuário vira uma central de diagnóstico de terceiros. **Corte neste item:** o único comportamento exigido é a ingestão funcionar com o `NODE_OPTIONS` do repo; diagnóstico amplo fica fora.
- **Flag/kill-switch nova no comando.** Se alguém "só completar": expor `--no-node-options` ou um env próprio transfere o problema de volta ao operador. **Corte neste item:** o comando documentado não ganha knob; o saneamento é interno.
- **Generalizar para todo `execFile` do repo.** Se alguém "só completar": sanitizar ambiente globalmente pode mascarar dependências legítimas de `NODE_OPTIONS` em outros scripts. **Corte neste item:** só o spawn do yt-dlp.

## Questões em aberto (produto)

- **O relatório deve mencionar a causa antiga quando um item falhar por ambiente no futuro?** **Opções:** A) Não — erro genérico como hoje; B) melhorar a mensagem do estágio `acquisition` para citar conflito de runtime. **Recomendação:** A neste item (o fix elimina a classe de falha; mensagem melhor é escopo próprio). _(assumido — validar com produto)_
- **Precisa de teste e2e com download real?** **Opções:** A) Não — spec unitário com runner injetado basta; B) sim, lote real no CI. **Recomendação:** A (o aceite manual de 1 vídeo cobre o mundo real; CI não deve depender do YouTube). _(assumido — validar com produto)_

## Referências

- GitHub Issue #1338 (C224)
- Design UI (gate): N/A
- `src/utilities/media/ytdlp.ts` — dono do spawn de yt-dlp
- `scripts/import-web-speeches.mjs` e `package.json:92` (`falas-web:import`) — comando e relatório que não mudam
- `.agents/skills/catalogo-falas-web/SKILL.md` — fluxo operacional que consome a esteira
- `AGENTS.md` — convenção de não duplicar rota (fix no dono do concern)
