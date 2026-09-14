# Sollinha na assessoria de comunicação (chat escopado ao acervo)

Status: plano — registrado (blocked até plano em main)
Atualizado em: 2026-09-14
Issue: #983
Priority: P2
Impeccable: A — N/A (as superfícies do chat já existem; habilitadas por papel, sem design novo)
Rascunho UI: N/A — sem UI
Appetite: ~0,5–1 dia eng; habilitar a superfície do Sollinha para o `communicator` com escopo de tools, orientação de prompt e testes; sem migration, collection ou Consent
Responsável: —

## Intenção

A assessoria de comunicação é quem produz os vídeos e reels da campanha — e é quem mais precisa garimpar falas do Solla. Hoje ela não tem Sollinha: desde o C154 todas as superfícies do assistente são escondidas do papel `communicator`, decisão deliberada daquela entrega. Com o C158, o Sollinha passa a saber pesquisar o acervo de falas e sugerir trechos; sem este item, justamente a persona que precisa disso não consegue abrir o chat.

Este item reabre aquela decisão de forma estreita: o `communicator` ganha o Sollinha, mas escopado ao acervo — as demais tools negam com mensagem clara, sem vazar dados de campanha nem estourar erro técnico.

## Persona e fluxo

- **Persona / contexto:** assessoria de comunicação (jornalista/videomaker) dentro da vertical `/campanha/comunicacao`, com prazo curto de produção, alternando entre a busca do Acervo e o chat.
- **Job principal:** pedir uma fala para uma peça em linguagem natural e receber trechos do acervo para levar ao corte.
- **Fluxo desejado:** entra na vertical → abre o Sollinha → pergunta "o que o Solla já falou sobre Farmácia Popular?" → recebe trechos com contexto e link para o Acervo → pergunta algo fora do escopo ("quantos votos tivemos em Ilhéus?") → lê uma negativa clara e educada, sem erro técnico.
- **Anti-goals de produto:** não é assistente geral da campanha; não vê dados de campanha, eleitorais ou de municípios; não substitui a busca do Acervo (a superfície principal segue sendo o C154); não vira copiloto de pauta, agenda ou demandas.

## Objetivo e aceite

- O `communicator` vê e abre o Sollinha na vertical (FAB, drawer e botão do header), como qualquer outro papel habilitado.
- Uma pergunta de acervo (ex.: a pergunta-exemplo do C158) responde com trechos de falas e caminho para o Acervo — a primeira prova de valor.
- Pergunta fora do escopo recebe negativa clara e educada — nunca erro técnico, nunca dado de campanha, eleitoral ou de município.
- Os chips de abertura do `communicator` são perguntas de acervo, respondíveis com as tools dele.
- **Guardrails:** leader lockdown intocado; `advisor` inalterado (segue sem acervo e sem mudança no chat); nav do `communicator` intacta (só Comunicação); rate limit e limites atuais de conversa valem igual.

## Dados (intenção)

- **Vou apresentar dados?** Não — o item é acesso/superfície. Quem apresenta os trechos é a tool do C158, dentro do chat que já existe.
- **Decisões desbloqueadas:** nenhuma nova — escolher qual fala cortar já é do fluxo C154/C158.
- **Forma:** _adiada ao plano de implementação_ — sem restrição de produto nova neste item.

## Dados da decisão (literais)

- N/A — nenhum valor fixo de dados. O escopo deriva dos predicados de papel já existentes (`canReadSpeechCatalog` e `canUseCampaignAssistant`, em `src/lib/campaignRoles.ts`); sem tabelas, thresholds ou envs novos.

## Direção no codebase (hipótese)

