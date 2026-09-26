# C234 — Busca por selfie — visitante encontra as fotos em que aparece

Status: rascunho
Atualizado em: 2026-09-26
Issue: #1369
Priority: P2
Impeccable: C — fluxo público novo (busca por selfie na área pública de fotos)
Design UI: docs/plans/busca-fotos-por-selfie-ui-design.html
Appetite: ~2–3 dias eng + aval jurídico (produto); um outcome verificável — com consentimento ativo, o visitante encontra no acervo público aprovado as fotos em que aparece, sem que a selfie saia do dispositivo e sem score
Responsável: —

## Intenção

Quem compareceu a um evento ou plenária com Jorge Solla quer se achar no acervo — hoje as fotos aprovadas vivem em `/fotos` (C233), mas encontrar-se no meio de centenas é garimpo manual. O pedido do dono é direto: a pessoa tira/envia uma foto própria e vê as fotos públicas em que aparece — com consentimento explícito, sem nomes de terceiros e sem score de semelhança. Reconhecimento facial é permitido e comum em eventos/festas; o desenho tem de ser fail-closed em consentimento (exigência travada do repo) e processar o mínimo possível. É dependente por natureza: sem o acervo catalogado e aprovado (C231/C232) e a superfície `/fotos` (C233), não há o que buscar. Como o tema é biometria de face — dado sensível —, o appetite embute aval jurídico e DPIA como dependência de produto, com a eleição de 04/10/2026 no calendário.

## Persona e fluxo

- **Persona / contexto:** visitante que foi a um evento com Solla, no celular, curioso para se ver no acervo, sem conta na campanha.
- **Job principal:** encontrar, entre as fotos públicas aprovadas, as que eu apareço.
- **Fluxo desejado:** abre `/fotos` → toca "Encontre você nas fotos" → lê o aviso (biometria/LGPD) e consente; sem consentimento configurado o fluxo nem abre → tira/envia uma selfie → o reconhecimento roda no dispositivo (a selfie não sobe) → vê só as fotos aprovadas em que aparece, sem nome de terceiros e sem score → decide se baixa/compartilha → a qualquer momento pede para sair do índice e/ou despublicar uma foto, e o pedido fica registrado.
- **Anti-goals de produto:** não é vigilância nem CRM de rostos; não identifica terceiros; não cruza com `Contact`/leadership; não oferece busca por foto de outra pessoa; não abre sem consentimento; não vira feature social.

### Esboço de fluxo (C)

```text
[fotos] → "Encontre você nas fotos" → aviso + consentimento explícito
  → sem consentimento ativo: recusa clara (fail-closed), fim
  → tira/envia selfie → reconhecimento no dispositivo (a selfie não sai daqui)
  → resultado: só as fotos aprovadas em que a pessoa consultante aparece (sem terceiros, sem score)
  → remoção: sair do índice / despublicar foto → atendimento registrado
```

### Design UI (C)

- Design UI (gate): `docs/plans/busca-fotos-por-selfie-ui-design.html` — por que C: superfície pública nova (permissão/captura, estados de consentimento, resultado, vazio honesto, remoção), nas cenas 390/1280; o HTML hi-fi é o registro do aceite e a fonte de verdade do port.

## Objetivo e aceite

- Com consentimento ativo, o visitante tira/envia uma selfie e recebe somente as fotos do acervo público aprovado em que aparece.
- Sem consentimento ativo (texto aprovado não configurado), o fluxo recusa com linguagem clara — nunca meio aberto, nem na UI nem no servidor.
- Nenhum rastro da selfie no servidor: por padrão a imagem não sobe; se a implementação escolher upload consentido, retenção zero documentada após o match.
- Remoção/opt-out funciona: sair do índice e despublicar fotos a pedido, com atendimento registrado; fail-closed até atender.
- Nenhum score, percentual ou nome de terceiro em nenhum estado — nada de "outras pessoas parecidas".
- Antiabuso: limite de tentativas anônimas, sem criação de conta obrigatória.
- O resultado é o mesmo acervo aprovado para o público pela régua do C232/C233 — nenhuma foto privada/bruta abre porta lateral.
- **Guardrails:** Consent/LGPD fail-closed (conceito travado); sem cruzamento com `Contact`/leadership; biometria não vira cadastro de pessoa.

