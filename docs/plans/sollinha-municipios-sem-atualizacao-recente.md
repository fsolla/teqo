# Sollinha: municípios sem atualização recente (cobertura do acompanhamento)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #526
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (resposta em texto no chat existente; nenhuma superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; uma tool nova read-only + testes; sem migration/collection/Consent

## Intenção

O registro de acompanhamento é tão importante quanto a ação em campo: um município sem atualização recente é um município que ninguém está olhando — ou que está sendo negligenciado em silêncio. O Sollinha deve responder "quais municípios estão há mais de X dias sem atualização (ou nunca atualizados)?" de forma **exaustiva** (todos do escopo além do limiar, com contagem), para o coordenador cobrar disciplina de registro e o assessor auditar o próprio portfólio. Complementa B186: lá o ranque de prioridades com motivo; aqui a **cobertura** — o que está ficando para trás no registro, independente de prioridade.

## Persona e fluxo

- **Persona / contexto:** coordenador em `/campanha` conferindo a disciplina de acompanhamento do time; assessor checando se algum município do seu escopo está "apagado".
- **Job principal:** saber, em uma pergunta, quais municípios estão sem atualização há mais de X dias — contados, listados e agrupáveis por região/assessor.
- **Fluxo desejado:**
  1. "Quais municípios estão sem atualização há mais de 30 dias?" → o Sollinha varre o escopo do usuário, aplica o limiar (default 30, ajustável na pergunta) e responde com contagem + lista ordenada do mais velho ao mais recente, cada item com "há N dias" (ou "nunca atualizado" no topo).
  2. O usuário refina: "e no Vale do Jiquiriçá?", "agrupa por assessor", "só os que nunca atualizaram".
  3. Liderança nunca vê nada: resposta de acesso negado, fail-closed.
- **Anti-goals de produto:** não virar feed de alertas/push; não ranquear por gravidade (isso é B186); não propor "o que fazer" — só o fato com o limiar declarado.

## Objetivo e aceite

- O Sollinha responde "quais municípios estão sem atualização há mais de X dias" no **escopo do usuário**, com **contagem total** e um item por município com "há N dias".
- Municípios **nunca atualizados** aparecem no topo, marcados como "nunca atualizado" (estagnação máxima).
- O **limiar é declarado na resposta** ("sem atualização há 30+ dias") e ajustável na pergunta ("há mais de 15 dias?").
- Filtros: região, cidade; agrupável por assessor responsável (`municipality.advisors`) quando pedido.
- Links de navegação para o detalhe de cada município (precedente B162).
- Assessor vê apenas o próprio escopo; leader recebe acesso negado (fail-closed, sem dados).

## Dados (intenção)

- **Vou apresentar dados?** Sim — lista de cobertura com recência, como superfície deste item (no chat).
- **Decisões desbloqueadas:** coordenador decide cobrar o assessor do município/região; assessor decide reativar o registro de um município esquecido.
- **Forma:** *adiada ao plano de implementação*. Restrições de produto: lista exaustiva com contagem (não top N — cobertura é "tudo além do limiar"), ordenação pelo mais velho primeiro; limiar e definição sempre visíveis na resposta.

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova tool em `src/utilities/ai/tools/` (família de `getMunicipalityOverview`/`getDobradinhas`), registrada no `index.ts`; fonte: `municipalityUpdate` (createdAt) × `municipality` (region/city/advisors); reuso de `buildCampaignLinks`.
- **Precedente a olhar:** `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185 — fonte da semântica compartilhada "atualização recente" da família); `docs/plans/sollinha-prioridades-do-momento.md` (B186 — irmão, usa o mesmo sinal com outro propósito); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — gate fail-closed por papel).
- **Risco de acoplamento:** a semântica de "atualização recente" é da família (B185) — este item reusa; a leitura usa só `municipalityUpdate`, sem tocar tools eleitorais (lockdown B180 intacto).

## Dependências

- Soft: B185 (semântica compartilhada de "atualização recente" — reusar, não redefinir). B186 é irmão (mesmo sinal, outro propósito), sem ordem obrigatória.

## Fora de escopo

- Ranking de prioridades com motivo (isso é B186).
- Alertas proativos/push quando um município "expira" sem atualização.
- Relacionar a lista com pendências de lideranças (isso é B185) ou com dados eleitorais (staff-only B180).
- Dashboard/mapa de cobertura.

## Rabbit holes de produto

- **Virar feed de alertas.** Se alguém "só completar", nasce um painel de monitoramento em tempo real. **Corte:** pergunta→resposta; sem persistência de estado, sem notificações.
- **Limiar invisível.** Responder sem declarar o limiar faz a lista parecer arbitrária. **Corte:** "há 30+ dias" (ou o limiar pedido) sempre na primeira linha da resposta.
- **"Nunca atualizado" se perde.** Municípios recém-criados/sem registro sumiriam da leitura. **Corte:** contam como estagnação máxima e vão ao topo, rotulados.

## Questões em aberto (produto)

- **Limiar padrão:** 15, 30 ou 60 dias? **Recomendação:** **30** — cadência típica de giro/atualização de campo, ajustável por pergunta ("há mais de 15 dias?"). _(assumido — validar)_
- **"Sem atualização" mede só `municipalityUpdate`?** **Opções:** (a) só atualizações (recomendação da família B185); (b) qualquer edição do município (`updatedAt`). **Recomendação:** (a) — edição de config/estratégia não é acompanhamento de campo; manter a família coerente. _(assumido — validar)_
- **Salvador na resposta:** listar os 19 ZE separados ou agrupar por cidade? **Recomendação:** agrupar por cidade por padrão (ex.: "Salvador: 7 das 19 zonas sem atualização 30+ dias"), com opção de detalhar por ZE. _(assumido — validar)_

## Referências

- `src/collections/MunicipalityUpdate.ts` — artefato de acompanhamento (createdAt, polarity, urgent)
- `src/utilities/ai/tools/getMunicipalityOverview.ts` — precedente de leitura por município
- `src/utilities/ai/tools/buildCampaignLinks.ts` — links na resposta (B162)
- `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185) — semântica compartilhada da família
- `docs/plans/sollinha-prioridades-do-momento.md` (B186) — irmão (mesmo sinal, propósito diverso)
- `docs/plans/ai-chat-sollinha.md` — arquitetura do chat (imutável, `in-prod`)
