# Reel privado no CMS

Status: rascunho
Atualizado em: 2026-09-18
Issue: #1152
Priority: P2
Impeccable: A — N/A sem UI
Design UI: N/A — sem UI
Appetite: ~1 dia eng; um reel registrável de ponta a ponta com arquivos privados e kill switch
Responsável: —

## Intenção

A assessoria já produz Reels de tutorial das funcionalidades do site (começando pelos cards de `#cards`) fora do Teqo, mas o resultado se perde em pastas e conversas. Quero que cada reel exista no sistema: título, funcionalidade-alvo, os artefatos de mídia e um estado que funcione como kill switch. Os arquivos são da campanha, **privados e não listados** — só abrem com login; o site público não muda em nada. Nada de publicação automática no Instagram: a assessoria publica pelos canais dela. Este item entrega o registro no CMS, não o fluxo editorial completo de produção.

## Persona e fluxo

- **Persona / contexto:** pessoa da assessoria de comunicação que produz o reel fora do Teqo; coordinator/candidate revisam e podem desligar um reel.
- **Job principal:** registrar o reel com seus artefatos num lugar privado e confiável, com um estado que tire do ar num clique.
- **Fluxo desejado:** produz fora → sobe o registro com título, funcionalidade-alvo (`cards`) e artefatos (vídeo sem áudio como primário; variante com áudio quando houver; mp3 da narração rascunho; transcrição; `.srt`; capa) → estado rascunho → aprovação → publicado na biblioteca privada → se preciso, despublicado tira do ar.
- **Anti-goals de produto:** não é editor de vídeo; não é galeria pública; não publica sozinho em rede social; não cria segundo cadastro de pessoa.

## Objetivo e aceite

- Um reel é registrável com título, funcionalidade-alvo e estado `draft → published → unpublished`.
- Todos os artefatos previstos podem ser anexados ao mesmo registro, com o vídeo sem áudio como primário.
- Nenhum arquivo de reel abre sem login da campanha (anônimo e navegador sem sessão recebem não).
- Aprovar publica direto na biblioteca privada e **não** dispara nenhuma ação externa.
- `unpublished` funciona de fato: o reel some da biblioteca da assessoria e o arquivo deixa de ser servido.
- Só os papéis da comunicação veem e gerenciam; advisors e leaders ficam fora.
- O site público e os cards permanecem idênticos.

## Dados (intenção)

- **Vou apresentar dados?** Não
- **Decisões desbloqueadas:** saber quais funcionalidades já têm tutorial e onde estão os arquivos; base futura para cobertura de funcionalidades.
- **Forma:** adiada ao plano de implementação

## Dados da decisão (literais)

- Status do reel: `draft | published | unpublished` (kill switch = `unpublished`; aprovar publica direto na biblioteca privada → `published`).
- Funcionalidade-alvo (feature): começa por `cards` — a funcionalidade dos cards de apoio em `#cards`; o vocabulário cresce conforme novos tutoriais.
- Papéis com acesso: os mesmos da vertical de comunicação — `communicator`, `coordinator`, `candidate`; advisors e leaders fora.
- Artefatos: vídeo `mp4` 1080×1920 (sem áudio = primário; com áudio = variante), áudio `mp3` (rascunho da narração), transcrição/roteiro em texto, legendas `.srt`, capa `png/jpg` 1080×1920.
- Guardrails: **nunca** publicar automaticamente no Instagram; o site público não muda; arquivo só abre com login da campanha; sem clone de voz; sem segundo cadastro de pessoa.

## Direção no codebase (hipótese)

- **Áreas prováveis:** coleção nova na vertical de Comunicação (precedente `src/collections/SpeechCut.ts`), artefatos privados na esteira do `Media` (upload + storage privado por proxy), auth da campanha e superfície do admin Payload — sem tela pública.
- **Precedente a olhar:** `SpeechCut` (grupo `'Comunicação'`, `status` com descrição de kill switch, relationship `media`); acessos em `src/utilities/access/speeches.ts` re-exportados por `src/utilities/campaignAccess.ts`; roles em `src/lib/campaignRoles.ts`.
- **Ponto sensível (decidir na implementação):** o cookie de campanha tem `path: '/campanha'` e `<video>`/`<img>` não mandam header — privacidade de arquivo provavelmente exige rota autenticada sob `/campanha` servindo o objeto (proxy) ou URL assinada. Não fechar aqui.
- **Vocabulário de feature:** não existe catálogo; os `data-home-section` da home e os ids de `src/lib/cardModels.ts` são a matéria-prima mais próxima.
- **Risco de acoplamento:** `Media` hoje é leitura pública (pino em `tests/int/collectionAccessLockdown.int.spec.ts:224-249`); o caminho privado novo não pode afrouxar nem quebrar esse contrato.

## Dependências

- **Soft:** C196/C197 — são os produtores dos artefatos que alimentam este modelo; o modelo não depende delas para existir.
- **Soft:** C195 — o ingest é o caminho preferido de escrita, mas o admin continua sendo uma porta válida.

## Fora de escopo

- Publicação automática ou agendada no Instagram.
- Qualquer mudança no site público, na home ou nos cards.
- Edição de vídeo, legenda ou áudio dentro do sistema.
- Métricas/analytics do que foi publicado no Instagram.
- CRUD de um catálogo de funcionalidades (o vocabulário começa fixo em `cards`).
- Dashboard de biblioteca além do admin (é o C194).

## Rabbit holes de produto

- **Pipeline de mídia.** Se alguém "só completar" com transcode, derivação de thumb ou compressão, vira projeto de encoding. **Corte neste item:** aceitar os arquivos como enviados, sem processamento.
- **Variantes e versionamento.** "Só mais uma versão" do vídeo/roteiro vira controle de revisão. **Corte neste item:** um artefato por formato; trocar = substituir.
- **Legenda/voz automática.** "Só gerar o `.srt` sozinho" puxa STT e beira clone de voz. **Corte neste item:** legendas e transcrição vêm prontas de fora.
- **Biblioteca pública.** "Só uma galeria no site" atravessa a decisão travada de privacidade. **Corte neste item:** nada público.

## Questões em aberto (produto)

- **Vocabulário de feature: lista fechada ou texto livre?** **Opções:** A) lista de ids conhecidos (`cards`, …) | B) texto livre com sugestões. **Recomendação:** A, começando por `cards`, crescendo por lista — dá agrupamento e evita variação de grafia. _(assumido — validar com produto)_
- **Quem aprova o reel (`draft → published`)?** **Opções:** A) qualquer um dos três papéis | B) só coordinator/candidate. **Recomendação:** A — a assessoria produz e aprova; coordinator/candidate mantêm o kill switch. _(assumido — validar com produto)_
- **`unpublished` esconde só da listagem ou também invalida o arquivo?** **Opções:** A) some da biblioteca, arquivo ainda abre com login | B) corta também o acesso ao arquivo. **Recomendação:** B — kill switch precisa ser de verdade; **conflita com a recomendação do C194 e precisa de decisão única no gate.**

## Referências

- `src/collections/SpeechCut.ts`, `src/utilities/access/speeches.ts`, `src/utilities/campaignAccess.ts`
- `src/collections/Media.ts`, `src/utilities/mediaStorage.ts`, `src/payload.config.ts`
- `src/utilities/campaignAuth.ts`, `src/lib/campaignRoles.ts`
- Home `#cards` e `src/lib/cardModels.ts` (matéria-prima do vocabulário de feature)
- `tests/int/collectionAccessLockdown.int.spec.ts` (contrato de leitura anônima de `media`)