## Dados (intenção)

- **Vou apresentar dados?** Não — o resultado é "quais fotos", nunca "quão parecido". Score/percentual de semelhança ("match 87%") é anti-goal explícito do dono, não um dado a formatar.
- **Decisões desbloqueadas:** N/A — a escolha do visitante ("essa foto é minha, quero guardar/compartilhar") é qualitativa; nenhum ator decide a partir de número.
- **Forma:** N/A — restrição de produto: **sem score/percentual** de semelhança em nenhum estado da superfície; a única saída é a lista de fotos.

## Dados da decisão (literais)

- **Consentimento fail-closed:** sem Consent ativo (resolvido por `key` estável, com texto versionado e hash) o fluxo não habilita — nem na UI, nem no servidor. Texto/chave exatos são da implementação, o conceito é travado.
- **Escopo do índice facial — pergunta central do gate.** Opções: (A) **só consentidos/catálogo curado** — indexa rostos apenas de quem aderiu (equipe, lideranças, figuras públicas) e a busca por selfie só devolve se o rosto consultante já estiver indexado (mais restrito, mais seguro, UX pior); (B) **índice de todos os rostos do acervo público aprovado**, mas a resposta só se refere à própria pessoa consultante — sem nomes de terceiros, sem listar outras pessoas, com DPIA + aval jurídico e mecanismo de remoção do índice; (C) não indexar rostos anônimos e só habilitar busca para pessoas previamente cadastradas com consentimento. **Recomendação do plano:** A/C no MVP (falha fechada), evoluindo para B somente com aval jurídico documentado e DPIA — o gate decide.
- **Selfie nunca sai do dispositivo por padrão:** detecção/embedding facial no cliente (precedente de visão on-device do repo); ao servidor vai só o vetor, sem imagem — se a opção de upload consentido for escolhida, retenção zero após o match e nunca armazenar em `media` pública.
- **Resposta mínima:** mostra só as fotos aprovadas em que a pessoa consultante aparece; nunca "outras pessoas parecidas", nunca nome de terceiro, nunca score.
- **Remoção:** pessoa pode pedir para sair do índice e ter fotos despublicadas; atendimento registrado; fail-closed até atender.
- **Nada de foto privada/bruta** no resultado: só acervo aprovado para o público (mesma régua do C233).
- **Antiabuso:** limite de tentativas anônimas (rate limit), sem criação de conta obrigatória.
- **Janela eleitoral (eleição 04/10/2026) e DPIA:** superfície pública de biometria não abre sem revisão jurídica; registrar como dependência de produto e timing pós-eleição (o gate decide).

## Direção no codebase (hipótese)

- **Áreas prováveis:** superfície `/fotos` do C233 (rota + componentes), um fluxo client-side para captura/embedding (precedente `src/components/cards/`), `src/utilities/` para consentimento por key, rate limit e a rota de consulta; qualquer arquivo de selfie, se existir, atrás do gate privado padrão.
- **Precedente a olhar:** `src/components/cards/cardCutout.ts` (visão on-device; a foto nunca sai do navegador), `src/utilities/campaignConsent.ts` + `src/lib/campaignConsentKeys.ts` (Consent por key fail-closed), `src/utilities/privateMedia/` + `src/app/(frontend)/conteudos/[slug]/midia/route.ts` (arquivo privado atrás de gate), `src/utilities/ai/rateLimit.ts` (antiabuso anônimo), `src/utilities/sameOriginRequest.ts` (POST público).
- **Risco de acoplamento:** vocabulário colide — "biometria" no repo hoje é WebAuthn/passkeys (`src/utilities/campaignBiometricsPrompt.ts`), não face. O gate de consentimento e a régua de publicação (C232/C233) são donos; esta feature não cria segunda régua nem segundo cadastro de pessoa. Índice facial é infra própria (o C229 limita embeddings ao acervo interno de falas — implementação decide o como).

## Dependências

