# Finalizar o wizard "Registrar pedido" (A5)

Status: rascunho
Atualizado em: 2026-08-10
Issue: #591
Priority: P1
Model: composer-2.5
Impeccable: B — passo final do wizard `/acoes/registrar-pedido` (substitui o stub)
Canvas UI: `plan-b195-ui-draft.canvas.tsx` (gate)
Appetite: ~1,5–2 dias eng; um outcome verificável (mudança de modelo + título por IA inclusos)
Responsável: —

## Intenção

O quick action **"Registrar pedido"** (Início e FAB do município) leva ao wizard `/campanha/acoes/registrar-pedido`: o staff busca o município, e então cai num **beco sem saída** — o passo final é o placeholder genérico "Próximo passo deste fluxo em breve." O fluxo A5 foi explicitamente adiado no B85 (que contornou usando o form `/demandas/nova` na lista/detalhe de demandas) e na cadeia de Voltar do wizard (que deixou "um contrato plugável" para A5). O usuário acha que "Registrar pedido" está pronto porque o botão existe — mas a promessa não se cumpre. Precisamos completar esse fluxo: selecionou o município, preenche o pedido, salva.

Decisões do gate (2026-08-10): o passo final segue o padrão visual dos outros wizards — município no **header principal do app** (top bar, linha discreta sob o título do fluxo), sem linha/chip própria e **sem seletor de município** quando o município já veio da busca; **sem título grande de passo** no conteúdo (o formulário começa direto, com o título do fluxo e o município no header); e o cadastro de demanda passa a ter **um único campo de texto livre** (o quê + detalhes), no lugar dos dois campos atuais — **mudança de modelo permitida pelo produto**. O nome curto da demanda (lista/URL/notificações futuras) é um **título descritivo derivado por IA** (mesmo caminho do Sollinha: provider DeepSeek server-side), salvo em campo próprio do modelo, com **fallback obrigatório para truncamento** — criar a demanda nunca pode falhar por causa da IA.

## Persona e fluxo

- **Persona / contexto:** assessor ou coordenador no celular ou desktop, no Início ou no painel de um município, anotando uma demanda que chegou no campo (material, transporte, diária…).
- **Job principal:** registrar uma demanda do município em menos de um minuto, sem abandonar o fluxo em que estava.
- **Fluxo desejado:**
  1. Toca em "Registrar pedido" (Início ou município).
  2. Wizard pergunta "Em qual município?" (busca já existente; prefilled quando veio do município).
  3. Passo do pedido (município no header do app, padrão dos outros fluxos): Tipo → Atividade relacionada (opcional) → campo de texto livre único ("O que você precisa?").
  4. Salva ("Abrir demanda") → confirmação → volta ao ponto de origem (Início ou município).
- **Anti-goals de produto:** não pedir o que e os detalhes em dois campos separados; não criar um segundo formulário de demanda divergente do existente; liderança continua sem acesso.

### Esboço de fluxo (B)

```text
[Início / município] → Registrar pedido → "Em qual município?" (busca)
  → passo do pedido (município no header) → Abrir demanda → toast + volta à origem
```

## Objetivo e aceite

- Do Início ou do FAB do município, "Registrar pedido" termina num formulário funcional — nunca no placeholder "em breve".
- O município escolhido na busca é preservado na demanda criada; no wizard ele aparece no **header principal do app** (top bar, sob o título do fluxo — padrão dos outros wizards, via `municipalityLabel` do chrome) — sem linha/chip própria, **sem seletor de município** no passo final e **sem título grande de passo** no conteúdo.
- O cadastro de demanda (wizard e form `/demandas/nova`, sem divergência entre os dois) tem **um único campo de texto livre** — o que é + detalhes — posicionado após Tipo e Atividade.
- A demanda **nasce com título descritivo derivado por IA** (mesmo caminho do Sollinha, provider DeepSeek server-side), salvo em campo próprio do modelo, alimentando lista/URL/notificações futuras; **se a IA falhar, o fallback é o texto truncado** — criar a demanda nunca falha nem espera indefinidamente por causa da IA.
- **A descrição (campo único) é editável.** Na edição, o título é **recalculado por IA** e o **slug da URL permanece o mesmo** (invariante canônico atual: slug só nasce no create). Se a IA falhar na edição, **mantém-se o título anterior** — fallback por truncamento vale só no create.
- Ao salvar, o staff volta ao ponto de origem com confirmação visível.
- Launchers que já funcionam (`/demandas/nova` na lista/detalhe) só mudam se o gate decidir unificar (questão Q3) — mas o campo único vale lá também.
- Staff-only; leader lockdown intacto. Mudança de modelo pode exigir migration (dado existente) — a forma fica com o executor.

