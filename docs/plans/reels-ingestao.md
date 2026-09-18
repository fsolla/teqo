# Ingestão do pacote do reel na biblioteca privada do /campanha

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1154
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1 dia eng; um outcome verificável
Responsável: —

## Intenção

A produção dos Reels do mandato termina na workstation, mas a entrega na biblioteca privada do `/campanha` ainda depende de trabalho manual: subir arquivo por arquivo, reencaixar campos e torcer para não duplicar acervo. Este item fecha essa última milha com um comando único que publica o pacote pronto — uma vez, no lugar certo e com conferência antes de gravar.

A forma é decisão travada com o humano: o comando roda no homeserver, onde os dados de produção vivem e onde os segredos já moram, e escreve pelo caminho oficial da aplicação. Nenhuma credencial de campanha circula na workstation, ninguém escreve por fora do Teqo, e o ensaio é sempre em staging antes de produção.

## Persona e fluxo

- **Persona / contexto:** quem produz os Reels do mandato (comunicação/assessoria) na workstation, já acostumado com o fluxo da skill de produção; roda o comando no homeserver, com pressa e querendo conferir antes de gravar.
- **Job principal:** publicar um pacote de reel finalizado na biblioteca privada do `/campanha` com um comando, uma vez só, sem retrabalho.
- **Fluxo desejado:** produz e empacota o reel → copia o pacote para o homeserver → roda o comando em modo conferência (vê o que será criado ou atualizado e para onde) → confirma a escrita → valida em staging → repete em produção → o reel aparece na biblioteca com vídeo, capa, narração, legenda e roteiro ligados à mesma entrada.
- **Anti-goals de produto:** não é pipeline de mídia (não edita, não transcodifica, não gera capa); não publica em rede social; não é um segundo cadastro de conteúdo paralelo à biblioteca; não vira editor de metadados.

## Objetivo e aceite

- O comando único ingere o pacote completo e o reel fica consultável na biblioteca privada com todos os artefatos associados à mesma entrada.
- Re-ingerir o mesmo reel (mesma chave de identidade do pacote) atualiza a mesma entrada — nunca cria duplicata.
- O padrão é conferência: sem confirmação explícita nada é escrito, e antes de qualquer escrita o comando mostra o alvo e o que será criado ou atualizado.
- Alvo que não corresponde ao ambiente declarado é recusado sem escrita (fail-closed, como no resto do repo).
- O caminho de validação passa sempre por staging antes de produção.
- Pacote incompleto ou sem os campos obrigatórios (incluindo o texto alternativo da capa) é recusado com mensagem clara — sem meia-escrita.
- Falha no meio do ingest não deixa entrada parcial visível na biblioteca.
- Nenhuma credencial de campanha na workstation; nenhuma escrita fora do caminho oficial da aplicação.

## Dados (intenção)

- **Vou apresentar dados?** Não — item de ingestão, sem tela nova.
- **Decisões desbloqueadas:** comunicação (o reel está disponível na biblioteca para uso nos canais); coordenação (o acervo de reels reflete o que foi produzido).
- **Forma:** _adiada ao plano de implementação_ — sem superfície de dados neste item.

## Dados da decisão (literais)

- Caminho de escrita: API do Payload (Local API) rodando no homeserver, na imagem de manutenção já existente — nunca SQL cru nem credencial de campanha na workstation.
- Comando: `pnpm reels:ingest <diretório-do-pacote>`, rodado no homeserver, na imagem de manutenção do ambiente; o pacote chega por cópia (rsync) da skill.
- Guard de intenção explícita: dry-run por padrão; escrita só com flag de confirmação (molde `MEDIA_RECOVER_CONFIRM`/`OPS79_MIGRATE_CONFIRM`); recusa de alvo que não case o ambiente declarado (`TEQO_ENV=staging|production`).
- Idempotência: chave pelo hash do shot list gravado no `metadata.json` — re-ingerir o mesmo reel atualiza a mesma linha; hash novo = reel novo.
- Staging primeiro, sempre: o caminho de validação é `teqo-staging` antes de `teqo-1313`.
- Pacote do reel (nomes/artefatos): `reel.mp4` (sem áudio, primário), `reel-audio.mp4` (com áudio rascunho, quando houver), `narracao.mp3` (quando houver), `narracao.srt`, `roteiro.md`, `capa.png`, `metadata.json` (título, funcionalidade, duração, hash do shot list, data).
- Sem publicação no Instagram; sem transcodificação no ingest.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `scripts/` (comando novo + helpers de `scripts/lib/cli.mjs`), imagem de manutenção (`Dockerfile`) e fluxo de deploy no homeserver; escrita via Local API como em `scripts/recover-media.mjs`/`scripts/seed-posts.mjs`; destino na biblioteca — `src/collections/Media.ts` + coleção do C193 (`src/payload.config.ts`).
- **Precedente a olhar:** `scripts/recover-media.mjs` (dry-run/confirm/echo do alvo), `scripts/migrate-signature-orphan.mjs` (`--apply` + confirm), `scripts/bootstrap-staging-test-account.mjs` (guard por ambiente/banco), `scripts/seed-loader.mjs` (NODE_OPTIONS em script que sobe o Payload), `docs/ops/teqo-1313-deploy.md` (comando arbitrário na imagem de manutenção).
- **Risco de acoplamento:** o modelo de destino é do C193; o ingest não pode furar o guard de ambiente nem desviar do adapter S3/proxy privado; os nomes do pacote são contrato com a skill de produção na workstation.