- **Áreas prováveis:** o predicado de superfície em `src/lib/campaignRoles.ts:34` e seus dois consumidores no shell (`src/components/campaign/shell/ai/CampaignAISidebarShell.tsx:45`, `src/components/campaign/shell/CampaignDesktopHeader.tsx:29`); o prompt global `src/utilities/ai/systemPrompt.ts` (sem regra para `communicator` hoje); a montagem de tools (`src/utilities/ai/tools/index.ts`) e a rota `src/app/(campaign)/campanha/api/ai-chat/route.ts` (só auth + rate limit, sem filtro de papel); os chips em `src/lib/sollinhaOpeningQuestions.ts:45-50`; e `src/utilities/ai/campaignNavigationUrls.ts` (links negados com erro claro).
- **Precedente a olhar:** C154 (escondeu o chat deste papel — este item reabre), C158 (tool de busca no acervo, dependência dura), B180 (`docs/plans/sollinha-tools-eleitorais-leader-lockdown.md`) e B185 (`docs/plans/sollinha-liderancas-pendentes-abordagem.md`), além do access do acervo do C153.
- **Risco de acoplamento:** lockdown do leader e negativa do `advisor` no acervo não podem regredir; o `communicator` não ganha municípios nem dados eleitorais; `maxDuration = 60` e o rate limit de 50 msg/15 min seguem iguais.

## Dependências

- **C158** (dura, #982) — a tool de busca no acervo; sem ela o chat do `communicator` responde pouca coisa útil.
- C153, C154 e C155 entregues (acervo no banco, vertical e busca).

## Fora de escopo

- Abrir o acervo (ou o chat pleno) para `advisor`/`leader` — decisão C153 mantida; sucessor só com nova evidência.
- Assistente de pauta, agenda ou demandas da comunicação — item futuro, sem ID.
- Chat do Sollinha no site público ou fora da vertical — não.
- Novas tools além do escopo de acervo; redesign do drawer ou da persona.

## Rabbit holes de produto

- **"Já que abriu, vira assistente completo da comunicação."** Se alguém "só completar": pauta, agenda, demandas, clipping. **Corte neste item:** só acervo no escopo; o resto nega.
- **"Aproveita e abre o acervo para o advisor/leader."** Se alguém "só completar": muda a decisão C153 de escopo de leitura. **Corte neste item:** decisão mantida; ninguém novo entra.
- **"Refaz o prompt/persona do zero para o communicator."** Se alguém "só completar": reescrita global do prompt e das superfícies. **Corte neste item:** orientação de escopo pontual no prompt, sem design novo.

## Questões em aberto (produto)

- **Qual o escopo de tools do `communicator`?** **Opções:** A | só a tool do acervo + o mínimo (calculadora e links do que ele acessa), e as demais negam claramente; B | assistente completo com gate por tool. **Decisão do gate (2026-09-14): A** — escopo mínimo; o valor está no acervo.
- **Tools que hoje lançam `Forbidden` ou devolvem vazio devem passar a responder negativa clara?** **Opções:** A | sim, sempre negativa clara em linguagem de produto, com ajuste pontual nos donos das tools; B | manter como está. **Decisão do gate (2026-09-14): A** — a resposta ao `communicator` nunca pode virar erro técnico.
- **Chips de abertura do `communicator`?** **Opções:** A | curadoria própria de perguntas de acervo, por capacidade real (padrão B191/C154); B | reaproveitar o conjunto do leader. **Decisão do gate (2026-09-14): A** — chips de acervo que ele consegue responder de verdade.

## Referências

- GitHub Issue: #983
- Rascunho UI (gate): N/A — sem UI
- Planos: `docs/plans/acervo-videos-comunicacao.md` (C154), `docs/plans/catalogo-falas-solla.md` (C153), `docs/plans/sollinha-tools-eleitorais-leader-lockdown.md` (B180), `docs/plans/sollinha-liderancas-pendentes-abordagem.md` (B185); C158 #982 (tool de busca no acervo).
- Pistas de teste: `tests/unit/campaignNav.unit.spec.ts:65-71`, `tests/unit/campaignSollinhaOpeningQuestions.unit.spec.ts:20-51`, `tests/int/speechCatalog.int.spec.ts:123-155`, `tests/e2e/campaignSpeechAcervo.e2e.spec.ts:70-107`, `tests/e2e/campaignAiChatOpeningChips.e2e.spec.ts:103` e o mock `mockSollinhaChat` em `tests/e2e/fixtures/campaignE2EFixtures.ts:604-612`.
- `AGENTS.md` — convenções de papel/access e o registro da decisão C154.