## Dados (intenção)

Dados: N/A — fluxo de entrada de formulário; nenhum número/KPI/mapa neste item.

## Direção no codebase (hipótese)

- **Áreas prováveis:** `src/app/(campaign)/campanha/(app)/acoes/[slug]/page.tsx` (o passo `register-demand` hoje cai no stub), componentes de wizard em `src/components/campaign/shared/` (`CampaignWizardShell` + chrome `CampaignWizardChromeContext`/`CampaignMobileTopBar` já expõem `municipalityLabel` no header do app — padrão dos outros passos) + `src/components/campaign/demand/DemandForm.tsx` + action `src/app/(campaign)/campanha/(app)/demandas/nova/formActions.ts`; modelo da demanda em `src/collections/CampaignDemand.ts` (campo único + título derivado + migration) — hipótese, revisável; **título por IA:** precedente do Sollinha em `src/app/(campaign)/campanha/api/ai-chat/route.ts` (`@ai-sdk/deepseek` + `DEEPSEEK_API_KEY`, server-side) — a forma do call fica com o executor; copy em `src/lib/campaignWizardCopy.ts` (placeholder "em breve").
- **Precedente a olhar:** `WizardExpectedVotesStep` / `WizardUpdateBodyStep` (padrão de passo final: município no header, salvar → toast → retorno com `returnPath`); B85 (`docs/plans/acoes-rapidas-demandas.md`, imutável — entrega lista/detalhe com form).
- **Risco de acoplamento:** o passo final deve respeitar o contrato do wizard (município por slug, `returnPath` allowlisted, Voltar lógico via `wizardPreviousHref`/cadeia B98); a mudança de modelo não pode quebrar URLs/listas existentes de demandas; não furar o leader lockdown nem o acesso por carteira do assessor.

## Dependências

- Nenhuma dura — o contrato plugável para A5 já está em main (cadeia de Voltar B98/B110 e o router de slugs `/acoes/<slug>`).
- Soft: infra de IA do Sollinha (`DEEPSEEK_API_KEY` + `@ai-sdk/deepseek` já em produção no chat `campanha/api/ai-chat`).

## Fora de escopo

- Redesenho da vertical `/demandas` (lista/detalhe) além do campo único no cadastro e do título na lista.
- Outros wizards (`atualizar-votos`, `registrar-atualizacao`, …) — já funcionam.
- Unificação dos launchers de lista/detalhe de demandas **se o gate não decidir por ela** (Q3).
- Rota `/demandas/nova` — permanece como está (com o mesmo campo único).
- Sistema de notificações — o título derivado já o alimenta quando ele existir.
- **Modelo local / offline para o título** — reavaliar só com os gatilhos abaixo.

## Adiado com gatilho

**Título derivado por modelo local (T5-small/ONNX embutido na função, ou servidor próprio).** Manter síncrono via DeepSeek (API) por ora — custo desprezível no volume atual, pt-BR nativo, infra já em produção. Reavaliar quando: (1) o delay de salvamento virar dor de uso medida em campo; (2) iniciar o app offline mobile/desktop; (3) iniciar servidor sempre-ligado próprio. Todos pós-eleição — hoje o objetivo é o Teqo funcionar em campo rápido e coletar dados para melhorá-lo.

## Rabbit holes de produto