## Dependências

- **C193 — dura.** Sem a coleção do reel e a regra de privacidade definidas, não há onde ingerir nem como validar o aceite.
- **Soft:** C196/C197 — o pacote real só existe quando as skills existirem; o ingest é testável com um pacote de fixture.

## Fora de escopo

- Transcodificação, normalização de áudio, geração de capa/poster e qualquer processamento de mídia (a imagem de manutenção não tem ffmpeg nem browser).
- Publicação ou agendamento no Instagram e em outras redes (destino próprio, se um dia existir).
- Edição do reel, regeração de roteiro/SRT ou correção de narração.
- Editar metadados/artefatos de um reel já ingerido pelo comando — edição é no admin.
- Arquivar/remover reels e gestão de acervo (C193).

## Rabbit holes de produto

- **"Já que tem o comando, ele podia preparar a mídia".** Se alguém "só completar": ffmpeg na imagem, transcodificar, extrair poster, normalizar áudio → explosão da imagem de manutenção e do appetite. **Corte neste item:** o pacote chega pronto; o ingest valida campos/existência e grava.
- **"Já que roda no servidor, deixa assistindo a pasta".** Watcher/daemon, ingest automático, retry infinito, publicação automática → vira plataforma de mídia. **Corte neste item:** comando manual e idempotente; automação só com pedido novo.
- **"Já que lê metadados, deixa editar tudo no dry-run".** Vira editor de conteúdo e duplica o admin. **Corte neste item:** o ingest só cria/atualiza a partir do pacote; correção é no admin.
- **"Faz direto na workstation com credencial".** A conveniência de rodar do jeito antigo fura a decisão travada. **Corte neste item:** só Local API no homeserver.

## Questões em aberto (produto)

- **Pacote com artefatos opcionais ausentes passa?** **Opções:** A) sim, exigindo só vídeo primário + capa + metadados + legenda; B) exigir todos os artefatos. **Recomendação:** A — o reel mínimo útil precisa de vídeo, capa e legenda; áudio rascunho e narração ligam quando existirem. _(assumido — validar com produto)_
- **O dry-run deve apontar se vai criar ou atualizar?** **Opções:** A) sim, por entrada/arquivo; B) só listar o que fará. **Recomendação:** A — a conferência é o ponto do guard; saber "atualiza esta entrada" evita susto em re-ingest.
- **Mesmo hash de shot list com arquivos regerados (nova capa, novo corte)?** **Opções:** A) atualiza a entrada existente com os arquivos novos; B) recusa até hash novo. **Recomendação:** A — o hash identifica o reel; re-ingerir é atualizar, e é isso que evita duplicata.

## Referências

- `scripts/recover-media.mjs`, `scripts/lib/cli.mjs`, `scripts/migrate-signature-orphan.mjs`, `scripts/bootstrap-staging-test-account.mjs`, `scripts/seed-posts.mjs`, `scripts/seed-loader.mjs` — moldes de guard, dry-run e Local API em script
- `Dockerfile`, `scripts/deploy-homeserver.sh`, `docs/ops/teqo-1313-deploy.md` — canal de execução no homeserver e envs por ambiente
- `src/collections/Media.ts`, `src/payload.config.ts` — adapter S3 privado, proxy e `alt` obrigatório
- `AGENTS.md` — fail-closed de ambiente e convenção de coleção própria
- C193 — modelo de destino (coleção do reel + privacidade)