- Duras: C231 (acervo de fotos), C232 (catálogo/aprovação), C233 (superfície pública `/fotos`).
- Duras de produto: aval jurídico + DPIA antes de expor superfície pública de biometria; timing pós-eleição (04/10/2026).
- Soft: C229 (`docs/plans/acervo-busca-por-sentido.md`) — precedente de índice próprio, abordagem fica na implementação.

## Fora de escopo

- Indexação biométrica de vídeos/gravações; moderação automática; API pública de reconhecimento; app nativo.
- Nomeação/identificação de terceiros; galeria "quem é quem"; cruzamento com `Contact`/leadership; qualquer mecânica social (seguir/curtir/perfil público).

## Rabbit holes de produto

- **"Só completar" com identificação de todo mundo.** Se alguém "só completar": nomear automaticamente cada rosto do acervo — virou vigilância/CRM de rostos. **Corte neste item:** só as fotos da pessoa consultante; nunca nome de terceiro, nunca diretório de rostos.
- **Upload ilimitado de selfies / galeria de selfies.** Se alguém "só completar": guardar selfies para "melhorar o match". **Corte neste item:** por padrão a selfie não sobe; sem galeria, sem retenção de imagem.
- **Face matching em tempo real.** Se alguém "só completar": busca ao vivo no evento, fila de câmeras. **Corte neste item:** busca assíncrona sob demanda dentro da `/fotos`.
- **Shareability social.** Se alguém "só completar": ranking/feed de "fotos mais parecidas". **Corte neste item:** resultado privado da consulta, sem métrica e sem exposição.

## Questões em aberto (produto)

- **Escopo do índice facial (pergunta central do gate)?** **Opções:** A) só consentidos/catálogo curado | B) todos os rostos do acervo público aprovado, com resposta só sobre a própria pessoa + DPIA/aval | C) só pessoas previamente cadastradas com consentimento. **Recomendação:** A/C no MVP (falha fechada); B só com aval jurídico documentado e DPIA — o gate decide.
- **Quem opera a fila de remoção/atendimento?** **Opções:** A) comunicação/assessoria (dona do acervo), com registro no fluxo interno | B) coordenação de campanha | C) jurídico. **Recomendação:** A — quem publica/despublica atende; jurídico entra na revisão, não na fila. _(assumido — validar com produto)_
- **Retenção do vetor de quem consulta?** **Opções:** A) zero — descartado ao fim da consulta | B) opt-in explícito do visitante para entrar no índice | C) retenção curta para antiabuso. **Recomendação:** A como padrão e B só como opt-in no escopo A/C; C rejeitada — antiabuso é contador, não biometria guardada.
- **Revisão jurídica/DPIA é dependência dura?** **Opções:** A) DPIA + aval registrados antes de qualquer superfície pública | B) aval só para o MVP restrito (A/C) | C) abrir sem revisão. **Recomendação:** A/B — sem revisão registrada não abre; o gate decide o timing (eleição 04/10/2026).

## Referências

- GitHub Issue [#1369](https://github.com/fsolla/teqo/issues/1369)
- Design UI (gate): `docs/plans/busca-fotos-por-selfie-ui-design.html`
- `docs/plans/acervo-busca-por-sentido.md` (C229 — índice próprio; implementação decide)
- `src/components/cards/cardCutout.ts` (precedente on-device) · `src/utilities/campaignConsent.ts` + `src/lib/campaignConsentKeys.ts` (Consent fail-closed) · `src/utilities/privateMedia/` + `src/app/(frontend)/conteudos/[slug]/midia/route.ts` (privado atrás de gate) · `src/utilities/ai/rateLimit.ts` (antiabuso)
- `AGENTS.md` — Consent/LGPD fail-closed e convenções travadas.

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (com consentimento, achar-se nas fotos aprovadas; sem ele, recusa); (2) appetite ~2–3 dias + aval jurídico comporta consentimento, captura on-device, resultado, remoção e antiabuso, com índice/storage no plano de implementação; (3) persona, job e aceite sem jargão de stack; (4) direção no codebase é hipótese com precedentes nomeados; (5) zero decisão dura de engenharia (escopo do índice, vetor, rate limit e storage ficam para a implementação, com o gate decidindo o escopo).