- **"Só completar" o passo com uma UI nova de formulário.** Se o wizard ganhar um form com campos/validação diferentes do `/demandas/nova`, nascem dois cadastros de demanda divergentes. **Corte:** o campo único vale nos dois caminhos, com o mesmo texto livre e o mesmo tipo/atividade.
- **A IA virar dependência dura da criação.** Se o salvar falhar quando a IA falhar, a demanda some do fluxo do staff — inaceitável para escrita. **Corte:** timeout curto + fallback = texto truncado; a demanda nasce sempre, o título é enriquecimento.
- **Deixar o título antigo como segundo campo invisível.** Se o modelo mantiver título + descrição e a UI só esconder um campo, o texto livre continua dividido em dois no banco. **Corte:** o usuário digita uma vez só; o título derivado é campo próprio, nunca pedido.
- **Querer mostrar a demanda criada em detalhe ao salvar.** Se o fluxo pousar no `/demandas/[slug]`, o staff perde o "voltei de onde saí" que os outros wizards dão. **Corte:** confirmação + retorno à origem; o detalhe fica a um toque de distância.

## Questões em aberto (produto)

- **Como o wizard termina?** **Opções:** A) passo de formulário dentro do shell do wizard (município no header, activity opcional, salva e volta) | B) handoff: após a busca, redireciona ao form `/demandas/nova?municipality=<id>`. **Recomendação:** **A** — é o padrão dos outros 4 wizards, honra o contrato de "passo anterior" já preparado e elimina o placeholder; B85 só caiu em B porque o wizard era stub. _(assumido — validar)_
- **Precisamos de título na demanda?** Hoje o campo "O que você precisa?" **é** o título (obrigatório, gera a URL e nomeia a lista); a descrição era o segundo campo. Com o campo único, o nome curto tem que vir de algum lugar. **Decisão do gate: D — título descritivo derivado por IA** (mesmo caminho do Sollinha), salvo em campo próprio do modelo; fallback = texto truncado quando a IA falha. _Confirmado no gate 2026-08-10._
- **Quando o título é gerado?** **Decisão do gate: A — síncrono no salvar** — "Abrir demanda" espera ~1–3s (spinner) e a demanda nasce completa (título + URL `/demandas/<slug-descritivo>`); timeout curto + fallback truncado no create / título anterior na edição. Assíncrono (título depois, URL pelo texto truncado) foi descartado — "o título mudar depois do refresh" confunde. _Confirmado no gate 2026-08-10._
- **O form `/demandas/nova` também migra para o campo único?** **Opções:** A) sim — mesmo campo único (mantendo o seletor de município, que lá é necessário) | B) não — só o wizard muda. **Recomendação:** **A** — sem divergência entre os dois caminhos; "mudar o modelo" só faz sentido se valer para os dois. \_(assumido — validar)
- **Unificar os launchers de demandas (lista/detalhe) no wizard?** **Opções:** A) sim — lista/detalhe passam a apontar ao wizard com prefill, deixando o FAB do detalhe com os 5 ações no mesmo padrão | B) não — lista/detalhe seguem no form que já funciona; só Início/município mudam. **Recomendação:** **B** por ora — menor blast radius; a unificação vira item sucessor se o uso pedir. _(assumido — validar)_
- **Para onde vai ao salvar?** **Opções:** A) confirmação + retorno à origem (`returnPath`), padrão dos outros wizards | B) pousar no detalhe da demanda criada, padrão do form legado. **Recomendação:** **A** — coerência com o resto do wizard; o detalhe fica a um toque.

## Referências

- B85 (`docs/plans/acoes-rapidas-demandas.md`, Issue #21 — imutável; entrega a lista/detalhe com form)
- Contrato de Voltar: `docs/plans/wizard-voltar-passo-anterior-cadeia.md` / `-impl.md` ("A5 fora — só contrato plugável")
- `src/app/(campaign)/campanha/(app)/acoes/[slug]/page.tsx` (stub), `src/components/campaign/shared/CampaignWizardShell.tsx` (`municipalityLabel`), `src/components/campaign/demand/DemandForm.tsx`, `src/collections/CampaignDemand.ts`, `src/lib/campaignHomeActions.ts` (launcher), `src/lib/campaignQuickActionDemands.ts` (launchers lista/detalhe)
- Título por IA: `src/app/(campaign)/campanha/api/ai-chat/route.ts` (precedente Sollinha — provider DeepSeek server-side, `DEEPSEEK_API_KEY`)
- Canvas UI (gate): `/home/fsolla/.cursor/projects/home-fsolla-Code-teqo/canvases/plan-b195-ui-draft.canvas.tsx`
