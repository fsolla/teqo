# C242 — Busca por selfie aberta a qualquer visitante (escopo B)

Status: aprovado (decisão do dono na sessão, 2026-10-01)
Atualizado em: 2026-10-01
Issue: — (worktree `work/43`, sem claim)
Priority: P1
Impeccable: C — superfície pública de biometria (muda o escopo do índice facial do C234)
Design UI: docs/plans/busca-fotos-por-selfie-ui-design.html (estender no C243; esta fatia muda copy/estados do fluxo, não a gramática visual)
Appetite: ~2–3 dias eng + ops de publicação/indexação; um outcome verificável — **qualquer visitante** encontra no acervo público aprovado as fotos em que aparece, sem que a selfie saia do aparelho e sem score
Responsável: —

## Intenção

O C234 entregou a busca por selfie **fechada por padrão** e no escopo A/C: só quem foi inscrito pela assessoria (`pnpm faces:enroll`, consentimento assinado) entra no índice; um visitante comum nunca se encontra. O dono decidiu (2026-10-01), com aval jurídico declarado na sessão, **reabrir o escopo do gate (PR #1370) para B**: indexar os rostos presentes no acervo público aprovado, anonimamente (sem nome, sem vínculo com pessoa), para que **qualquer visitante** consiga se achar. A base de fotos também nunca foi publicada (6.492 drafts, 0 aprovadas) — sem isso não há o que buscar —, então a fatia inclui a publicação em lote do acervo e a indexação.

O que muda de conceito: o índice deixa de ser "adesão de pessoas" e passa a ser **índice biométrico anônimo do acervo aprovado**, com transparência pública (aviso), remoção a pedido (opt-out por selfie + canal de remoção de foto) e kill switch imediato. O enrollment por CLI e a collection `faceSubject` ficam obsoletos e são removidos (editar o dono, não criar gêmeo).

## Persona e fluxo

- **Persona / contexto:** visitante que foi a um evento com Solla, no celular, sem conta na campanha.
- **Job principal:** encontrar, entre as fotos públicas aprovadas, as que eu apareço.
- **Fluxo desejado:** abre `/fotos` (ou a seção da home) → toca "Encontre você nas fotos" → lê o aviso (biometria/LGPD + como sair do índice) e consente com o uso da própria selfie → tira/envia uma selfie → o reconhecimento roda no dispositivo (a selfie não sobe) → vê só as fotos aprovadas em que aparece, sem nome de terceiros e sem score → a qualquer momento pede para sair do índice (selfie de novo → o rosto deixa de ser encontrado) e/ou despublica uma foto pelo canal de remoção.
- **Anti-goals de produto:** não é vigilância nem CRM de rostos; não nomeia nem identifica terceiros; não cruza com `Contact`/leadership; não oferece busca por outra pessoa; não abre sem aviso/consentimento configurados; não retém a selfie.

## Objetivo e aceite

- Com o aviso e o consentimento de consulta configurados e a flag ligada, **qualquer visitante** que apareça em foto aprovada recebe a lista dessas fotos.
- Sem aviso/consentimento configurado (ou flag desligada), o fluxo recusa com linguagem clara — nunca meio aberto, nem na UI nem no servidor.
- Nenhum rastro da selfie no servidor: o browser envia só o vetor 128-d; nenhuma imagem, nenhum score, nenhum nome de terceiro.
- Nenhuma foto draft/removida no resultado; desaprovar uma foto a tira da busca imediatamente (por construção: o resultado cruza o índice com o read aprovado do C233, e os descritores da foto são apagados na desaprovação/remoção).
- Opt-out funciona: "Minha presença" com a selfie apaga os descritores daquele rosto do índice e ele deixa de ser encontrado; o pedido de remoção de foto continua no canal do álbum.
- O índice cobre só o acervo **aprovado** e só o modelo vigente; trocar o modelo invalida a revisão e o próximo lote reprocessa.
- Antiabuso: rate limit anônimo (20/10 min por IP hasheado), same-origin, body ≤4 KB.
- **Guardrails:** Consent/LGPD fail-closed (aviso + consentimento de consulta são o gate); sem cruzamento com `Contact`/leadership; a biometria não vira cadastro de pessoa.

## Dados (intenção)

- **Vou apresentar dados?** Não — o resultado é "quais fotos", nunca "quão parecido". Score/percentual é anti-goal explícito do dono.
- **Decisões desbloqueadas:** N/A — a escolha do visitante ("essa foto é minha, quero guardar/compartilhar") é qualitativa.
- **Forma:** N/A — **sem score/percentual** de semelhança em nenhum estado; a única saída é a lista de fotos.

## Dados da decisão (literais)

- **Escopo do índice — decisão do dono (2026-10-01): B.** Indexa os rostos do acervo público aprovado, anonimamente; a resposta é só sobre a própria pessoa consultante. O DPIA/aval jurídico foi **declarado aprovado pelo dono na sessão** ("o jurídico aprovou; qualquer coisa ajeitamos ou tiramos do ar depois"); o fail-closed de configuração (aviso + consentimento) permanece no código.
- **Textos:** os dois Consentimentos (`busca-selfie-fotos` de consulta e `busca-selfie-indice`, reclassificado como **aviso público do índice**) são redigidos nesta entrega e configurados no admin antes da abertura; nada abre sem eles.
- **Selfie nunca sai do dispositivo:** o browser roda o engine e envia só o vetor; sem upload, sem galeria, sem retenção.
- **Resposta mínima:** só fotos aprovadas em que a pessoa consultante aparece; nunca "outras pessoas parecidas", nunca nome de terceiro, nunca score.
- **Remoção:** opt-out por selfie apaga os descritores do rosto no índice; foto específica sai pelo canal de remoção do álbum (`photoAlbum.removalChannelUrl`, obrigatório).
- **Publicação do acervo:** as 6.492 fotos draft são aprovadas em lote (decisão do dono, 2026-10-01), com guardas de ops; `removed` nunca é reaprovada por lote.
- **Enrollment A/C morre:** `faceSubject`, `pnpm faces:enroll` e a adesão por pessoa são removidos; a chave `busca-selfie-indice` passa a nomear o aviso do índice.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/collections/ArchivePhoto.ts` (grupo `faces` existente), collection nova do índice (`archivePhotoFace`), `src/utilities/faceSubjects/*` (reescrito como domínio `faceIndex`), `src/lib/faceSearch.ts` (match por descritor do acervo), `src/app/(frontend)/api/fotos/selfie/route.ts`, `scripts/index-archive-faces.mjs` (+ novo CLI de publicação), migration.
- **Precedente a olhar:** C229 (`speechEmbeddingIndex.ts`/`speechEmbedding` — índice vetorial em jsonb com ranking em memória), `archivePhotoReads.ts` (read público aprovado + tag), `withPayloadTransaction`, guardas de CLI do C231/C232, `revalidateRequest` (`/api/revalidate` para writes fora do processo Next).
- **Risco de acoplamento:** a busca hoje resolve `faceSubject`; remover a collection exige migração destrutiva (tabela vazia em produção — verificado: 0 linhas) e atualização de testes/fixtures; o endpoint e o e2e mudam de "seed de subject" para "seed de descritores".

## Dependências

- Duras: C231/C232/C233 (acervo, catalogação, álbum público) — entregues.
- Duras de produto: aval jurídico/DPIA — **declarado aprovado pelo dono na sessão de 2026-10-01**; registrar no changelog.
- Soft: C243 (seção na home) consome o estado "busca aberta" daqui.

## Fora de escopo

- Identificação/nomeação de terceiros; diretório de rostos; busca por outra pessoa; indexação de vídeo; API pública de reconhecimento.
- Retenção de selfie/imagem; score; galeria.
- Curadoria foto a foto do acervo (o lote publica tudo, com canal de remoção).

## Rabbit holes de produto

- **"Só completar" indexando vídeo/gravações.** **Corte:** só fotos aprovadas do acervo.
- **"Só completar" nomeando quem aparece.** **Corte:** nunca nome inferido de rosto; `catalog.people` continua vindo só do catálogo curado e por texto.
- **"Só completar" com score/"match 87%".** **Corte:** sem número em nenhum estado.
- **"Só completar" guardando a selfie.** **Corte:** vetor-only, sem retenção.

## Questões em aberto (produto)

- **Calibração do threshold (0.45) para índice anônimo:** risco assimétrico muda (falso positivo mostra foto de outra pessoa). **Recomendação:** manter 0.45 no v1 e calibrar com o canário/amostra no runbook; número nunca aparece na UI.
- **Quem atende a fila de remoção de foto:** comunicação/assessoria, como no C233 (canal de remoção já é dela).

## Referências

- `docs/plans/busca-fotos-por-selfie.md` (C234, escopo A/C — decisão superada por este item)
- `docs/plans/busca-fotos-por-selfie-impl.md` (dono técnico a editar)
- `docs/plans/album-fotos-publico-busca.md` (C233 — álbum e canal de remoção)
- `docs/ops/teqo-1313-deploy.md` §C234 (runbook a reescrever)
- `docs/changelog/2026-09-27-c234.md` (entrega anterior)

## Self-score (shaping)

5/5 — (1) fatia = um outcome verificável (qualquer visitante se acha no acervo aprovado; sem configuração, recusa); (2) appetite comporta schema + CLI + endpoint + remoção + ops, sem pesquisa nova; (3) persona, job e aceite verificáveis; (4) direção no codebase com precedentes nomeados; (5) decisões duras (escopo/legal) tomadas pelo dono e registradas.
