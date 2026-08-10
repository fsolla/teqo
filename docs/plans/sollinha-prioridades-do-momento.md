# Sollinha: prioridades do momento (gestão)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-08-09
Issue: #525
Priority: P2
Model: composer-2.5
Model-local: deepseek-v4-flash-high
Impeccable: A — N/A (resposta em texto no chat existente; nenhuma superfície nova)
Canvas UI: N/A — sem UI
Appetite: ~1 dia eng; uma tool nova read-only + testes; sem migration/collection/Consent

## Intenção

O coordenador/assessor pergunta "Quais devem ser minhas prioridades neste momento?" e espera uma resposta **acionável**, não uma tabela de dados. O Sollinha deve elencar os municípios do escopo do usuário que merecem atenção agora, com o **porquê de cada um** — tamanho/potencial, atualização recente desfavorável ou muito tempo sem atualização — e links para agir. É a capacidade irmã de B185 (lideranças pendentes): lá o "o quê falta"; aqui o "o que atacar primeiro".

## Persona e fluxo

- **Persona / contexto:** coordenador em `/campanha`, no chat, começando o dia ou o giro; assessor querendo saber o que no próprio escopo está pegando fogo.
- **Job principal:** em uma pergunta, receber um ranking curto de municípios priorizados, cada um com uma linha de evidência ("sem atualização há 40 dias", "atualização negativa ontem", "potencial alto e nível de engajamento baixo").
- **Fluxo desejado:**
  1. "Quais devem ser minhas prioridades neste momento?" → o Sollinha varre o escopo do usuário (coordenador: estado, filtrável por região; assessor: só os municípios que administra), ordena por gravidade combinada e responde top N com motivo explícito por item + links (B162).
  2. O usuário pede um recorte ("e em Salvador?", "só as que estão sem atualização") e refina a mesma leitura.
  3. Liderança nunca vê nada: resposta de acesso negado, fail-closed.
- **Anti-goals de produto:** não virar painel/estatística no chat; não exibir % estadual absoluto; não incluir estimativas escondidas de liderança (assimetria de votos permanece).

## Objetivo e aceite

- O Sollinha responde "quais devem ser minhas prioridades neste momento?" com **top N municípios do escopo do usuário**, cada item com **uma linha de evidência** (o fator que o colocou ali: potencial, sinal desfavorável recente, estagnação).
- O critério de ordenação é declarado na resposta e o usuário pode reordenar/filtrar por um fator (ex.: "só os sem atualização").
- Um município com atualização recente **favorável** e sem sinais negativos não aparece entre as prioridades.
- Assessor vê apenas o próprio escopo; leader recebe acesso negado (fail-closed, sem dados).
- Links de navegação para o detalhe de cada município priorizado (precedente B162).

## Dados (intenção)

- **Vou apresentar dados?** Sim — ranking com justificativa, como superfície deste item (no chat).
- **Decisões desbloqueadas:** coordenador decide onde investir a próxima ação de campo; assessor decide o que tratar primeiro no seu escopo.
- **Forma:** *adiada ao plano de implementação*. Restrições de produto: leitura relativa/local ao escopo do usuário (nunca % estadual absoluto); lista ranqueada com motivo, não score nu; "uma classe nunca vem sem o porquê" (mesma regra do mapa).

## Direção no codebase (hipótese)

- **Áreas prováveis:** nova tool em `src/utilities/ai/tools/` (família de `getMunicipalityOverview`/`getDobradinhas`), registrada no `index.ts`; fontes: `municipality` (engagementLevel, priority, expectedVotes, politicalTrend, region), `municipalityUpdate` (polarity/urgent/adversarySignal/createdAt), `votePledge` (recência de compromissos); reuso de `buildCampaignLinks`.
- **Precedente a olhar:** `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185 — define a semântica de "atualização recente"); `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180 — gate fail-closed por papel); `src/lib/engagementLevel.ts` (níveis N0–N4, regras puras).
- **Risco de acoplamento:** tools eleitorais/staff são staff-only (B180); a assimetria votos declarados × estimados permanece (liderança nunca vê estimativas); não inventar um score de prioridade global persistido — o ranking é derivado na hora.

## Dependências

- Soft: B185 (semântica compartilhada de "atualização recente"/pendência — reusar, não redefinir).

## Fora de escopo

- Persistir prioridades/ranking no banco (é derivado, não dado).
- Notificações/alertas proativos fora do chat.
- Priorização de outros objetos (lideranças, atividades, demandas) num primeiro corte — município é a unidade operacional.
- Dashboard visual/mapa.

## Rabbit holes de produto

- **Score mágico.** Se alguém "só completar", nasce um índice composto sem explicação. **Corte:** ranking por gravidade combinada simples (sinal desfavorável > estagnação > potencial) com o motivo sempre explícito; sem número de score na resposta.
- **"Prioridade" como campo.** Já existe `municipality.priority` (alta/normal) — o ranking **deriva** daí e de sinais, não duplica o campo. **Corte:** prioridade marcada entra como um dos fatores, não como o ranking inteiro.
- **Estimativas vazando para liderança.** `expectedVotes` é staff-only. **Corte:** gate por papel igual ao B180; leader fail-closed.

## Questões em aberto (produto)

- **Formato do ranking:** lista única ordenada ou grupos por motivo ("sem atualização 30+ dias", "sinal negativo recente", "potencial alto")? **Recomendação:** lista única ordenada por gravidade combinada, cada item com o motivo; o usuário filtra por motivo depois. _(assumido — validar)_
- **"Sem atualização" mede o quê?** **Opções:** (a) data da última `municipalityUpdate`; (b) `updatedAt` do município (qualquer edição); (c) compromisso de votos mais recente. **Recomendação:** (a) — **já definido como semântica compartilhada em B185** (fonte da família: "atualização recente" = última `municipalityUpdate`; sem nenhuma = "nunca atualizado", estagnação máxima); B186 reusa, não redefine. _(assumido — validar)_
- **Potencial = o quê?** **Opções:** (A) `expectedVotes` (estimativa 2026, staff-only) com fallback nos válidos de 2022; (B) só 2022; (C) votos do candidato em 2022. **Recomendação:** (A), rotulando a fonte na evidência ("potencial alto: estimativa central X"). _(assumido — validar)_

## Referências

- `src/utilities/ai/tools/getMunicipalityOverview.ts` — campos e contagens por município
- `src/utilities/ai/tools/buildCampaignLinks.ts` — links na resposta (B162)
- `src/collections/MunicipalityUpdate.ts` — sinais (polarity/urgent/adversarySignal)
- `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185) — semântica de pendência/atualização
- `docs/plans/ai-chat-sollinha.md` — arquitetura do chat (imutável, `in-prod`)
